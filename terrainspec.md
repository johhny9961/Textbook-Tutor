# TERRAIN — Semester Trail Profile

Build spec, v0.1 draft (2026-06-12). Hand this file to Claude Code as the sole brief.

## Purpose

Render the semester as a thru-hike elevation profile in the terminal. The user is an AT thru-hiker whose documented failure mode is **awareness lapses, not execution failures** — he doesn't think about work until urgency forces it. This tool makes the whole semester visible as terrain so awareness is ambient, not summoned.

Core translation (locked, from Sherpa 0610-1110 — do not revisit):

| Trail | Semester |
|---|---|
| Miles | **Deliverables cleared** — never hours. Time estimates are banned from this tool. |
| Trail segment | One week (Mon–Sun) |
| Elevation | Load: weighted count of milestones due that week |
| Summit / landmark | Exam or other fixed anchor |
| Current position | Today |
| Miles hiked | Milestones cleared, semester to date |
| Intra-week variance | Order within a week is free; only the week boundary matters |

## Stack

- Python 3.12, single file `terrain.py`, stdlib + `rich` only. No other deps.
- Read-only. Never writes to Todoist, Calendar, or any file except its own cache.
- Linux terminal (Framework 13). Must degrade to plain ASCII if `--ascii` flag passed (for the user's local LLM/VM pipeline).
- Todoist REST API v2. Token from env `TODOIST_API_TOKEN`. Fail loud and clear if missing.

## Data sources

### 1. `terrain.json` (local config, schema below — this is the sherpa-state successor for semester structure)

```json
{
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
}
```

- `anchors` — exams and hard walls. Render as summits (`▲`) on the profile.
- `gates` — **concept milestones, not homework**. A gate is "I own this concept by end of week," matched to Todoist tasks by substring (`todoist_match`, case-insensitive against task content). A gate clears when ALL matched tasks in that week's window are completed. `weight` defaults 1; mastery gates / exams feeding weeks get 2–3.
- If `terrain.json` is missing, print the schema and exit. Do not invent a semester.

### 2. Todoist (live)

- Pull all tasks (open + completed) from projects `MATH 1060`, `CHEM 1220`, `CHEM 1225` for the semester window.
- Completed-task fetch uses the completed endpoint; cache responses to `~/.cache/terrain/` with 15-min TTL so repeated calls don't hammer the API.
- Overdue open task = carry. Carries render on the profile as weight dragged into the current segment — they raise today's elevation, they don't vanish into the past.

## Views (CLI)

### `terrain` — full profile (default)

ASCII elevation profile, one column-group per week, semester start → end.

```
 Summer 2026 ── 13 wks ── 41/67 mi cleared ── pace: ON

 load
  9│                ▲Trig E2
  7│      ▲E1      ███░
  5│ ██  ███  ██  ⛺██░░    ▲Final
  3│ ██  ███  ██  ████░░  ░░  ░░░
   └──────────────────────────────────
    W1  W2  W3  W4 ►W5  W6 ... W13
        cleared █  remaining ░  you ⛺
```

- Filled blocks (`█`) = cleared milestones in that week; light (`░`) = remaining.
- `⛺` + `►` mark the current week. `▲` anchors sit above their week with labels.
- Color (rich): cleared green, remaining dim, current week bold, anchors red. `--ascii` strips color.

### `terrain week` — current segment detail

This week's gates, each with its matched Todoist tasks and checkbox state, plus carries dragged in. This is the "today's miles" view — what clears the segment. No ordering advice, no hours. Just the gate list.

### `terrain pace` — one paragraph + three numbers

- Miles cleared / total (weighted).
- Expected position if perfectly on pace (linear by week) vs actual.
- Verdict: `AHEAD n` / `ON PACE` / `BEHIND n`, where n = weighted milestones.
- Rolling-window framing only ("9 of last 14 days active" style if data allows). **Never streaks. Never guilt language.**

## Behavioral rules (non-negotiable)

1. **No time estimates anywhere.** Miles are deliverables. This is the whole point.
2. **No prescriptions.** The tool shows terrain; it never says "you should." Sherpa does that, in chat, with live context.
3. **Carries are visible weight, not shame.** Surface as data.
4. **Unmatched gates fail loud.** If a gate's `todoist_match` hits zero tasks, list it under `UNMAPPED` at the bottom of `terrain` output rather than silently counting it cleared or missing.
5. Profile must render correctly at 80 columns. Wider terminals get more horizontal resolution, not more chrome.

## Out of scope (v0.1)

- Writing to Todoist / Calendar. Editing `terrain.json` (hand-edit or future Sherpa weekly-derivation session does that).
- Notifications, daemons, watch mode.
- Anything Sherpa already does (whelm/spoons, ordering, de-escalation).

## v0.2 — Phone widget (build after v0.1 acceptance passes)

Three-part pipeline; terrain.py stays the single source of computation.

### 1. `terrain export --json`

Writes `terrain-export.json`: `{ generated_at, semester, weeks: [{week_of, cleared_w, total_w, is_current}], anchors, pace: {cleared, total, verdict, delta}, carries: n, unmapped: [...] }`. No rendering logic in the export — the widget draws from data.

### 2. Publisher (Hermes lane)

Cron on the VM: run export, serve the JSON on LAN/VPN (single static file behind a tiny HTTP server bound to the private interface — no public exposure, no auth complexity). Claude does not build the cron entry; Hermes owns scheduling. Spec only requires the JSON land at a stable private URL.

### 3. Android widget (Kotlin, sideloaded APK)

- Min SDK 33, GrapheneOS target. AppWidgetProvider + WorkManager refresh (4h interval + manual tap-to-refresh).
- Renders the elevation profile as a Canvas bitmap into RemoteViews: week bars (cleared/remaining), anchor markers with labels, current-week marker, one-line pace verdict.
- Two sizes: 4×2 (full profile + pace line), 2×2 (current week + verdict only).
- Offline-stale behavior: show last successful fetch with a `stale HH:MM` tint, never blank.
- No analytics, no network beyond the one private URL, no Play services. Plain Gradle, reproducible F-Droid-style build.
- Same behavioral rules as the terminal views: deliverables only, no prescriptions, carries visible, no streaks.

## Acceptance

- Cold run with valid token + the sample `terrain.json` above renders all three views without traceback.
- Kill network → cached run still renders with a `STALE (cached HH:MM)` banner.
- A completed Todoist task matching a gate flips that gate's blocks from `░` to `█` on next run.
