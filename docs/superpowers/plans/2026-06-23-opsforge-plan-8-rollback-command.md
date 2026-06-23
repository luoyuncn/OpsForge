# Rollback Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an auditable rollback path so `opsforge rollback <run_id>` can load the original Plan from audit storage and execute its `rollback` steps through the same compiler, guard, executor, artifact, and audit infrastructure as normal execution.

**Architecture:** Store the full Plan JSON in audit records when plans are created, expose it through `AuditRunDetail`, and add a `rollbackPlan()` use case in `@opsforge/core`. The CLI command resolves a prior run by ID, extracts the stored Plan, builds a rollback-only Plan from `plan.rollback`, and executes it with risk gates and dry-run support.

**Tech Stack:** TypeScript, existing zod DSL types, SQLite audit store, commander CLI, vitest, existing executor abstractions.

---

## File Structure

- Modify `packages/audit/src/events.ts`
  - Allow `plan.created` events to carry the full Plan as optional `payload.plan`.
- Modify `packages/audit/src/summary.ts`
  - Add optional `plan?: Plan` to `AuditRunDetail`.
- Modify `packages/audit/src/sqlite.ts`
  - Add `plans.plan_json`.
  - Persist `payload.plan` when present.
  - Return the stored plan in `showRun()`.
- Modify `packages/audit/test/sqlite.test.ts`
  - Cover full Plan persistence and retrieval.
- Modify `packages/core/src/execute.ts`
  - Include full plan in `plan.created`.
  - Add `rollbackPlan()` that executes only rollback steps and records `run.rollback.started` / `run.rollback.finished`.
- Modify `packages/core/test/execute.test.ts`
  - Cover rollback dry-run and rollback execution.
- Modify `apps/cli/src/commands/apply.ts`
  - Export reusable execution helpers needed by rollback.
- Create `apps/cli/src/commands/rollback.ts`
  - Implement `opsforge rollback <run_id>`.
- Modify `apps/cli/src/index.ts`
  - Register rollback command.
- Create `apps/cli/test/rollback.test.ts`
  - Cover rollback dry-run from stored plan and missing-plan failure.
- Modify `README.md` and `docs/implementation-status.md`
  - Record Plan 8 and design alignment.

---

### Task 1: Persist Full Plans In Audit

**Files:**
- Modify: `packages/audit/src/events.ts`
- Modify: `packages/audit/src/summary.ts`
- Modify: `packages/audit/src/sqlite.ts`
- Test: `packages/audit/test/sqlite.test.ts`

- [ ] **Step 1: Write failing audit test**

Add a test:

```ts
const plan = {
  id: "p1",
  title: "Install nginx",
  intent: "install",
  risk: "L1",
  createdAt: "2026-06-23T00:00:00Z",
  prechecks: [],
  steps: [{ type: "package-install", name: "nginx" }],
  verifications: [],
  rollback: [{ type: "package-remove", name: "nginx" }],
  explanation: [],
} satisfies Plan;

store.record({ type: "plan.created", at: "2026-06-23T00:00:00Z", payload: { planId: "p1", intent: "install", risk: "L1", plan } });
store.record({ type: "job.dispatched", at: "2026-06-23T00:00:01Z", payload: { runId: "r1", planId: "p1" } });

expect(store.showRun("r1")?.plan).toEqual(plan);
```

- [ ] **Step 2: Run audit tests to verify RED**

Run: `pnpm --filter @opsforge/audit test`

Expected: FAIL because `AuditRunDetail` has no plan and SQLite does not persist `plan_json`.

- [ ] **Step 3: Implement plan persistence**

Implementation details:
- Extend `plan.created` payload type with `plan?: Plan`.
- Add `plan_json TEXT` to the `plans` table schema.
- After schema creation, run `ALTER TABLE plans ADD COLUMN plan_json TEXT` inside `try/catch` and ignore duplicate-column errors.
- Change the plan insert statement to write `JSON.stringify(event.payload.plan)` when present.
- In `showRun()`, select `plans.plan_json` and parse it into `detail.plan`.

- [ ] **Step 4: Run audit tests to verify GREEN**

Run: `pnpm --filter @opsforge/audit test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/audit
git commit -m "feat(audit): persist full plans for rollback"
```

### Task 2: Core Rollback Use Case

**Files:**
- Modify: `packages/core/src/execute.ts`
- Test: `packages/core/test/execute.test.ts`

- [ ] **Step 1: Write failing core tests**

Add tests that expect:

```ts
const result = await rollbackPlan({
  plan: { ...basePlan, rollback: [{ type: "package-remove", name: "nginx" }] },
  originalRunId: "run_original",
  executor,
  facts,
  audit,
  dryRun: true,
  yes: false,
  riskMax: "L3",
  allowShell: false,
  runner: async () => {
    runnerCalls += 1;
    return { stdout: "", stderr: "", exitCode: 0 };
  },
});

expect(runnerCalls).toBe(0);
expect(result.commands[0].argv).toEqual(["echo", "package-remove"]);
expect(audit.events().map((event) => event.type)).toContain("run.rollback.started");
expect(audit.events().map((event) => event.type)).toContain("run.rollback.finished");
```

