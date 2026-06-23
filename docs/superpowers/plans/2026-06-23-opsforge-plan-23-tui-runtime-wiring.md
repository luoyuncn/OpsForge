# TUI Runtime Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the no-argument TUI entry to real runtime actions so prompt submission can plan and execute through the guarded OpsForge pipeline.

**Architecture:** Keep TUI rendering provider-neutral: keyboard actions return `TuiEvent[]` that are reduced into state. Keep CLI-specific provider/config/core execution wiring in `apps/cli`, where HostFacts and config already live. Runtime remains the boundary between TUI actions and guarded planner/core callbacks.

**Tech Stack:** TypeScript, Ink/React, Vitest, `@opsforge/tui`, `@opsforge/pi-runtime`, existing CLI planner and apply helpers.

---

## Design Alignment

This plan advances §6.3 and §7.1:

- no-argument `opsforge` TUI can submit a prompt into the runtime action controller
- runtime events update the TUI Plan card, approval prompt, execution timeline, and rollback prompt state
- host mutation remains behind provider planner + core guarded execution
- CLI subcommands remain secondary and unchanged

Out of scope:

- real Pi SDK streaming session
- audit-history rollback lookup from TUI keypress
- model retry/repair loops

## Files

- Modify: `packages/tui/src/state.ts`
- Modify: `packages/tui/src/index.tsx`
- Modify: `packages/tui/test/tui.test.ts`
- Create: `apps/cli/src/tui-runtime.ts`
- Modify: `apps/cli/src/index.ts`
- Modify: `apps/cli/test/index.test.ts`
- Modify: `README.md`
- Modify: `docs/implementation-status.md`

---

### Task 1: TUI Async Action Event Feedback

- [x] **Step 1: Write failing TUI reducer/action tests**

Add tests proving `reduceTuiEvents()` applies multiple events in order and that the exported TUI action handler type can return events.

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @opsforge/tui test
```

Expected: fail because `reduceTuiEvents` is not exported.

- [x] **Step 3: Implement TUI event feedback**

Add `reduceTuiEvents(state, events)` in `packages/tui/src/state.ts`. Update `TuiInteractiveApp` so `onAction` may return `TuiEvent[]`; when the promise resolves, reduce those events into current state.

- [x] **Step 4: Verify GREEN**

Run:

```bash
pnpm --filter @opsforge/tui test
pnpm --filter @opsforge/tui typecheck
```

### Task 2: CLI No-Arg Runtime Action Handler

- [x] **Step 1: Write failing CLI tests**

Add tests for a `createTuiRuntimeActionHandler()` helper that maps a submitted prompt through runtime events into TUI events, and for `main()` passing an action handler into `runTui`.

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @opsforge/cli test
```

Expected: fail because the helper does not exist and `runTui` receives no action handler.

- [x] **Step 3: Implement runtime wiring**

Create `apps/cli/src/tui-runtime.ts`. It should resolve provider/config, call `buildPlanFromPrompt`, execute approved plans through `executeParsedPlan`, and convert runtime events with `runtimeEventToTuiEvent`.

- [x] **Step 4: Verify GREEN**

Run:

```bash
pnpm --filter @opsforge/cli test
pnpm --filter @opsforge/cli typecheck
```

### Task 3: Docs, Full Verification, Commit

- [x] **Step 1: Update docs**

Record Plan 23 in README and implementation status. Update the TUI alignment row to state that no-arg TUI prompt submission is wired to planner/core callbacks, while real Pi SDK streaming and TUI audit rollback lookup remain gaps.

- [x] **Step 2: Run full checks**

Run:

```bash
pnpm exec turbo run build --force
pnpm exec turbo run test --force
pnpm exec turbo run typecheck --force
```

- [x] **Step 3: Commit and push**

Commit as:

```bash
git commit -m "feat: wire tui runtime actions"
git push origin main
```
