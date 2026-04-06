## 2026-04-06 Task: initialization
- Execute tasks sequentially in order T1 -> T2 -> T3 -> T4 -> T5.
- Prefer incremental TUI improvements over a total redesign.
- Test strategy for this iteration is tests-after.

## 2026-04-06 Task: T1-T3
- Implemented TUI navigation with up/down and tab-based movement instead of introducing a heavier pane/router abstraction.
- Added todo editing only for the TUI-selected open todo and kept scope to text/priority/due date.
- Solved prompt contamination by moving prompt capture to a custom raw-mode reader instead of layering more fixes on `readline.question()`.

## 2026-04-06 Task: T4-T5
- Parsing helpers were moved out of `index.ts` into `src/lib/parsing.ts` instead of exporting internals directly from the CLI entrypoint.
- Chose Vitest as the initial test runner with a minimal config and focused unit tests.
- Added one CI workflow that mirrors the documented local validation commands rather than creating multiple fragmented workflows.

## 2026-04-06 Task: TUI phase 2
- Reused `TodoFilter` directly for the TUI instead of introducing a second filter type.
- Kept filter switching simple with `f` rotation and optional `[` / `]` support.
- Made Enter contextual by current todo state instead of adding separate complete/reopen keys.
- Used a minimal y/N confirmation prompt for delete rather than a more complex modal-like flow.
