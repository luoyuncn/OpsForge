# TUI Plan Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a deterministic TUI plan card for generated OpsForge Plans, including risk, prechecks, steps, compiled-command preview, verifications, rollback preview, and explanation.

**Architecture:** Keep plan presentation logic in pure view-model functions inside `@opsforge/tui`, then let Ink components render those view models. Reuse existing executor compile functions for command previews so the TUI displays the same commands the core pipeline will later execute.

**Tech Stack:** TypeScript, React, Ink, Vitest, existing `@opsforge/dsl`, `@opsforge/executor-base`, `@opsforge/executor-linux`, and `@opsforge/executor-windows`.

---

## Design Alignment

This plan implements the §7.1 TUI "计划卡片" requirement from `docs/superpowers/specs/2026-06-23-opsforge-local-ops-agent-design.md`.

In scope:

- Plan title, intent, risk, and explanation.
- Prechecks, steps, verifications, and rollback preview.
- Compiled local command preview for each step.
- Deterministic text formatter for tests and non-TTY fallback.

Out of scope:

- Live Pi event streaming.
- Execution timeline.
- Inline approval prompts.
- Rollback prompt interaction after failed runs.

## Files

- Modify: `packages/tui/src/index.tsx`
- Modify: `packages/tui/test/tui.test.ts`
- Modify: `packages/tui/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `README.md`
- Modify: `docs/implementation-status.md`

---

### Task 1: Plan Card View Model

**Files:**
- Modify: `packages/tui/test/tui.test.ts`
- Modify: `packages/tui/src/index.tsx`
- Modify: `packages/tui/package.json`

- [ ] **Step 1: Write failing tests for a plan card view model**

Add tests that import `createTuiPlanCard`, `formatPlanCardSnapshot`, and `createTuiStatus`. The tests should build a Linux nginx install Plan and HostFacts with `apt`, then assert:

- plan title and intent are exposed.
- risk is exposed.
- step command preview contains `apt-get install -y nginx`.
- verification summary contains `service-status nginx active`.
- rollback preview contains `systemctl stop nginx`.

- [ ] **Step 2: Run the focused TUI tests and verify RED**

Run:

```bash
pnpm --filter @opsforge/tui test
```

Expected: fail because `createTuiPlanCard` and `formatPlanCardSnapshot` are not exported.

- [ ] **Step 3: Implement the pure plan card view model**

In `packages/tui/src/index.tsx`, add:

- `TuiCommandPreview`
- `TuiPlanStepPreview`
- `TuiPlanCard`
- `createTuiPlanCard(plan, facts)`
- `formatPlanCardSnapshot(card)`

Use `compileLinuxStep()` when `facts.osFamily === "linux"` and `compileWindowsStep()` when `facts.osFamily === "windows"`. Convert command argv to a deterministic string with array arguments joined by spaces and string commands passed through unchanged.

- [ ] **Step 4: Add package dependencies for compiler reuse**

Add workspace dependencies to `packages/tui/package.json`:

```json
"@opsforge/dsl": "workspace:*",
"@opsforge/executor-linux": "workspace:*",
"@opsforge/executor-windows": "workspace:*"
```

- [ ] **Step 5: Run focused TUI tests and verify GREEN**

Run:

```bash
pnpm --filter @opsforge/tui test
```

Expected: pass.

---

### Task 2: Render Plan Card In The TUI Shell

**Files:**
- Modify: `packages/tui/test/tui.test.ts`
- Modify: `packages/tui/src/index.tsx`

- [ ] **Step 1: Write failing tests for TUI snapshot integration**

Extend the `formatTuiSnapshot` test so a `samplePlan` passed to `createTuiStatus()` appears in the snapshot with:

- `Plan: Install nginx`
- `Risk: L1`
- compiled command preview text.

- [ ] **Step 2: Run focused TUI tests and verify RED**

Run:

```bash
pnpm --filter @opsforge/tui test
```

Expected: fail because `createTuiStatus()` does not accept a Plan and `formatTuiSnapshot()` does not render plan cards.

- [ ] **Step 3: Thread optional plan card through status and Ink rendering**

Add an optional `plan` field to `TuiLaunchOptions`. Store `planCard?: TuiPlanCard` on `TuiStatus`. Update `formatTuiSnapshot()` and `TuiApp` so:

- no plan still renders the existing waiting state.
- a plan renders the plan card before the `Ask Forge >` line.

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

Add Plan 15 to the implemented plan list and keep the useful commands unchanged unless a new command is genuinely required.

- [ ] **Step 2: Update implementation status**

Update:

- Implemented plans list.
- Add `Delivered In Plan 15`.
- Improve §7.1 TUI evidence to include plan card.
- Move the TUI-first roadmap next item to Plan 16 execution timeline.
- Update remaining estimate and known gaps so plan card is no longer listed as missing.

- [ ] **Step 3: Design self-check**

Re-read §7.1 and verify this plan implemented only the plan card slice while leaving execution timeline and approvals for later TUI plans.

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

Expected: only intended Plan 15 files are modified plus the preserved untracked `docs/pi_soul.md`.

- [ ] **Step 4: Commit and push**

Run:

```bash
git add docs/superpowers/plans/2026-06-23-opsforge-plan-15-tui-plan-card.md packages/tui/package.json packages/tui/src/index.tsx packages/tui/test/tui.test.ts pnpm-lock.yaml README.md docs/implementation-status.md
git commit -m "feat: add tui plan card"
git push origin main
```
