# TUI Action Feedback and Provider Model Display Implementation Plan

> **For agentic workers:** This plan fixes the user-visible "no response" state after submitting a prompt in the TUI.

**Goal:** Make TUI submissions visibly responsive immediately and show the configured provider model in the Runtime panel.

**Root Cause:** `submit.prompt` cleared the input and then waited for the async provider/controller call to finish before any new TUI event was rendered. Slow or blocked provider calls therefore left the UI on `Ready`, making it look frozen. The no-argument TUI launch also passed only the formatted provider label, not the model field, so Runtime displayed `Model: default` even when doctor knew the configured model.

**Architecture:** Keep provider planning and core execution unchanged. Add local action feedback in `@opsforge/tui` at the keyboard/action boundary, and pass `providerModel` from doctor startup state into `createTuiStatus()`.

## Tasks

- [x] Add a reducer regression test proving prompt submission immediately sets a planning status.
- [x] Add a CLI entry regression test proving the TUI receives the model from the doctor report.
- [x] Add action feedback for prompt submit, approval, rollback, and audit actions.
- [x] Add `providerModel` to the doctor report and pass it into the no-argument TUI status.
- [x] Run focused TUI and CLI entry tests.

## Verification

```bash
pnpm --filter @opsforge/tui test
pnpm --filter @opsforge/cli test -- index.test.ts
```

Both focused checks pass after implementation.
