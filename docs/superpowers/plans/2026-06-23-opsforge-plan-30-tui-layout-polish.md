# TUI Layout Polish and Status Hygiene Implementation Plan

> **For agentic workers:** This plan captures the TUI-first correction after local launch showed the UI stacking status, errors, and prompt input into one hard-to-read stream.

**Goal:** Make the no-argument TUI feel like the primary product surface by separating host/runtime/status/workspace/prompt areas and preventing stale runtime status from accumulating across prompt submissions.

**Architecture:** Keep runtime actions, CLI commands, and core execution unchanged. Fix the `@opsforge/tui` presentation layer and reducer hygiene so long status text is compacted, the prompt area is visually independent, and each submitted prompt starts with a clean thinking/status stream.

**Design Alignment:** Advances §7.1 by improving the actual TUI surface rather than adding more secondary CLI behavior.

## Tasks

- [x] Add regression coverage for readable long runtime status and a separate prompt area.
- [x] Add regression coverage proving stale `thinkingText` is cleared when a new prompt is submitted.
- [x] Replace the single-column Ink stream with `Host`, `Runtime`, `Status`, `Workspace`, and `Prompt` panels.
- [x] Compact long status text so repeated provider/runtime errors do not dominate the screen.
- [x] Remove stale placeholder copy about future TUI plans from the live TUI.
- [x] Keep audit slash commands visible as prompt-area guidance.
- [x] Run focused TUI tests and typecheck.

## Verification

```bash
pnpm --filter @opsforge/tui test
pnpm --filter @opsforge/tui typecheck
pnpm exec turbo run build --force
pnpm exec turbo run test --force
pnpm exec turbo run typecheck --force
node apps/cli/dist/index.js
```

The focused TUI checks and full monorepo checks pass after implementation. The built CLI no-TTY fallback shows separate `Host`, `Runtime`, `Status`, `Workspace`, and `Prompt` sections.
