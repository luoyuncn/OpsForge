# TUI Execution Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a deterministic TUI execution timeline from the existing core execution result, showing step command output, exit codes, verification results, and rollback recommendations.

**Architecture:** Keep execution timeline presentation in pure `@opsforge/tui` view-model functions that consume `@opsforge/core` result types. The Ink shell receives an optional execution result and renders the timeline after the plan card, preserving the TUI-first flow without changing CLI behavior.

**Tech Stack:** TypeScript, React, Ink, Vitest, existing `@opsforge/core`, `@opsforge/dsl`, and `@opsforge/executor-base` result types.

---

## Design Alignment

This plan implements the §7.1 TUI "执行时间线" slice from `docs/superpowers/specs/2026-06-23-opsforge-local-ops-agent-design.md`.

In scope:

- Step timeline entries with command, stdout/stderr preview, exit code, duration, and truncated marker.
- Verification result entries with pass/fail status and message.
- Rollback recommendation/availability/auto-executed status.
- Deterministic text formatter for tests and later event-stream fallback.

Out of scope:

- Live streaming updates from Pi/core events.
- Inline approve/deny controls.
- Interactive rollback selection.

## Files

- Create: `packages/tui/src/timeline.ts`
- Modify: `packages/tui/src/index.tsx`
- Modify: `packages/tui/test/tui.test.ts`
- Modify: `packages/tui/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `README.md`
- Modify: `docs/implementation-status.md`

---

### Task 1: Timeline View Model

**Files:**
- Modify: `packages/tui/test/tui.test.ts`
- Create: `packages/tui/src/timeline.ts`
- Modify: `packages/tui/package.json`

- [ ] **Step 1: Write failing tests for an execution timeline view model**

Add tests that import `createExecutionTimeline` and `formatExecutionTimelineSnapshot`. Build a sample `ExecutePlanResult` with:

- one successful step result for `apt-get install -y nginx`.
- stdout `installed nginx`.
- one passing `service-status nginx active` verification.
- rollback outcome with `available: false`, `reason: rollback not needed`.

Assert the timeline contains the run id, command, stdout preview, exit code, verification message, and rollback reason.

- [ ] **Step 2: Run focused TUI tests and verify RED**

Run:

```bash
pnpm --filter @opsforge/tui test
```

Expected: fail because `createExecutionTimeline` and `formatExecutionTimelineSnapshot` are not exported.

- [ ] **Step 3: Implement timeline model and formatter**

Create `packages/tui/src/timeline.ts` with:

- `TuiExecutionTimeline`
- `TuiTimelineStep`
- `TuiTimelineVerification`
- `TuiTimelineRollback`
- `createExecutionTimeline(result)`
- `formatExecutionTimelineSnapshot(timeline)`

Use `ExecutePlanResult` from `@opsforge/core` and command argv formatting consistent with the Plan card.

- [ ] **Step 4: Add package dependency**

Add workspace dependency to `packages/tui/package.json`:

```json
"@opsforge/core": "workspace:*"
```

- [ ] **Step 5: Run focused TUI tests and verify GREEN**

Run:

```bash
pnpm --filter @opsforge/tui test
```

Expected: pass.

---

### Task 2: Render Timeline In The TUI Shell

**Files:**
- Modify: `packages/tui/test/tui.test.ts`
- Modify: `packages/tui/src/index.tsx`

- [ ] **Step 1: Write failing tests for TUI snapshot integration**

Extend the `formatTuiSnapshot` test so an execution result passed to `createTuiStatus()` appears in the snapshot with:

- `Run: run_plan_nginx`
- `Exit: 0`
- `Verification: pass`
- rollback reason.

- [ ] **Step 2: Run focused TUI tests and verify RED**

Run:

```bash
pnpm --filter @opsforge/tui test
```

Expected: fail because `createTuiStatus()` does not accept an execution result and the TUI snapshot does not render timeline details.

- [ ] **Step 3: Thread optional timeline through status and Ink rendering**

Add an optional `execution` field to `TuiLaunchOptions`. Store `timeline?: TuiExecutionTimeline` on `TuiStatus`. Update `formatTuiSnapshot()` and `TuiApp` so:

- no execution result still renders the waiting or plan-only state.
- an execution result renders the timeline after the plan card.

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

Add Plan 16 to the implemented plan list.

- [ ] **Step 2: Update implementation status**

Update:

- Implemented plans list.
- Add `Delivered In Plan 16`.
- Improve §7.1 TUI evidence to include execution timeline.
- Move the TUI-first roadmap next item to Plan 17 inline approval and rollback prompt.
- Update remaining estimate and known gaps so execution timeline is no longer listed as missing.

- [ ] **Step 3: Design self-check**

Re-read §7.1 and verify this plan implements only the execution timeline slice while leaving inline approvals and interactive rollback choices for Plan 17.

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

Expected: only intended Plan 16 files are modified plus the preserved untracked `docs/pi_soul.md`.

- [ ] **Step 4: Commit and push**

Run:

```bash
git add docs/superpowers/plans/2026-06-23-opsforge-plan-16-tui-execution-timeline.md packages/tui/package.json packages/tui/src/index.tsx packages/tui/src/timeline.ts packages/tui/test/tui.test.ts pnpm-lock.yaml README.md docs/implementation-status.md
git commit -m "feat: add tui execution timeline"
git push origin main
```
