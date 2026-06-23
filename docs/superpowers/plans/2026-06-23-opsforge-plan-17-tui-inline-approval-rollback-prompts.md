# TUI Inline Approval And Rollback Prompts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render deterministic TUI inline prompts for L2/L3 approval and failed-run rollback choices, including L3 reason capture state and non-interactive fallback semantics.

**Architecture:** Add pure prompt state models in `@opsforge/tui` that consume existing Plan risk and core rollback outcomes. The Ink shell renders optional approval and rollback prompts inline after the Plan card/timeline, without changing CLI behavior or core execution.

**Tech Stack:** TypeScript, React, Ink, Vitest, existing `@opsforge/core` and `@opsforge/dsl` types.

---

## Design Alignment

This plan implements the §7.1 TUI "交互式审批" and failed-run rollback prompt slice from `docs/superpowers/specs/2026-06-23-opsforge-local-ops-agent-design.md`.

In scope:

- L0/L1 approval bypass model.
- L2 inline approve/deny prompt model.
- L3 inline approve/deny prompt model with required reason state.
- Non-interactive fallback decision text for L2/L3.
- Rollback prompt model for recommended, unavailable, auto-executed, and not-needed outcomes.
- Deterministic snapshot formatting and Ink rendering.

Out of scope:

- Keyboard input handling.
- Pausing/resuming the live core pipeline.
- Pi event-stream wiring.

## Files

- Create: `packages/tui/src/prompts.ts`
- Modify: `packages/tui/src/index.tsx`
- Modify: `packages/tui/test/tui.test.ts`
- Modify: `README.md`
- Modify: `docs/implementation-status.md`

---

### Task 1: Approval Prompt View Model

**Files:**
- Modify: `packages/tui/test/tui.test.ts`
- Create: `packages/tui/src/prompts.ts`

- [ ] **Step 1: Write failing tests for approval prompt models**

Add tests that import `createApprovalPrompt` and `formatApprovalPromptSnapshot`. Assert:

- L1 returns a bypass prompt with `required: false`.
- L2 returns required prompt with approve/deny actions.
- L3 returns required prompt, `reasonRequired: true`, and includes a reason label.
- non-interactive L2 fallback text says it will deny unless explicitly approved.

- [ ] **Step 2: Run focused TUI tests and verify RED**

Run:

```bash
pnpm --filter @opsforge/tui test
```

Expected: fail because approval prompt functions are not exported.

- [ ] **Step 3: Implement approval prompt model and formatter**

Create `packages/tui/src/prompts.ts` with:

- `TuiApprovalPrompt`
- `createApprovalPrompt({ planId, title, risk, interactive })`
- `formatApprovalPromptSnapshot(prompt)`

- [ ] **Step 4: Run focused TUI tests and verify GREEN**

Run:

```bash
pnpm --filter @opsforge/tui test
```

Expected: pass.

---

### Task 2: Rollback Prompt View Model

**Files:**
- Modify: `packages/tui/test/tui.test.ts`
- Modify: `packages/tui/src/prompts.ts`

- [ ] **Step 1: Write failing tests for rollback prompt models**

Add tests that import `createRollbackPrompt` and `formatRollbackPromptSnapshot`. Assert:

- recommended rollback shows run ID, trigger, suggested command, approve/skip actions.
- unavailable rollback shows reason and no approve action.
- auto-executed rollback shows already executed status.
- not-needed rollback returns `required: false`.

- [ ] **Step 2: Run focused TUI tests and verify RED**

Run:

```bash
pnpm --filter @opsforge/tui test
```

Expected: fail because rollback prompt functions are not exported.

- [ ] **Step 3: Implement rollback prompt model and formatter**

Extend `packages/tui/src/prompts.ts` with:

- `TuiRollbackPrompt`
- `createRollbackPrompt({ runId, rollback })`
- `formatRollbackPromptSnapshot(prompt)`

Use the existing `RollbackOutcome` type from `@opsforge/core`.

- [ ] **Step 4: Run focused TUI tests and verify GREEN**

Run:

```bash
pnpm --filter @opsforge/tui test
```

Expected: pass.

---

### Task 3: Render Prompts In The TUI Shell

**Files:**
- Modify: `packages/tui/test/tui.test.ts`
- Modify: `packages/tui/src/index.tsx`

- [ ] **Step 1: Write failing tests for TUI snapshot integration**

Extend `formatTuiSnapshot` tests so optional approval and rollback prompts passed to `createTuiStatus()` appear inline after the Plan/timeline content.

- [ ] **Step 2: Run focused TUI tests and verify RED**

Run:

```bash
pnpm --filter @opsforge/tui test
```

Expected: fail because `createTuiStatus()` does not accept approval/rollback prompt inputs.

- [ ] **Step 3: Thread optional prompts through status and Ink rendering**

Add optional `approval` and `rollbackPrompt` fields to `TuiLaunchOptions`, store prompt view models on `TuiStatus`, and render them in `formatTuiSnapshot()` and `TuiApp`.

- [ ] **Step 4: Run focused TUI tests and verify GREEN**

Run:

```bash
pnpm --filter @opsforge/tui test
```

Expected: pass.

---

### Task 4: Documentation And Design Alignment

**Files:**
- Modify: `README.md`
- Modify: `docs/implementation-status.md`

- [ ] **Step 1: Update README**

Add Plan 17 to the implemented plan list.

- [ ] **Step 2: Update implementation status**

Update:

- Implemented plans list.
- Add `Delivered In Plan 17`.
- Improve §7.1 TUI evidence to include inline approval and rollback prompt rendering.
- Update the roadmap so the immediate next TUI work is Pi/core event streaming and actual input wiring.
- Update known gaps so prompt rendering is no longer listed as missing, while live keyboard/control wiring remains open.

- [ ] **Step 3: Design self-check**

Re-read §7.1 and verify this plan stays in the TUI layer and does not drift into CLI-first implementation.

---

### Task 5: Full Verification, Commit, Push

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

Expected: only intended Plan 17 files are modified plus the preserved untracked `docs/pi_soul.md`.

- [ ] **Step 4: Commit and push**

Run:

```bash
git add docs/superpowers/plans/2026-06-23-opsforge-plan-17-tui-inline-approval-rollback-prompts.md packages/tui/src/index.tsx packages/tui/src/prompts.ts packages/tui/test/tui.test.ts README.md docs/implementation-status.md
git commit -m "feat: add tui approval prompts"
git push origin main
```
