# TUI Local Slash Commands Implementation Plan

> **For agentic workers:** This plan fixes the bug where unsupported TUI slash commands were submitted to the LLM provider as natural-language tasks.

**Goal:** Keep TUI commands local unless they explicitly map to a runtime/audit action.

**Root Cause:** The keyboard reducer only recognized `/history` and `/audit <n>`. Any other slash command, including `/provider`, fell through to `submit.prompt`, causing the provider to try to generate an OpsForge Plan from command text.

## Tasks

- [x] Add regression coverage proving `/provider` is handled locally and does not emit a provider action.
- [x] Add regression coverage proving unknown slash commands are rejected locally.
- [x] Implement `/provider` as local status feedback showing provider and model.
- [x] Prevent unknown slash commands from reaching the LLM/provider path.
- [x] Run focused TUI tests and typecheck.

## Verification

```bash
pnpm --filter @opsforge/tui test
pnpm --filter @opsforge/tui typecheck
```

Both checks pass after implementation.
