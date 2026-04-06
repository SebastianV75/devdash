# Draft: DevDash Next Iteration

## Requirements (confirmed)
- Project: local-first Linux tool `devdash` / `dsh` in TypeScript + Node.js
- Current focus areas: TUI robustness, terminal UX, tests for `service.ts` and parsing, maintainability, stronger git workflow
- Existing key modules:
  - `src/index.ts`: CLI entry + routing
  - `src/lib/service.ts`: business logic
  - `src/lib/storage.ts`: JSON persistence
  - `src/lib/tui.ts`: terminal UI
  - `src/lib/types.ts`: shared types
- Recent refactor already modularized CLI/TUI flow
- Recent important commit: `refactor: modularize cli and fix tui input flow`
- Priority for next plan: TUI actions
- Scope for next plan: include all recommended areas in one plan
- Test strategy preference: tests-after
- Explicit exclusions: none for now

## Technical Decisions
- Planning should build on the current modular architecture, not revert to monolithic CLI/TUI flow
- TUI should use service-layer operations instead of stdout-printing CLI handlers

## Research Findings
- Initial module-inspection attempt did not return usable findings; needs one follow-up pass

## Open Questions
- Exact TUI interaction scope for this iteration: only todos, or also notes/captures/sessions?
- Whether the plan should include incremental UX improvements only, or broader TUI navigation redesign
- Awaiting concrete test-infrastructure findings

## Scope Boundaries
- INCLUDE: improvements to devdash continuation work
- INCLUDE: TUI actions, TUI robustness, tests, maintainability, stronger git workflow
- EXCLUDE: none explicitly confirmed yet

## Discussion Log
- User selected TUI actions as top priority
- User wants all recommended next steps included in a single plan
- User prefers tests to be added after implementation rather than full TDD
- User has not set any explicit exclusions yet
