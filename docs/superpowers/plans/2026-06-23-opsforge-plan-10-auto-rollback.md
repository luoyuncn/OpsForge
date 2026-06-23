# Auto Rollback Prompt And Trigger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add failure-triggered rollback recommendations by default and automatic rollback execution when users pass `--auto-rollback`.

**Architecture:** `@opsforge/core` remains the owner of pipeline outcomes: after execution and verification, it detects failed steps or failed verification results and computes a rollback outcome. If `autoRollback` is false, the outcome suggests `opsforge rollback <run_id>` without mutating further; if `autoRollback` is true and the Plan has rollback steps, core reuses the existing `rollbackPlan()` flow so guard, gate, executor, artifacts, and audit behavior stay consistent.

**Tech Stack:** TypeScript, commander, vitest, `@opsforge/core`, `@opsforge/cli`, existing audit/rollback pipeline.

---

## File Map

- Modify `packages/core/src/execute.ts`: add `autoRollback?: boolean`, rollback outcome types, failure detection, and automatic rollback orchestration.
- Modify `packages/core/test/execute.test.ts`: cover rollback recommendation and automatic rollback after verification failure.
- Modify `apps/cli/src/commands/apply.ts`: pass `autoRollback`, print rollback recommendation/result, and persist rollback artifacts.
- Modify `apps/cli/src/commands/run.ts`: add `--auto-rollback` flag and forward it.
- Modify `apps/cli/src/index.ts`: add `--auto-rollback` to the file-based `apply` command.
- Modify `apps/cli/test/apply.test.ts`: cover human-readable recommendation formatting.
- Modify `apps/cli/test/run.test.ts`: cover `run --auto-rollback` forwarding.
- Modify `README.md`: document `--auto-rollback`.
- Modify `docs/implementation-status.md`: add Plan 10 status and update known gaps/design alignment.

## Design Alignment

This implements design spec §4: `失败/验证未过 -> [Rollback]（默认提示，--auto-rollback 自动）`, §7.2 common `--auto-rollback`, and §13 automatic rollback boundary. It does not add TUI inline rollback options or richer rollback audit views.

---

### Task 1: Core Rollback Outcome

**Files:**
- Modify: `packages/core/src/execute.ts`
- Modify: `packages/core/test/execute.test.ts`

- [ ] **Step 1: Write failing core tests**

Add two tests under `describe("executePlan", ...)`:

```ts
it("recommends manual rollback when verification fails and auto rollback is disabled", async () => {
  const audit = createMemoryAuditRecorder();
  const result = await executePlan({
    plan: { ...basePlan, rollback: [{ type: "package-remove", name: "nginx" }] },
    executor,
    facts,
    audit,
    dryRun: false,
    yes: true,
    riskMax: "L3",
    allowShell: false,
    runner: async () => ({ stdout: "ok", stderr: "", exitCode: 0 }),
    verifyDeps: { runCommand: async () => ({ stdout: "", stderr: "", exitCode: 1 }) },
  });

  expect(result.rollback.trigger).toBe("verification-failed");
  expect(result.rollback.autoExecuted).toBe(false);
  expect(result.rollback.suggestedCommand).toBe(`opsforge rollback ${result.runId}`);
  expect(audit.events().map((event) => event.type)).not.toContain("run.rollback.started");
});

it("auto-executes rollback when verification fails and auto rollback is enabled", async () => {
  const audit = createMemoryAuditRecorder();
  const result = await executePlan({
    plan: { ...basePlan, rollback: [{ type: "package-remove", name: "nginx" }] },
    executor,
    facts,
    audit,
    dryRun: false,
    yes: true,
    riskMax: "L3",
    allowShell: false,
    autoRollback: true,
    runner: async () => ({ stdout: "ok", stderr: "", exitCode: 0 }),
    verifyDeps: { runCommand: async () => ({ stdout: "", stderr: "", exitCode: 1 }) },
  });

  expect(result.rollback.trigger).toBe("verification-failed");
  expect(result.rollback.autoExecuted).toBe(true);
  expect(result.rollback.result?.stepResults[0].step).toEqual({ type: "package-remove", name: "nginx" });
  expect(audit.events().map((event) => event.type)).toContain("run.rollback.started");
  expect(audit.events().map((event) => event.type)).toContain("run.rollback.finished");
});
```

- [ ] **Step 2: Run core test and verify RED**

Run:

```bash
pnpm --filter @opsforge/core exec vitest run test/execute.test.ts
```

