# TUI Keyboard Session Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real TUI keyboard control semantics for prompt submission, inline approvals, L3 reason entry, and rollback decisions.

**Architecture:** Keep the key handling as a pure reducer in `@opsforge/tui`, then wire it into an Ink component with `useInput`. The reducer emits typed `TuiUserAction` values that a future runtime session can handle without letting the TUI execute shell commands directly.

**Tech Stack:** TypeScript, React, Ink `useInput`, Vitest, existing TUI reducer/state.

---

## Design Alignment

This plan advances §7.1:

- prompt input is keyboard-driven
- L2 approval can be approved/denied inline
- L3 approval requires a reason before approval
- rollback prompts can be answered inline
- emitted actions are typed and safe for a runtime/core bridge

Out of scope:

- executing actions against core
- real Pi SDK event streaming
- persistence of interactive approval decisions

## Files

- Create: `packages/tui/src/controls.ts`
- Modify: `packages/tui/src/index.tsx`
- Modify: `packages/tui/test/tui.test.ts`
- Modify: `README.md`
- Modify: `docs/implementation-status.md`

---

### Task 1: Pure Keyboard Reducer

- [ ] **Step 1: Write failing tests**

Add tests for:

- character/backspace input editing
- Enter emits `submit.prompt`
- L2 `a`/`d` emits approve/deny
- L3 reason text + Enter emits approval with reason
- rollback `r`/`s` emits rollback/skip

- [ ] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @opsforge/tui test
```

Expected: fail because controls exports are missing.

- [ ] **Step 3: Implement controls reducer**

Create `reduceTuiKeyInput(state, input, key)` returning the next state and optional `TuiUserAction`.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
pnpm --filter @opsforge/tui test
```

Expected: pass.

---

### Task 2: Ink Wiring

- [ ] **Step 1: Wire `useInput`**

Add `TuiInteractiveApp` and use it from `runTui()`. It should render the existing `TuiApp` with the reducer-derived state and forward emitted actions to an optional callback.

- [ ] **Step 2: Typecheck**

Run:

```bash
pnpm --filter @opsforge/tui typecheck
```

Expected: pass.

---

### Task 3: Docs, Verification, Commit

- [ ] **Step 1: Update docs**

Add Plan 20 to README and implementation status.

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
git commit -m "feat: add tui keyboard controls"
git push origin main
```
