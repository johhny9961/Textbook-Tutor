# TERRAIN — Semester Trail Profile

Render the semester as a thru-hike elevation profile in the terminal.

The idea (locked spec, `terrainspec.md` v0.1): the user's failure mode is
**awareness lapses, not execution failures**. TERRAIN makes the whole semester
visible as terrain so awareness is ambient, not summoned.

```
 Summer 2026 ── 13 wks ── 9/19 mi cleared ── pace: ON

 load
                                         ▲                        ▲
  4 │                    ▒▒⛺▒
  3 │               ░░░░ ░░░░           ░░░░
  2 │     ████ ████ ████ ████      ░░░░ ░░░░ ░░░░
  1 │████ ████ ████ ████ ████ ░░░░ ░░░░ ░░░░ ░░░░
    └─────────────────────────────────────────────────────────────────
     W1   W2   W3   W4   ►W5  W6   W7   W8   W9   W10  W11  W12  W13

 cleared █   remaining ░   carry ▒   you ⛺
 ▲ W8  Trig Exam 2  (MATH 1060)
 ▲ W8  MC Ch16-17 wall  (CHEM 1220)
```

## The translation

| Trail | Semester |
|---|---|
| Miles | **Deliverables cleared** — never hours. Time estimates are banned. |
| Trail segment | One week (Mon–Sun) |
| Elevation | Load: weighted count of milestones due that week |
| Summit / landmark | Exam or other fixed anchor |
| Current position | Today (`⛺` + `►`) |
| Carries | Overdue open work dragged into the current segment |

## Install

```sh
pip install -r requirements.txt   # rich only; everything else is stdlib
export TODOIST_API_TOKEN=...       # required; fails loud if missing
```

Python 3.11+ (the spec targets 3.12; the file uses no 3.12-only syntax).

## Configure

Create `terrain.json` next to the tool (a sample is checked in). If it is
missing, TERRAIN prints the schema and exits — it never invents a semester.

```json
{
  "semester": { "name": "Summer 2026", "start": "2026-05-13", "end": "2026-08-06" },
  "anchors": [
    { "date": "2026-06-30", "label": "Trig Exam 2", "class": "MATH 1060" }
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
}
```

- **anchors** — exams / hard walls. Render as summits (`▲`).
- **gates** — concept milestones, *not* homework. A gate is "I own this
  concept by end of week," matched to Todoist tasks by case-insensitive
  substring (`todoist_match`) within that gate's Mon–Sun window. The gate
  clears when **all** matched tasks in the window are completed. `weight`
  defaults to 1; mastery / exam-feeding weeks get 2–3.
- A gate whose `todoist_match` hits zero tasks is listed under **UNMAPPED**
  (it fails loud — never silently counted as cleared or missing).

## Data

- Pulls open + completed tasks for projects `MATH 1060`, `CHEM 1220`,
  `CHEM 1225` over the semester window (Todoist REST v2 + Sync v9 completed
  endpoint).
- Responses are cached to `~/.cache/terrain/` with a **15-minute TTL**. If the
  network is down, the last cache is used and a `STALE (cached HH:MM)` banner
  is shown — never blank.
- **Read-only.** Never writes to Todoist or Calendar; only its own cache.

## Views

```sh
terrain                 # full elevation profile (default)
terrain week            # this segment's gates, tasks, and carries
terrain pace            # one paragraph + three numbers
terrain export --json   # write terrain-export.json (v0.2 widget feed)

  --ascii               # plain ASCII, no color (for the LLM/VM pipeline)
  --config PATH         # path to terrain.json (default: ./terrain.json)
  --width N             # force render width (default: auto, min 80)
```

- **profile** — one column-group per week. Filled `█` = cleared, light `░` =
  remaining, `▒` = carries on the current week, `▲` = anchors (legended below),
  `⛺`/`►` = today. Renders correctly at 80 columns; wider terminals get more
  horizontal resolution, not more chrome.
- **week** — the current segment's gates with their matched tasks and checkbox
  state, plus carries dragged in. No ordering advice, no hours.
- **pace** — miles cleared / total, expected straight-line position vs actual,
  and a verdict (`AHEAD n` / `ON PACE` / `BEHIND n`, where *n* is weighted
  milestones). Rolling-window framing ("k of last 14 days active") — never
  streaks, never guilt language.

## Behavioral rules (non-negotiable)

1. No time estimates anywhere. Miles are deliverables.
2. No prescriptions. The tool shows terrain; it never says "you should."
3. Carries are visible weight, not shame — surfaced as data.
4. Unmapped gates fail loud.
5. Renders correctly at 80 columns.

## Scope

This is **v0.1** (the three terminal views) plus the `export --json` feed that
v0.2's phone widget will draw from — `terrain.py` stays the single source of
computation. Out of scope: writing to Todoist/Calendar, editing
`terrain.json`, notifications, daemons, watch mode. The Android widget and the
Hermes publisher lane (see `terrainspec.md` §v0.2) are separate deliverables.