Expected: FAIL because `rollback` and `autoRollback` do not exist.

- [ ] **Step 3: Implement minimal core outcome**

In `packages/core/src/execute.ts`:

```ts
export type RollbackTrigger = "step-failed" | "verification-failed";

export interface RollbackOutcome {
  trigger?: RollbackTrigger;
  autoExecuted: boolean;
  available: boolean;
  reason: string;
  suggestedCommand?: string;
  result?: ExecutePlanResult;
}
```

Add `autoRollback?: boolean` to `ExecutePlanInput`.

Add helpers:

```ts
const emptyRollbackOutcome = (): RollbackOutcome => ({
  autoExecuted: false,
  available: false,
  reason: "rollback not needed",
});

const detectRollbackTrigger = (
  commands: CompiledCommand[],
  stepResults: StepResult[],
  verificationResults: VerificationResult[],
): RollbackTrigger | undefined => {
  if (stepResults.some((result) => result.exitCode !== 0) || stepResults.length < commands.length) return "step-failed";
  if (verificationResults.some((result) => !result.ok)) return "verification-failed";
  return undefined;
};

const buildRollbackOutcome = async (
  input: ExecutePlanInput,
  runId: string,
  trigger: RollbackTrigger | undefined,
): Promise<RollbackOutcome> => {
  if (!trigger) return emptyRollbackOutcome();
  if (input.plan.rollback.length === 0) {
    return { trigger, autoExecuted: false, available: false, reason: "rollback unavailable: plan has no rollback steps" };
  }
  if (!input.autoRollback) {
    return {
      trigger,
      autoExecuted: false,
      available: true,
      reason: `rollback recommended after ${trigger}`,
      suggestedCommand: `opsforge rollback ${runId}`,
    };
  }

  const result = await rollbackPlan({ ...input, originalRunId: runId, dryRun: false });
  return { trigger, autoExecuted: true, available: true, reason: `rollback executed after ${trigger}`, result };
};
```

Use this after verification and include `rollback` in every `ExecutePlanResult`; for earlier returns use `emptyRollbackOutcome()`.

- [ ] **Step 4: Run core test and verify GREEN**

Run:

```bash
pnpm --filter @opsforge/core exec vitest run test/execute.test.ts
```

Expected: PASS.

---

### Task 2: CLI Flags And Output

**Files:**
- Modify: `apps/cli/src/commands/apply.ts`
- Modify: `apps/cli/src/commands/run.ts`
- Modify: `apps/cli/src/index.ts`
- Modify: `apps/cli/test/apply.test.ts`
- Modify: `apps/cli/test/run.test.ts`

- [ ] **Step 1: Write failing CLI tests**

Add to `apps/cli/test/apply.test.ts`:

```ts
it("prints rollback recommendation when verification fails without auto rollback", async () => {
  const output = formatApplyResult({
    runId: "run_plan_1",
    risk: "L1",
    gate: { allowed: true, reason: "risk gate passed" },
    commands: [],
    stepResults: [],
    verificationResults: [{ verification: { type: "smoke-test", cmd: "false" }, ok: false, message: "smoke-test exited 1" }],
    rollback: {
      trigger: "verification-failed",
      autoExecuted: false,
      available: true,
      reason: "rollback recommended after verification-failed",
      suggestedCommand: "opsforge rollback run_plan_1",
    },
    auditEvents: [],
    dryRun: false,
  });

  expect(output).toContain("Rollback:           recommended (rollback recommended after verification-failed)");
  expect(output).toContain("Suggested command:  opsforge rollback run_plan_1");
});
```

Add to `apps/cli/test/run.test.ts`:

```ts
it("forwards --auto-rollback into execution", async () => {
  const writes: string[] = [];
  const auditStore = createFakeAuditStore();
  const command = buildRunCommand({
    write: (text) => writes.push(text),
    resolveProvider: async () => ({
      name: "configured-test",
      buildPlan: async () => ({
        title: "Install nginx",
        intent: "install",
        steps: [{ type: "package-install", name: "nginx" }],
        verifications: [{ type: "smoke-test", cmd: "false" }],
        rollback: [{ type: "package-remove", name: "nginx" }],
        risk: "L1",
      }),
    }),
    now: () => "2026-06-23T00:00:00Z",
    planId: () => "plan_run_auto_rollback",
    platform: "linux",
    facts,
    auditStore,
    runner: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
  });

  await command.parseAsync(["node", "test", "install nginx", "--provider", "configured", "--auto-rollback"], { from: "user" });

  expect(writes[0]).toContain("Rollback:           auto-executed");
  expect(auditStore.events().map((event) => event.type)).toContain("run.rollback.started");
});
```

