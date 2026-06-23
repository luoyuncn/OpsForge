# Runtime Action Controller Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a controlled runtime action controller that receives TUI-style user actions and emits typed runtime events through planner/core callbacks.

**Architecture:** Implement the action controller in `@opsforge/pi-runtime`, not in the TUI. The controller owns current Plan state, calls injected planner/executor/rollback functions, and emits `RuntimeEvent[]`. This keeps the TUI as an event/action surface and keeps execution behind injectable, guarded runtime/core boundaries.

**Tech Stack:** TypeScript, Vitest, existing `@opsforge/dsl`, `@opsforge/core`, `@opsforge/policy`, and `@opsforge/pi-runtime`.

---

## Design Alignment

This plan advances §6.2, §6.3, and §7.1:

- prompt submission can produce planning events
- L2/L3 plans pause as approval events
- L0/L1 plans may continue through an injected executor
- approval actions can resume execution through an injected executor
- rollback actions can call an injected rollback callback

Out of scope:

- real Pi SDK session manager
- provider-specific LLM calls
- actual host execution wiring from the CLI/TUI entry

## Files

- Create: `packages/pi-runtime/src/actions.ts`
- Modify: `packages/pi-runtime/src/index.ts`
- Modify: `packages/pi-runtime/package.json`
- Modify: `packages/pi-runtime/test/events.test.ts`
- Modify: `README.md`
- Modify: `docs/implementation-status.md`

---

### Task 1: Runtime Action Controller

- [ ] **Step 1: Write failing tests**

Add tests for:

- prompt submission emits thinking and Plan-ready events
- L2/L3 prompt emits approval instead of execution
- L1 prompt can auto-execute through injected callback
- approval approve resumes execution
- rollback run calls injected rollback callback
- missing current Plan / rollback handler emits recoverable errors

- [ ] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @opsforge/pi-runtime test
```

Expected: fail because action controller exports are missing.

- [ ] **Step 3: Implement action controller**

Create `createRuntimeActionController(deps)` with `handle(action): Promise<RuntimeEvent[]>`.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
pnpm --filter @opsforge/pi-runtime test
pnpm --filter @opsforge/pi-runtime typecheck
```

Expected: pass.

---

### Task 2: Docs, Verification, Commit

- [ ] **Step 1: Update docs**

Record Plan 21 in README and implementation status.

- [ ] **Step 2: Run full checks**

Run:

```bash
pnpm exec turbo run build --force
pnpm exec turbo run test --force
pnpm exec turbo run typecheck --force
```

- [ ] **Step 3: Commit and push**

Commit as:

```bash
git commit -m "feat: add runtime action controller"
git push origin main
```
