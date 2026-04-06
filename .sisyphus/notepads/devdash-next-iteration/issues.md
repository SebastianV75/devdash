## 2026-04-06 Task: initialization
- Known historical risk: TUI prompt/input flow may regress when adding contextual actions.
- Current codebase has no automated test infrastructure yet.

## 2026-04-06 Task: T1-T3
- PTY verification showed the old prompt contamination class reappeared specifically on todo edit before the prompt reader was replaced.
- PTY automation for the custom raw-mode prompts behaves correctly with carriage return (`\r`); this matters for runtime verification scripts.

## 2026-04-06 Task: T4-T5
- The first test run failed because an overdue-date fixture was not actually overdue relative to the implementation logic; the fixture needed correction, not the app code.

## 2026-04-06 Task: TUI phase 2
- Service tests exposed a real storage bug: `DataStore.read()` was returning the shared `EMPTY_DATA` object directly when the file was missing or blank.
- Initial PTY verification failed due to an incorrect test script assumption about the selected item, not due to a product bug.