- [ ] **Step 2: Run CLI tests and verify RED**

Run:

```bash
pnpm --filter @opsforge/cli exec vitest run test/apply.test.ts test/run.test.ts
```

Expected: FAIL because output and flags are missing.

- [ ] **Step 3: Implement CLI support**

In `apps/cli/src/commands/apply.ts`:

- Add `autoRollback?: boolean` to `ApplyOptions`.
- Pass `autoRollback: options.autoRollback ?? false` into `executePlan()`.
- After recording primary step artifacts, also record `result.rollback.result?.stepResults` against `result.rollback.result.runId`.
- Extend `formatApplyResult()`:

```ts
const rollbackLines = result.rollback.autoExecuted
  ? [`  Rollback:           auto-executed (${result.rollback.reason})`, `  Rollback run ID:    ${result.rollback.result?.runId ?? ""}`]
  : result.rollback.available
    ? [`  Rollback:           recommended (${result.rollback.reason})`, `  Suggested command:  ${result.rollback.suggestedCommand ?? ""}`]
    : result.rollback.trigger
      ? [`  Rollback:           unavailable (${result.rollback.reason})`]
      : [`  Rollback:           not needed`];
```

Add those lines to the formatted output.

In `apps/cli/src/index.ts` and `apps/cli/src/commands/run.ts`, add `.option("--auto-rollback", "验证或执行失败后自动回滚", false)` and forward `autoRollback: options.autoRollback`.

- [ ] **Step 4: Run CLI tests and verify GREEN**

Run:

```bash
pnpm --filter @opsforge/cli exec vitest run test/apply.test.ts test/run.test.ts
```

Expected: PASS.

---

### Task 3: Documentation And Design Check

**Files:**
- Modify: `README.md`
- Modify: `docs/implementation-status.md`

- [ ] **Step 1: Update README commands**

Add examples:

```bash
node apps/cli/dist/index.js run "install nginx" --auto-rollback
node apps/cli/dist/index.js apply examples/plan-install-nginx.local.json --auto-rollback
```

- [ ] **Step 2: Update implementation status**

Add Plan 10 and update design alignment:

```md
## Delivered In Plan 10

- `@opsforge/core`
  - `executePlan()` detects failed steps and failed verifications.
  - Failed runs return a rollback outcome.
  - `autoRollback` reuses `rollbackPlan()` to execute rollback steps with the same guard/gate/audit path.

- `@opsforge/cli`
  - `apply` and `run` accept `--auto-rollback`.
  - Human-readable output now prints either a rollback recommendation or auto-executed rollback details.
```

Remove the known gap that automatic rollback after failed verification is not implemented. Keep gaps for TUI rollback choice and rich rollback audit views.

- [ ] **Step 3: Check against design**

Confirm:

- Default failure behavior recommends rollback instead of executing it.
- `--auto-rollback` is explicit and opt-in.
- Rollback steps still pass through risk gate, command/path guard, executor, artifacts, and audit.
- No TUI-only behavior is claimed.

---

### Task 4: Full Verification, Commit, Push

**Files:**
- All files touched above.

- [ ] **Step 1: Run full build**

Run:

```bash
pnpm build
```

Expected: exit 0.

- [ ] **Step 2: Run full test suite**

Run:

```bash
pnpm test
```

Expected: exit 0. Node 24 may print the known `node:sqlite` ExperimentalWarning.

- [ ] **Step 3: Run full typecheck**

Run:

```bash
pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 4: Review diff and status**

Run:

```bash
git status --short --branch
git diff -- docs/superpowers/specs/2026-06-23-opsforge-local-ops-agent-design.md
git diff --stat
```

Expected: spec unchanged; `docs/pi_soul.md` remains untracked and untouched.

- [ ] **Step 5: Commit and push**

Run:

```bash
git add README.md docs/implementation-status.md docs/superpowers/plans/2026-06-23-opsforge-plan-10-auto-rollback.md packages/core/src/execute.ts packages/core/test/execute.test.ts apps/cli/src/commands/apply.ts apps/cli/src/commands/run.ts apps/cli/src/index.ts apps/cli/test/apply.test.ts apps/cli/test/run.test.ts
git commit -m "feat: add auto rollback trigger"
git push origin main
git rev-parse HEAD
git rev-parse origin/main
```

Expected: local and remote hashes match.
