#!/usr/bin/env python3
"""TERRAIN — Semester Trail Profile.

Render the semester as a thru-hike elevation profile in the terminal.

  Miles      = deliverables cleared (never hours)
  Segment    = one week (Mon-Sun)
  Elevation  = weighted count of milestones due that week
  Summit     = exam / fixed anchor
  You (camp)  = today

Read-only. Talks to Todoist (REST v2 + Sync v9 completed endpoint), caches
responses under ~/.cache/terrain/ with a 15-minute TTL, and never writes to
Todoist, Calendar, or anything but its own cache.

Behavioral rules (non-negotiable): no time estimates, no prescriptions,
carries are visible weight (not shame), unmatched gates fail loud, renders
correctly at 80 columns.

Usage:
    terrain                 full profile (default)
    terrain week            current segment detail
    terrain pace            one paragraph + three numbers
    terrain export --json   write terrain-export.json (v0.2 widget feed)

    --ascii                 plain ASCII, no color (for LLM/VM pipeline)
    --config PATH           path to terrain.json (default: ./terrain.json)
    --width N               force render width (default: auto, min 80)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

try:
    from rich.console import Console
    from rich.text import Text
except ImportError:  # pragma: no cover - dependency guard
    sys.stderr.write(
        "terrain: missing dependency 'rich'. Install with: pip install rich\n"
    )
    sys.exit(1)

# --------------------------------------------------------------------------- #
# Constants
# --------------------------------------------------------------------------- #

PROJECTS = ("MATH 1060", "CHEM 1220", "CHEM 1225")
CACHE_DIR = Path(os.path.expanduser("~/.cache/terrain"))
CACHE_FILE = CACHE_DIR / "tasks.json"
CACHE_TTL = timedelta(minutes=15)
MIN_WIDTH = 80
MAX_CHART_ROWS = 16

REST_BASE = "https://api.todoist.com/rest/v2"
SYNC_BASE = "https://api.todoist.com/sync/v9"

SCHEMA_SAMPLE = """{
  "semester": {
    "name": "Summer 2026",
    "start": "2026-05-13",
    "end": "2026-08-06"
  },
  "anchors": [
    { "date": "2026-06-30", "label": "Trig Exam 2", "class": "MATH 1060" },
    { "date": "2026-07-05", "label": "MC Ch16-17 wall", "class": "CHEM 1220" }
  ],
  "gates": [
    {
      "week_of": "2026-06-08",
      "class": "MATH 1060",
      "concept": "Fundamental identities",
      "todoist_match": "identities",
      "weight": 2
    }
  ]
}"""


# --------------------------------------------------------------------------- #
# Glyphs
# --------------------------------------------------------------------------- #

@dataclass(frozen=True)
class Glyphs:
    filled: str
    remaining: str
    carry: str
    summit: str
    tent: str
    here: str
    axis_v: str
    axis_h: str
    corner: str


def glyphs_for(ascii_mode: bool) -> Glyphs:
    if ascii_mode:
        return Glyphs("#", ".", ":", "^", "Y", ">", "|", "-", "+")
    return Glyphs("█", "░", "▒", "▲", "⛺", "►",
                  "│", "─", "└")


# --------------------------------------------------------------------------- #
# Config model
# --------------------------------------------------------------------------- #

@dataclass
class Anchor:
    date: date
    label: str
    cls: str


@dataclass
class Gate:
    week_of: date
    cls: str
    concept: str
    todoist_match: str
    weight: int = 1


@dataclass
class Semester:
    name: str
    start: date
    end: date


@dataclass
class Config:
    semester: Semester
    anchors: list[Anchor]
    gates: list[Gate]


class ConfigError(Exception):
    pass


def _parse_date(value: str, where: str) -> date:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        raise ConfigError(f"{where}: invalid date {value!r} (expected YYYY-MM-DD)")


def load_config(path: Path) -> Config:
    if not path.exists():
        raise FileNotFoundError(path)
    try:
        raw = json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        raise ConfigError(f"{path}: invalid JSON ({exc})")

    try:
        sem_raw = raw["semester"]
        semester = Semester(
            name=str(sem_raw["name"]),
            start=_parse_date(sem_raw["start"], "semester.start"),
            end=_parse_date(sem_raw["end"], "semester.end"),
        )
    except KeyError as exc:
        raise ConfigError(f"{path}: missing required key {exc}")

    if semester.end < semester.start:
        raise ConfigError("semester.end is before semester.start")

    anchors = []
    for i, a in enumerate(raw.get("anchors", [])):
        anchors.append(
            Anchor(
                date=_parse_date(a["date"], f"anchors[{i}].date"),
                label=str(a.get("label", "anchor")),
                cls=str(a.get("class", "")),
            )
        )

    gates = []
    for i, g in enumerate(raw.get("gates", [])):
        try:
            gates.append(
                Gate(
                    week_of=_parse_date(g["week_of"], f"gates[{i}].week_of"),
                    cls=str(g.get("class", "")),
                    concept=str(g.get("concept", "")),
                    todoist_match=str(g["todoist_match"]),
                    weight=int(g.get("weight", 1)),
                )
            )
        except KeyError as exc:
            raise ConfigError(f"{path}: gates[{i}] missing required key {exc}")

    return Config(semester=semester, anchors=anchors, gates=gates)


# --------------------------------------------------------------------------- #
# Todoist client (with cache + offline fallback)
# --------------------------------------------------------------------------- #

@dataclass
class Task:
    content: str
    project: str
    due: date | None
    completed: bool
    completed_at: date | None

    def eff_date(self) -> date | None:
        """The date used to bucket the task into a week."""
        if self.due is not None:
            return self.due
        if self.completed_at is not None:
            return self.completed_at
        return None


@dataclass
class FetchResult:
    tasks: list[Task]
    stale: bool
    cache_time: datetime | None


def _http_get(url: str, token: str) -> bytes:
    req = urllib.request.Request(
        url, headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read()


def _iso_dt(value: str) -> date | None:
    if not value:
        return None
    try:
        # Todoist timestamps: 2026-06-12T14:03:21.000000Z or with offset
        cleaned = value.replace("Z", "+00:00")
        return datetime.fromisoformat(cleaned).date()
    except ValueError:
        try:
            return datetime.strptime(value[:10], "%Y-%m-%d").date()
        except ValueError:
            return None


def _fetch_live(token: str, semester: Semester) -> list[Task]:
    # Project id -> name, restricted to the three tracked projects.
    proj_raw = json.loads(_http_get(f"{REST_BASE}/projects", token))
    proj_map = {p["id"]: p["name"] for p in proj_raw}
    tracked_ids = {pid for pid, name in proj_map.items() if name in PROJECTS}

    tasks: list[Task] = []

    # Open tasks.
    open_raw = json.loads(_http_get(f"{REST_BASE}/tasks", token))
    for t in open_raw:
        if t.get("project_id") not in tracked_ids:
            continue
        due_raw = t.get("due") or {}
        tasks.append(
            Task(
                content=t.get("content", ""),
                project=proj_map.get(t["project_id"], ""),
                due=_iso_dt(due_raw.get("date", "")),
                completed=False,
                completed_at=None,
            )
        )

    # Completed tasks within the semester window (Sync v9 completed endpoint).
    since = f"{semester.start.isoformat()}T00:00:00"
    until = f"{semester.end.isoformat()}T23:59:59"
    offset = 0
    while True:
        qs = urllib.parse.urlencode(
            {"since": since, "until": until, "limit": 200, "offset": offset}
        )
        page = json.loads(_http_get(f"{SYNC_BASE}/completed/get_all?{qs}", token))
        items = page.get("items", [])
        for it in items:
            if it.get("project_id") not in tracked_ids:
                continue
            tasks.append(
                Task(
                    content=it.get("content", ""),
                    project=proj_map.get(it["project_id"], ""),
                    due=None,
                    completed=True,
                    completed_at=_iso_dt(it.get("completed_at", "")),
                )
            )
        if len(items) < 200:
            break
        offset += 200

    return tasks


def _task_to_dict(t: Task) -> dict:
    return {
        "content": t.content,
        "project": t.project,
        "due": t.due.isoformat() if t.due else None,
        "completed": t.completed,
        "completed_at": t.completed_at.isoformat() if t.completed_at else None,
    }


def _dict_to_task(d: dict) -> Task:
    return Task(
        content=d.get("content", ""),
        project=d.get("project", ""),
        due=_parse_optional(d.get("due")),
        completed=bool(d.get("completed", False)),
        completed_at=_parse_optional(d.get("completed_at")),
    )


def _parse_optional(value) -> date | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def _read_cache() -> tuple[list[Task], datetime] | None:
    if not CACHE_FILE.exists():
        return None
    try:
        raw = json.loads(CACHE_FILE.read_text())
        fetched_at = datetime.fromisoformat(raw["fetched_at"])
        tasks = [_dict_to_task(d) for d in raw["tasks"]]
        return tasks, fetched_at
    except (json.JSONDecodeError, KeyError, ValueError):
        return None


def _write_cache(tasks: list[Task]) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "tasks": [_task_to_dict(t) for t in tasks],
    }
    CACHE_FILE.write_text(json.dumps(payload))


def get_tasks(token: str, semester: Semester) -> FetchResult:
    """Fetch tasks, preferring a fresh cache, falling back to a stale one."""
    cached = _read_cache()
    now = datetime.now(timezone.utc)

    if cached is not None:
        tasks, fetched_at = cached
        if now - fetched_at < CACHE_TTL:
            return FetchResult(tasks=tasks, stale=False, cache_time=fetched_at)

    # Cache missing or expired -> try live.
    try:
        tasks = _fetch_live(token, semester)
        _write_cache(tasks)
        return FetchResult(tasks=tasks, stale=False, cache_time=None)
    except (urllib.error.URLError, urllib.error.HTTPError, OSError, ValueError):
        if cached is not None:
            tasks, fetched_at = cached
            return FetchResult(tasks=tasks, stale=True, cache_time=fetched_at)
        raise


# --------------------------------------------------------------------------- #
# Computation
# --------------------------------------------------------------------------- #

def monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


@dataclass
class WeekGate:
    gate: Gate
    matched: list[Task]
    cleared: bool


@dataclass
class Week:
    index: int            # 1-based
    start: date           # Monday
    total_w: int = 0      # weighted mapped gates due this week
    cleared_w: int = 0    # weighted cleared gates
    carry: int = 0        # carries dragged into this (current) week
    is_current: bool = False
    anchors: list[Anchor] = field(default_factory=list)
    gates: list[WeekGate] = field(default_factory=list)

    @property
    def label(self) -> str:
        return f"W{self.index}"


@dataclass
class Pace:
    cleared: int
    total: int
    expected: float
    verdict: str          # "AHEAD" | "ON PACE" | "BEHIND"
    delta: int            # weighted milestones off pace (0 when ON PACE)
    active_days: int | None
    window_days: int


@dataclass
class Terrain:
    config: Config
    weeks: list[Week]
    carries: list[Task]
    unmapped: list[Gate]
    pace: Pace
    fetch: FetchResult
    today: date

    @property
    def current_week(self) -> Week | None:
        for w in self.weeks:
            if w.is_current:
                return w
        return None


def build_terrain(config: Config, fetch: FetchResult, today: date) -> Terrain:
    sem = config.semester
    first_monday = monday_of(sem.start)
    last_monday = monday_of(sem.end)

    weeks: list[Week] = []
    cursor = first_monday
    idx = 1
    while cursor <= last_monday:
        weeks.append(Week(index=idx, start=cursor))
        cursor += timedelta(days=7)
        idx += 1

    by_start = {w.start: w for w in weeks}

    # Current week.
    today_monday = monday_of(today)
    for w in weeks:
        if w.start == today_monday:
            w.is_current = True

    # Anchors -> their week.
    for a in config.anchors:
        wk = by_start.get(monday_of(a.date))
        if wk is not None:
            wk.anchors.append(a)

    # Gates -> their week; match Todoist tasks within the week window.
    tasks = fetch.tasks
    unmapped: list[Gate] = []
    for g in config.gates:
        wk = by_start.get(monday_of(g.week_of))
        win_start = monday_of(g.week_of)
        win_end = win_start + timedelta(days=6)
        needle = g.todoist_match.lower()

        matched = [
            t for t in tasks
            if needle in t.content.lower()
            and t.eff_date() is not None
            and win_start <= t.eff_date() <= win_end
        ]

        if not matched:
            unmapped.append(g)
            continue

        cleared = all(t.completed for t in matched)
        if wk is not None:
            wk.gates.append(WeekGate(gate=g, matched=matched, cleared=cleared))
            wk.total_w += g.weight
            if cleared:
                wk.cleared_w += g.weight

    # Carries: open tasks dragged in from PRIOR weeks (due before this week's
    # Monday). Same-week-but-not-yet-done tasks are this week's load, not carries.
    cur = next((w for w in weeks if w.is_current), None)
    carry_cutoff = cur.start if cur is not None else today
    carries = [
        t for t in tasks
        if not t.completed and t.due is not None and t.due < carry_cutoff
    ]
    if cur is not None:
        cur.carry = len(carries)

    pace = compute_pace(weeks, tasks, today)

    return Terrain(
        config=config,
        weeks=weeks,
        carries=carries,
        unmapped=unmapped,
        pace=pace,
        fetch=fetch,
        today=today,
    )


def compute_pace(weeks: list[Week], tasks: list[Task], today: date) -> Pace:
    total = sum(w.total_w for w in weeks)
    cleared = sum(w.cleared_w for w in weeks)
    n_weeks = len(weeks) or 1

    # Weeks elapsed (inclusive of the current week).
    elapsed = 0
    for w in weeks:
        if w.start <= monday_of(today):
            elapsed += 1
    elapsed = max(1, min(elapsed, n_weeks))

    expected = total * elapsed / n_weeks
    diff = cleared - expected
    if diff >= 0.5:
        verdict, delta = "AHEAD", round(diff)
    elif diff <= -0.5:
        verdict, delta = "BEHIND", round(-diff)
    else:
        verdict, delta = "ON PACE", 0

    # Rolling-window activity: distinct days active in the last 14.
    window_days = 14
    cutoff = today - timedelta(days=window_days - 1)
    active = {
        t.completed_at for t in tasks
        if t.completed and t.completed_at is not None
        and cutoff <= t.completed_at <= today
    }
    active_days = len(active) if any(t.completed for t in tasks) else None

    return Pace(
        cleared=cleared,
        total=total,
        expected=expected,
        verdict=verdict,
        delta=delta,
        active_days=active_days,
        window_days=window_days,
    )


def pace_short(pace: Pace) -> str:
    if pace.verdict == "ON PACE":
        return "ON"
    return f"{pace.verdict} {pace.delta}"


# --------------------------------------------------------------------------- #
# Rendering
# --------------------------------------------------------------------------- #

# A rendered line is a list of (text, style) segments. style=None => plain.
Segment = tuple[str, "str | None"]
Line = list


def emit(console: Console, lines: list[Line]) -> None:
    for line in lines:
        text = Text()
        for chunk, style in line:
            text.append(chunk, style=style)
        console.print(text)


def render_profile(t: Terrain, g: Glyphs, width: int) -> list[Line]:
    weeks = t.weeks
    n = len(weeks)

    # Column geometry. Left gutter holds the y-axis labels + axis bar.
    gutter = 5
    avail = max(n, width - gutter)
    per_col = max(2, avail // n)
    bar_w = max(1, min(per_col - 1, 4))
    cell_w = bar_w + 1  # one space between bars

    max_load = max((w.total_w + w.carry for w in weeks), default=0)
    max_load = max(max_load, 1)

    # Row scaling so the chart never exceeds MAX_CHART_ROWS.
    unit = 1
    while -(-max_load // unit) > MAX_CHART_ROWS:  # ceil division
        unit += 1
    rows = max(1, -(-max_load // unit))

    lines: list[Line] = []

    # --- Header ------------------------------------------------------------ #
    sem = t.config.semester
    header = (
        f" {sem.name} ── {n} wks ── "
        f"{t.pace.cleared}/{t.pace.total} mi cleared ── "
        f"pace: {pace_short(t.pace)}"
    )
    if g.axis_h == "-":  # ascii: avoid box-drawing dashes
        header = header.replace("─", "-")
    lines.append([(header, "bold")])
    lines.append([("", None)])
    lines.append([(" load", "dim")])

    # --- Anchor / summit marker row --------------------------------------- #
    anchor_line: Line = [(" " * gutter, None)]
    for w in weeks:
        cell = g.summit if w.anchors else " "
        cell = cell.center(bar_w)[:bar_w] + " "
        anchor_line.append((cell, "red bold" if w.anchors else None))
    lines.append(anchor_line)

    # --- Chart rows (top -> bottom) --------------------------------------- #
    for r in range(rows, 0, -1):
        level = r * unit  # load value at this row
        # y-axis label: show the load number on a few rows.
        if r == rows or r == 1 or rows <= 4 or level % 2 == 0:
            ylabel = f"{level:>3} {g.axis_v}"
        else:
            ylabel = f"    {g.axis_v}"
        line: Line = [(ylabel, "dim")]

        for w in weeks:
            tent = w.is_current and level == max(
                _round_levels(w, unit), 1
            ) and (w.total_w + w.carry) > 0
            if level <= w.cleared_w:
                glyph, style = g.filled, "green"
            elif level <= w.total_w:
                glyph, style = g.remaining, "dim"
            elif w.is_current and level <= w.total_w + w.carry:
                glyph, style = g.carry, "yellow"
            else:
                glyph, style = " ", None

            cell = glyph * bar_w
            if tent:
                # place the tent marker centered on the top filled cell
                mid = bar_w // 2
                cell = cell[:mid] + g.tent + cell[mid + 1:]
                style = "bold cyan"
            line.append((cell + " ", style))
        lines.append(line)

    # --- X axis ----------------------------------------------------------- #
    axis: Line = [(" " * (gutter - 1) + g.corner, "dim")]
    axis.append((g.axis_h * (cell_w * n), "dim"))
    lines.append(axis)

    # Week labels (mark current with the ► glyph).
    label_line: Line = [(" " * gutter, None)]
    for w in weeks:
        lab = w.label
        if w.is_current:
            lab = g.here + lab
        lab = lab[:cell_w].ljust(cell_w)
        label_line.append((lab, "bold cyan" if w.is_current else "dim"))
    lines.append(label_line)

    # --- Legend ----------------------------------------------------------- #
    lines.append([("", None)])
    legend: Line = [
        (" cleared ", "dim"), (g.filled, "green"),
        ("   remaining ", "dim"), (g.remaining, "dim"),
        ("   carry ", "dim"), (g.carry, "yellow"),
        ("   you ", "dim"), (g.tent, "bold cyan"),
    ]
    lines.append(legend)

    # Anchor legend (labels, since they rarely fit above the bars).
    if t.config.anchors:
        for w in weeks:
            for a in w.anchors:
                lines.append([
                    (f" {g.summit} ", "red bold"),
                    (f"{w.label}  ", "dim"),
                    (f"{a.label}", "red"),
                    (f"  ({a.cls})" if a.cls else "", "dim"),
                ])

    # --- Carries + unmapped ----------------------------------------------- #
    if t.carries:
        lines.append([("", None)])
        lines.append([
            (f" carries: {len(t.carries)} ", "yellow bold"),
            ("dragged into this week", "dim"),
        ])
        for c in t.carries:
            due = c.due.isoformat() if c.due else "?"
            lines.append([
                (f"   {g.carry} ", "yellow"),
                (f"{c.content} ", None),
                (f"[{c.project}, due {due}]", "dim"),
            ])

    if t.unmapped:
        lines.append([("", None)])
        lines.append([(" UNMAPPED ", "red bold"),
                      ("gates matching zero tasks this week", "dim")])
        for u in t.unmapped:
            lines.append([
                ("   ! ", "red"),
                (f"{u.concept} ", None),
                (f"[{u.cls}, week {u.week_of.isoformat()}, "
                 f"match \"{u.todoist_match}\"]", "dim"),
            ])

    return lines


def _round_levels(w: Week, unit: int) -> int:
    """Top load level of a week (for tent placement)."""
    top = w.total_w + w.carry
    return -(-top // unit) * unit if top else 0


def render_week(t: Terrain, g: Glyphs) -> list[Line]:
    lines: list[Line] = []
    cur = t.current_week
    if cur is None:
        lines.append([(" Today is outside the semester window.", "dim")])
        return lines

    head = f" {cur.label} ── segment detail"
    if g.axis_h == "-":
        head = head.replace("─", "-")
    lines.append([(head, "bold")])
    for a in cur.anchors:
        lines.append([(f"   {g.summit} {a.label} ", "red"),
                      (f"({a.cls})" if a.cls else "", "dim")])
    lines.append([("", None)])

    if not cur.gates:
        lines.append([("   no mapped gates this week", "dim")])
    for wg in cur.gates:
        box = g.filled if wg.cleared else g.remaining
        style = "green" if wg.cleared else "dim"
        wcount = f"  (w{wg.gate.weight})" if wg.gate.weight != 1 else ""
        lines.append([
            (f" [{box}] ", style),
            (f"{wg.gate.concept}", "bold" if not wg.cleared else None),
            (f"  {wg.gate.cls}{wcount}", "dim"),
        ])
        for task in wg.matched:
            mark = g.filled if task.completed else g.remaining
            mstyle = "green" if task.completed else "dim"
            lines.append([
                (f"      {mark} ", mstyle),
                (task.content, "dim" if task.completed else None),
            ])

    if t.carries:
        lines.append([("", None)])
        lines.append([(f" carries dragged in: {len(t.carries)}", "yellow bold")])
        for c in t.carries:
            due = c.due.isoformat() if c.due else "?"
            lines.append([
                (f"   {g.carry} ", "yellow"),
                (f"{c.content} ", None),
                (f"[{c.project}, due {due}]", "dim"),
            ])

    return lines


def render_pace(t: Terrain, g: Glyphs) -> list[Line]:
    p = t.pace
    lines: list[Line] = []

    verdict_style = {
        "AHEAD": "green bold",
        "ON PACE": "cyan bold",
        "BEHIND": "yellow bold",
    }[p.verdict]
    verdict_txt = p.verdict if p.verdict == "ON PACE" else f"{p.verdict} {p.delta}"

    # One paragraph (deliverables only, no hours, no prescriptions).
    n_weeks = len(t.weeks)
    para = (
        f" {t.config.semester.name}: {p.cleared} of {p.total} weighted "
        f"milestones cleared. On a straight-line week-by-week pace you'd be "
        f"around {p.expected:.0f} by now."
    )
    if t.carries:
        nc = len(t.carries)
        para += (f" {nc} carry is" if nc == 1 else f" {nc} carries are")
        para += " riding into this week."
    lines.append([(para, None)])
    lines.append([("", None)])

    lines.append([("  cleared / total   ", "dim"),
                  (f"{p.cleared} / {p.total}", "bold")])
    lines.append([("  expected on pace  ", "dim"),
                  (f"{p.expected:.0f}", "bold")])
    lines.append([("  verdict           ", "dim"),
                  (verdict_txt, verdict_style)])

    if p.active_days is not None:
        lines.append([("", None)])
        lines.append([
            (f"  {p.active_days} of last {p.window_days} days active",
             "dim"),
        ])

    return lines


def stale_banner(fetch: FetchResult, g: Glyphs) -> Line | None:
    if not fetch.stale or fetch.cache_time is None:
        return None
    local = fetch.cache_time.astimezone()
    return [(f" STALE (cached {local:%H:%M}) ", "black on yellow")]


# --------------------------------------------------------------------------- #
# Export (v0.2 widget feed)
# --------------------------------------------------------------------------- #

def build_export(t: Terrain) -> dict:
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "semester": {
            "name": t.config.semester.name,
            "start": t.config.semester.start.isoformat(),
            "end": t.config.semester.end.isoformat(),
        },
        "weeks": [
            {
                "week_of": w.start.isoformat(),
                "cleared_w": w.cleared_w,
                "total_w": w.total_w,
                "is_current": w.is_current,
            }
            for w in t.weeks
        ],
        "anchors": [
            {"date": a.date.isoformat(), "label": a.label, "class": a.cls}
            for a in t.config.anchors
        ],
        "pace": {
            "cleared": t.pace.cleared,
            "total": t.pace.total,
            "verdict": t.pace.verdict,
            "delta": t.pace.delta,
        },
        "carries": len(t.carries),
        "unmapped": [
            {"concept": u.concept, "class": u.cls,
             "week_of": u.week_of.isoformat(), "match": u.todoist_match}
            for u in t.unmapped
        ],
    }


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="terrain",
        description="Render the semester as a thru-hike elevation profile.",
    )
    parser.add_argument(
        "view", nargs="?", default="profile",
        choices=["profile", "week", "pace", "export"],
        help="view to render (default: profile)",
    )
    parser.add_argument("--ascii", action="store_true",
                        help="plain ASCII, no color")
    parser.add_argument("--json", action="store_true",
                        help="with 'export': write terrain-export.json")
    parser.add_argument("--config", default="terrain.json",
                        help="path to terrain.json (default: ./terrain.json)")
    parser.add_argument("--width", type=int, default=None,
                        help="force render width (default: auto, min 80)")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])
    g = glyphs_for(args.ascii)

    # Config: missing -> print schema and exit (never invent a semester).
    config_path = Path(args.config)
    try:
        config = load_config(config_path)
    except FileNotFoundError:
        sys.stderr.write(
            f"terrain: no config at {config_path}. Create terrain.json:\n\n"
        )
        sys.stderr.write(SCHEMA_SAMPLE + "\n")
        return 1
    except ConfigError as exc:
        sys.stderr.write(f"terrain: {exc}\n")
        return 1

    # Token: fail loud and clear if missing.
    token = os.environ.get("TODOIST_API_TOKEN")
    if not token:
        sys.stderr.write(
            "terrain: TODOIST_API_TOKEN is not set. Export your Todoist API "
            "token:\n    export TODOIST_API_TOKEN=...\n"
        )
        return 1

    try:
        fetch = get_tasks(token, config.semester)
    except Exception as exc:  # noqa: BLE001 - fail loud, no cache to fall back on
        sys.stderr.write(
            f"terrain: could not reach Todoist and no cache is available "
            f"({exc}).\n"
        )
        return 1

    today = date.today()
    terrain = build_terrain(config, fetch, today)

    width = args.width or max(MIN_WIDTH, Console().width)
    console = Console(width=width, no_color=args.ascii, highlight=False)

    if args.view == "export":
        out = Path("terrain-export.json")
        out.write_text(json.dumps(build_export(terrain), indent=2))
        console.print(f"wrote {out}")
        return 0

    banner = stale_banner(fetch, g)
    if banner is not None:
        emit(console, [banner, [("", None)]])

    if args.view == "week":
        lines = render_week(terrain, g)
    elif args.view == "pace":
        lines = render_pace(terrain, g)
    else:
        lines = render_profile(terrain, g, width)

    emit(console, lines)
    return 0


if __name__ == "__main__":
    sys.exit(main())
