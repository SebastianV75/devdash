## 2026-04-06 Task: initialization
- Current architecture is already modularized across index/service/storage/tui/types.
- TUI must continue calling service-layer operations instead of CLI stdout handlers.

## 2026-04-06 Task: T1-T3
- TUI navigation now benefits from a shared selected-index model across list screens instead of screen jumps only.
- Editing/completing todos from the TUI is safest when the TUI calls service methods (`completeTodo`, `updateTodo`) rather than mutating in-place state.
- Replacing `readline.question()` with a raw-mode prompt reader removes the historical action-key bleed bug in PTY/TUI flows.

## 2026-04-06 Task: T4-T5
- Extracting CLI parsing helpers into `src/lib/parsing.ts` makes them testable without coupling tests to the CLI entrypoint.
- A minimal Vitest setup is enough for this repo right now; no extra abstraction or coverage tooling was needed to start getting value.
- The repo can support lightweight CI with a single build/check/test job without additional infrastructure changes.

## 2026-04-06 Task: TUI phase 2
- Reopen/delete/filter behavior fits cleanly on top of the existing selection model when the todo screen owns its own filter state.
- PTY QA needs to be explicit about the currently selected item and current filter because contextual Enter behavior changes by state.
- Storage reads must never return the shared `EMPTY_DATA` object by reference; otherwise state leaks across reads/tests and can also affect real runtime behavior.
