# TUI Audit Rollback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire TUI rollback actions to stored audit rollback execution so failed TUI runs can be rolled back from the primary interface.

**Architecture:** Runtime action handling emits a rollback prompt event whenever guarded execution recommends rollback. The CLI TUI action handler injects a rollback callback that loads the stored Plan from audit history and reuses `executeRollbackPlan()`, preserving the same policy/guard/audit path as the CLI rollback command.

**Tech Stack:** TypeScript, Vitest, existing TUI/pi-runtime/core/audit packages.

---

## Design Alignment

This plan advances §4, §6.3, §7.1, §8, and §12:

- TUI runtime events now include rollback prompts after failed execution.
- TUI rollback key actions can execute stored rollback plans through audit history.
- Rollback remains behind the existing guarded core pipeline.

Out of scope:

- Browseable audit history inside the TUI.
- Multi-run selection UI.
- Rich rollback report views.

## Files

- Modify: `packages/pi-runtime/src/actions.ts`
- Modify: `packages/pi-runtime/test/events.test.ts`
- Modify: `apps/cli/src/tui-runtime.ts`
- Modify: `apps/cli/test/index.test.ts`
- Modify: `README.md`
- Modify: `docs/implementation-status.md`

---

### Task 1: Runtime Rollback Prompt Emission

- [x] **Step 1: Write failing runtime tests**

Add a test that low-risk execution returning `rollback.available: true` emits `runtime.execution.finished` followed by `runtime.rollback.requested`.

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @opsforge/pi-runtime test
```

Expected: fail because execution only emits `runtime.execution.finished`.

- [x] **Step 3: Emit rollback request events**

Add a helper in `actions.ts` that converts `ExecutePlanResult` to execution events plus rollback prompt when rollback is available and not already auto-executed.

- [x] **Step 4: Verify GREEN**

Run:

```bash
pnpm --filter @opsforge/pi-runtime test
pnpm --filter @opsforge/pi-runtime typecheck
```

### Task 2: TUI Runtime Audit Rollback Callback

- [x] **Step 1: Write failing CLI TUI runtime tests**

Add tests that:

- submitted prompt events include `rollback.requested` when execution recommends rollback.
- `rollback.run` calls an injected rollback callback and maps the result to `execution.finished`.
- the default rollback path loads a stored plan from an injected audit store and calls guarded rollback execution.

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @opsforge/cli test
```

Expected: fail because the TUI action handler does not configure rollback.

- [x] **Step 3: Wire rollback callback**

Update `createTuiRuntimeActionHandler()` to accept an optional injected `rollback`, and otherwise load audit history and call `executeRollbackPlan()`.

- [x] **Step 4: Verify GREEN**

Run:

```bash
pnpm --filter @opsforge/cli test
pnpm --filter @opsforge/cli typecheck
```

### Task 3: Docs, Full Verification, Commit

- [x] **Step 1: Update docs**

Record Plan 26 and update remaining gaps.

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
git commit -m "feat: wire tui audit rollback"
git push origin main
```
