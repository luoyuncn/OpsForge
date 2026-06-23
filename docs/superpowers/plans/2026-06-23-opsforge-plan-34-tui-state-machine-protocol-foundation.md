# TUI State Machine And Protocol Foundation Implementation Plan

> **For agentic workers:** This plan starts the final TUI整改 track. Do not replace Ink. Freeze protocol boundaries first, then continue UI/product work on top of structured state.

**Goal:** Move OpsForge from patchy TUI behavior toward a state-machine-driven terminal product by separating input classification, structured errors, status selectors, and Plan raw-output extraction.

**Design Source:** The final整改方案 attached in the 2026-06-23 session: keep Ink, split UI/state/domain/adapters, freeze Plan DSL, and make provider failures flow through structured state.

## Scope

- [x] Add TUI input intent parsing under `commands/parseInput.ts`.
- [x] Keep slash commands local before provider/runtime submission.
- [x] Add a structured TUI error model with `phase`, `type`, `summary`, `details`, `retryable`, and `suggestedAction`.
- [x] Store structured runtime/planning errors in TUI state while preserving `errorText` compatibility.
- [x] Add `selectStatusViewModel()` so Status rendering is selector-driven.
- [x] Map runtime errors through structured TUI errors.
- [x] Map planner validation failures from the no-arg TUI runtime path to `validate/INVALID_SCHEMA`.
- [x] Add `extractPlanCandidate()` in the planner protocol layer.
- [x] Support fenced JSON, pure JSON, and mixed text with the largest valid JSON object.
- [x] Change OpenAI-compatible, Anthropic, and Google provider adapters to return raw text content so extraction/validation is centralized in `buildPlanFromPrompt()`.
- [x] Update implementation status docs.

## Acceptance Criteria

- Slash commands such as `/provider`, `/history`, and `/audit 1` are classified as commands and never become provider prompts.
- Plain text such as `install nginx` is classified as a task.
- Unknown slash commands fail locally with a structured input error.
- Invalid Plan DSL from a provider becomes a structured `validate/INVALID_SCHEMA` status event.
- Status rendering can use a selector rather than reading scattered fields directly.
- Provider responses wrapped in markdown fences or explanatory text can still produce a schema-valid Plan if a valid JSON object is present.

## Verification

```bash
pnpm --filter @opsforge/tui test
pnpm --filter @opsforge/planner test
pnpm --filter @opsforge/cli test
pnpm --filter @opsforge/tui typecheck
pnpm --filter @opsforge/planner typecheck
pnpm --filter @opsforge/cli typecheck
pnpm exec turbo run build --force
pnpm exec turbo run test --force
pnpm exec turbo run typecheck --force
```

## Follow-Up

- Continue splitting `packages/tui/src/index.tsx` into `app/`, `ui/`, `state/`, `domain/`, and `adapters/`.
- Introduce an explicit `AppMode` and reducer actions for inspect, planning, approval, execution, verification, rollback, completed, and failed.
- Add Plan preview and log panes as selector-fed views.
- Keep real Pi SDK/session integration as a separate hardening track after the TUI state machine is stable.