Also add a non-dry-run test that executes rollback steps and returns step results.

- [ ] **Step 2: Run core tests to verify RED**

Run: `pnpm --filter @opsforge/core test`

Expected: FAIL because `rollbackPlan` is not implemented.

- [ ] **Step 3: Implement rollbackPlan**

Implementation details:
- Build a rollback-only Plan:

```ts
const rollbackOnlyPlan: Plan = {
  ...input.plan,
  id: `${input.plan.id}_rollback`,
  title: `Rollback ${input.plan.title}`,
  intent: "rollback",
  steps: input.plan.rollback,
  verifications: [],
  rollback: [],
};
```

- Use the same classify/gate/compile/guard/run loop as normal execution.
- Record `run.rollback.started` before compiling/executing rollback steps.
- Record `run.dry_run.finished` for dry-run rollback.
- Record `run.rollback.finished` after dry-run or execution, with step results as payload results.
- Return `ExecutePlanResult`.

- [ ] **Step 4: Run core tests to verify GREEN**

Run: `pnpm --filter @opsforge/core test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): add rollback execution use case"
```

### Task 3: CLI Rollback Command

**Files:**
- Modify: `apps/cli/src/commands/apply.ts`
- Create: `apps/cli/src/commands/rollback.ts`
- Modify: `apps/cli/src/index.ts`
- Test: `apps/cli/test/rollback.test.ts`

- [ ] **Step 1: Write failing CLI tests**

Create a test with a fake `AuditStore.showRun("run_original")` returning an `AuditRunDetail` with `plan.rollback = [{ type: "package-remove", name: "nginx" }]`.

Assert:

```ts
await command.parseAsync(["run_original", "--dry-run"], { from: "user" });
expect(writes[0]).toContain("OpsForge rollback");
expect(writes[0]).toContain("Original run:       run_original");
expect(writes[0]).toContain("apt-get remove -y nginx");
```

Add a missing-plan test:

```ts
await command.parseAsync(["run_missing", "--dry-run"], { from: "user" });
expect(process.exitCode).toBe(1);
expect(writes[0]).toContain("Rollback plan not found");
```

- [ ] **Step 2: Run CLI tests to verify RED**

Run: `pnpm --filter @opsforge/cli test`

Expected: FAIL because rollback command does not exist.

- [ ] **Step 3: Implement rollback command**

Implementation details:
- Add `buildRollbackCommand(deps)` with flags `--dry-run`, `--yes`, `--json`, `--risk-max`, and `--allow-shell`.
- Resolve audit store like `audit.ts`.
- Load `store.showRun(runId)`.
- If missing or missing `detail.plan`, print `Rollback plan not found for run: ${runId}` and set `process.exitCode = 1`.
- Call a reusable `executeRollbackPlan(plan, originalRunId, options, deps)`.
- Format output with `OpsForge rollback`, original run, rollback run ID, gate, dry-run state, compiled commands, and step result count.
- Register `program.addCommand(buildRollbackCommand())`.

- [ ] **Step 4: Run CLI tests to verify GREEN**

Run: `pnpm --filter @opsforge/cli test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/cli
git commit -m "feat(cli): add rollback command"
```

### Task 4: Docs, Alignment, And Full Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/implementation-status.md`

- [ ] **Step 1: Update README**

Add:

```bash
node apps/cli/dist/index.js rollback <run_id> --dry-run
node apps/cli/dist/index.js rollback <run_id> --dry-run --json
```

- [ ] **Step 2: Update implementation status**

Add Plan 8 to implemented plans. Add Delivered In Plan 8. Update §4 and §7.2 rows to mention rollback. Remove “Rollback orchestration and CLI rollback are not implemented” from known gaps, replacing it with remaining rollback limitations: no automatic rollback trigger and no rich rollback reports.

- [ ] **Step 3: Run full verification**

Run:

```bash
pnpm build
pnpm test
pnpm typecheck
```

Expected: all commands exit 0. The existing `node:sqlite` experimental warning may appear during audit tests.

- [ ] **Step 4: Commit and push**

```bash
git add README.md docs/implementation-status.md
git commit -m "docs: record Plan 8 rollback status"
git push origin main
```

---

## Self-Review

- Spec coverage: This plan advances §4 rollback orchestration, §7.2 `rollback <run_id>`, and §8 audit persistence by storing full Plans needed for local rollback. It does not add automatic rollback on failed verification, TUI rollback prompts, or rich rollback reports.
- Placeholder scan: Each task has concrete file paths, test examples, commands, and implementation details.
- Type consistency: The plan consistently uses `rollbackPlan`, `AuditRunDetail.plan`, `buildRollbackCommand`, and `executeRollbackPlan`.
