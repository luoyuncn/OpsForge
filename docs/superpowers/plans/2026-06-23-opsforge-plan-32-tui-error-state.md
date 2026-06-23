# TUI Runtime Error State and Pi Gap Clarification Implementation Plan

> **For agentic workers:** This plan fixes the TUI bug where provider/planner failures were appended to pending status text and exposed raw schema validation details.

**Goal:** Make runtime failures readable in the TUI and keep the project status honest about Pi SDK integration.

**Root Cause:** The TUI only had a `thinking.delta` status path. The CLI runtime converted all caught errors into `thinking.delta`, so a pending message such as `Planning with the configured provider...` was concatenated with raw planner validation details like `Required; Invalid discriminator value...`. `runtime.error` events were also ignored by the TUI adapter.

**Architecture:** Add a dedicated TUI error event/state. Runtime errors replace pending thinking text instead of appending to it. Planner validation failures are mapped to a concise user-facing error; detailed schema repair remains inside planner/provider tests and logs rather than the main TUI status line.

## Tasks

- [x] Add reducer coverage proving runtime errors replace pending thinking state.
- [x] Add runtime adapter coverage for `runtime.error`.
- [x] Add CLI runtime coverage for planner validation failures.
- [x] Add `errorText` to TUI status and render it as an error status line.
- [x] Map planner validation errors to a concise user-facing message.
- [x] Keep documentation clear that openai-compatible provider flow is implemented, while real Pi SDK/session integration remains a known gap.

## Verification

```bash
pnpm --filter @opsforge/tui test
pnpm --filter @opsforge/cli test -- index.test.ts
```

Both focused checks pass after implementation.
