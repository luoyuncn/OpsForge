# TUI Event And Input State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic TUI event/input state layer that can drive the Plan card, execution timeline, approval prompt, rollback prompt, thinking stream, and input prompt from live core/Pi events.

**Architecture:** Build a pure reducer in `@opsforge/tui` that converts typed TUI events into `TuiStatus`. Keep it framework-independent and tested, then let the Ink shell render the derived state. This prepares the TUI for live Pi/core event streaming without changing CLI subcommands.

**Tech Stack:** TypeScript, React, Ink, Vitest, existing `@opsforge/core`, `@opsforge/dsl`, and `@opsforge/executor-base` types.

---

## Design Alignment

This plan advances §7.1 TUI mode from static renderable pieces toward the intended live TUI:

- thinking stream
- plan card
- execution timeline
- inline approval prompt
- rollback prompt
- bottom status bar
- dialogue input state

In scope:

- Pure TUI event union and reducer.
- Input draft/submitted state.
- Thinking stream text accumulation.
- Event-driven updates for Plan card, execution timeline, approval prompt, and rollback prompt.
- Deterministic snapshot formatter for the full event-driven state.

Out of scope:

- Real Pi SDK connection.
- Actual keyboard event handling through Ink `useInput`.
- Executing approval or rollback decisions against core.

## Files

- Create: `packages/tui/src/state.ts`
- Modify: `packages/tui/src/index.tsx`
- Modify: `packages/tui/test/tui.test.ts`
- Modify: `README.md`
- Modify: `docs/implementation-status.md`

---

### Task 1: Event Reducer

**Files:**
- Modify: `packages/tui/test/tui.test.ts`
- Create: `packages/tui/src/state.ts`

- [ ] **Step 1: Write failing tests for event-driven TUI state**

Add tests that import `createInitialTuiState`, `reduceTuiEvent`, and `formatTuiStateSnapshot`. Assert that:

- `thinking.delta` accumulates streamed thinking text.
- `input.changed` updates the input draft.
- `input.submitted` records the submitted prompt and clears the draft.
- `plan.ready` builds a Plan card from the Plan and HostFacts.
- `execution.finished` builds an execution timeline.
- `approval.requested` builds an approval prompt.
- `rollback.requested` builds a rollback prompt.

- [ ] **Step 2: Run focused TUI tests and verify RED**

Run:

```bash
pnpm --filter @opsforge/tui test
```

Expected: fail because state reducer functions are not exported.

- [ ] **Step 3: Implement reducer and snapshot formatter**

Create `packages/tui/src/state.ts` with:

- `TuiEvent`
- `TuiInputState`
- `TuiThinkingState`
- `TuiState`
- `createInitialTuiState(status)`
- `reduceTuiEvent(state, event)`
- `formatTuiStateSnapshot(state)`

The reducer should never mutate the incoming state object.

- [ ] **Step 4: Run focused TUI tests and verify GREEN**

Run:

```bash
pnpm --filter @opsforge/tui test
```

Expected: pass.

---

### Task 2: Render Event State In The TUI Shell

**Files:**
- Modify: `packages/tui/test/tui.test.ts`
- Modify: `packages/tui/src/index.tsx`

- [ ] **Step 1: Write failing tests for status snapshot state fields**

Extend `formatTuiSnapshot` tests so optional `thinking` and `inputDraft` in `TuiStatus` appear in the snapshot.

- [ ] **Step 2: Run focused TUI tests and verify RED**

Run:

```bash
pnpm --filter @opsforge/tui test
```

Expected: fail because `TuiStatus` does not yet carry thinking/input state.

- [ ] **Step 3: Add thinking and input rendering**

Add optional `thinkingText`, `inputDraft`, and `lastSubmittedPrompt` fields to `TuiStatus`. Render thinking above the Plan card and render `Ask Forge > <draft>` in both deterministic snapshot and Ink view.

- [ ] **Step 4: Run focused TUI tests and verify GREEN**

Run:

```bash
pnpm --filter @opsforge/tui test
```

Expected: pass.

---

### Task 3: Documentation And Design Alignment

**Files:**
- Modify: `README.md`
- Modify: `docs/implementation-status.md`

- [ ] **Step 1: Update README**

Add Plan 18 to the implemented plan list.

- [ ] **Step 2: Update implementation status**

Update:

- Implemented plans list.
- Add `Delivered In Plan 18`.
- Improve §7.1 TUI evidence to include event/input state.
- Move the immediate next plans to Pi runtime/provider depth and real TUI input wiring.
- Update known gaps so event-state modeling is no longer listed as missing, while real Pi SDK and keyboard execution wiring remain open.

- [ ] **Step 3: Design self-check**

Re-read §7.1 and verify this plan keeps implementation in the TUI layer and prepares, but does not fake, real Pi/core streaming.

---

### Task 4: Full Verification, Commit, Push

**Files:**
- All modified files.

- [ ] **Step 1: Run focused checks**

Run:

```bash
pnpm --filter @opsforge/tui test
pnpm --filter @opsforge/tui typecheck
```

- [ ] **Step 2: Run full repository checks**

Run:

```bash
pnpm build
pnpm test
pnpm typecheck
```

Expected: all commands exit 0. The known Node 24 `node:sqlite ExperimentalWarning` can appear during tests.

- [ ] **Step 3: Clean temporary artifacts and review status**

Run:

```bash
Remove-Item -Recurse -Force .opsforge-tmp -ErrorAction SilentlyContinue
git status --short --branch
```

Expected: only intended Plan 18 files are modified plus the preserved untracked `docs/pi_soul.md`.

- [ ] **Step 4: Commit and push**

Run:

```bash
git add docs/superpowers/plans/2026-06-23-opsforge-plan-18-tui-event-input-state.md packages/tui/src/index.tsx packages/tui/src/state.ts packages/tui/test/tui.test.ts README.md docs/implementation-status.md
git commit -m "feat: add tui event state"
git push origin main
```
