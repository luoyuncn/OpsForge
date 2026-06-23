# Verify Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `opsforge verify <run_id>` so users can rerun the stored verification specs for a prior audited run.

**Architecture:** Plan 8 persists full Plan JSON in audit history, so the verify command can load `AuditRunDetail.plan` and replay `plan.verifications`. The replay path belongs in `@opsforge/core` as a small use case that records a fresh `run.verified` audit event against the original run ID without recompiling or executing mutation steps.

**Tech Stack:** TypeScript, commander, vitest, `@opsforge/core`, `@opsforge/audit`, `@opsforge/verifier`.

---

## File Map

- Modify `packages/core/src/execute.ts`: add a `verifyStoredPlan()` use case that calls `verifyPlan()` and records `run.verified`.
- Modify `packages/core/test/execute.test.ts`: cover successful verification replay and audit event recording.
- Modify `apps/cli/src/commands/apply.ts`: export default verification dependencies for CLI command reuse.
- Create `apps/cli/src/commands/verify.ts`: implement `buildVerifyCommand()`, `executeVerifyPlan()`, and `formatVerifyResult()`.
- Modify `apps/cli/src/index.ts`: register `verify`.
- Create `apps/cli/test/verify.test.ts`: cover dry CLI behavior with injected audit store and runner dependencies.
- Modify `README.md`: document `opsforge verify <run_id>`.
- Modify `docs/implementation-status.md`: add Plan 9 delivery notes and update design alignment/gaps.

## Design Alignment

This plan directly implements design spec §7.2 `opsforge verify <run_id>` and strengthens §4/§8 by exposing verification replay through the same audit store. It intentionally does not implement automatic rollback, scheduled verification, richer TUI replay, or new verifier types.

---

### Task 1: Core Verification Replay

**Files:**
- Modify: `packages/core/src/execute.ts`
- Modify: `packages/core/test/execute.test.ts`

- [ ] **Step 1: Write the failing core test**

Add this test block to `packages/core/test/execute.test.ts`:

```ts
describe("verifyStoredPlan", () => {
  it("reruns stored verifications and records run.verified for the original run", async () => {
    const audit = createMemoryAuditRecorder();
    const result = await verifyStoredPlan({
      originalRunId: "run_original",
      plan: basePlan,
      audit,
      verifyDeps: { runCommand: async () => ({ stdout: "", stderr: "", exitCode: 0 }) },
    });

    expect(result.originalRunId).toBe("run_original");
    expect(result.verificationResults).toHaveLength(1);
    expect(result.verificationResults[0].ok).toBe(true);
    expect(audit.events()).toEqual([
      {
        type: "run.verified",
        at: expect.any(String),
        payload: { runId: "run_original", results: result.verificationResults },
      },
    ]);
  });
});
```

Update the import:

```ts
import { executePlan, rollbackPlan, verifyStoredPlan } from "../src/index";
```

- [ ] **Step 2: Run the core test and verify RED**

Run:

```bash
pnpm --filter @opsforge/core test -- --runInBand packages/core/test/execute.test.ts
```

Expected: FAIL because `verifyStoredPlan` is not exported.

- [ ] **Step 3: Implement the minimal core use case**

Add to `packages/core/src/execute.ts`:

```ts
export interface VerifyStoredPlanInput {
  originalRunId: string;
  plan: Plan;
  audit: AuditRecorder;
  verifyDeps: VerifyDeps;
}

export interface VerifyStoredPlanResult {
  originalRunId: string;
  verificationResults: VerificationResult[];
  auditEvents: ReturnType<AuditRecorder["events"]>;
}

export const verifyStoredPlan = async (input: VerifyStoredPlanInput): Promise<VerifyStoredPlanResult> => {
  const verificationResults = await verifyPlan(input.plan.verifications, input.verifyDeps);
  input.audit.record({ type: "run.verified", at: now(), payload: { runId: input.originalRunId, results: verificationResults } });

  return {
    originalRunId: input.originalRunId,
    verificationResults,
    auditEvents: input.audit.events(),
  };
};
```

- [ ] **Step 4: Run the core test and verify GREEN**

Run:

```bash
pnpm --filter @opsforge/core test -- --runInBand packages/core/test/execute.test.ts
```

Expected: PASS.

---

### Task 2: CLI Verify Command

**Files:**
- Modify: `apps/cli/src/commands/apply.ts`
- Create: `apps/cli/src/commands/verify.ts`
- Modify: `apps/cli/src/index.ts`
- Create: `apps/cli/test/verify.test.ts`

- [ ] **Step 1: Write the failing CLI tests**

Create `apps/cli/test/verify.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryAuditRecorder, type AuditRunDetail, type AuditStore } from "@opsforge/audit";
import type { Plan } from "@opsforge/dsl";
import { buildVerifyCommand, formatVerifyResult } from "../src/commands/verify";

const plan: Plan = {
  id: "plan_1",
  title: "Install nginx",
  intent: "install",
  risk: "L1",
  createdAt: "2026-06-23T00:00:00Z",
  prechecks: [],
  steps: [{ type: "package-install", name: "nginx" }],
  verifications: [{ type: "smoke-test", cmd: "nginx -v", expectExit: 0 }],
  rollback: [],
  explanation: [],
};

const detail: AuditRunDetail = {
  runId: "run_original",
  planId: "plan_1",
  risk: "L1",
  status: "completed",
  startedAt: "2026-06-23T00:00:01Z",
  endedAt: "2026-06-23T00:00:02Z",
  stepCount: 1,
  plan,
  events: [],
  steps: [],
};

const createFakeAuditStore = (run: AuditRunDetail | undefined): AuditStore => {
  const memory = createMemoryAuditRecorder();
  return {
    ...memory,
    listRuns: () => [],
    showRun: (runId) => (runId === run?.runId ? run : undefined),
    recordStepArtifacts: () => ({ stdoutPath: "stdout.txt", stderrPath: "stderr.txt" }),
    close: () => {},
  };
};

beforeEach(() => {
  process.exitCode = undefined;
});

describe("buildVerifyCommand", () => {
  it("reruns verifications from the plan stored for a prior run", async () => {
    const writes: string[] = [];
    const command = buildVerifyCommand({
      write: (text) => writes.push(text),
      auditStore: createFakeAuditStore(detail),
      verifyDeps: { runCommand: async () => ({ stdout: "", stderr: "", exitCode: 0 }) },
    });

    await command.parseAsync(["run_original"], { from: "user" });

    expect(writes[0]).toContain("OpsForge verify");
    expect(writes[0]).toContain("Original run:       run_original");
    expect(writes[0]).toContain("Verifications:      1");
    expect(writes[0]).toContain("1. ok smoke-test exited 0");
  });

  it("reports a missing stored plan without throwing", async () => {
    const writes: string[] = [];
    const command = buildVerifyCommand({
      write: (text) => writes.push(text),
      auditStore: createFakeAuditStore(undefined),
      verifyDeps: { runCommand: async () => ({ stdout: "", stderr: "", exitCode: 0 }) },
    });

    await command.parseAsync(["run_missing"], { from: "user" });

    expect(process.exitCode).toBe(1);
    expect(writes[0]).toContain("Verification plan not found for run: run_missing");
  });
});

describe("formatVerifyResult", () => {
  it("prints the original run and verification summary", () => {
    const output = formatVerifyResult({
      originalRunId: "run_original",
      verificationResults: [{ verification: { type: "smoke-test", cmd: "true" }, ok: true, message: "smoke-test exited 0" }],
      auditEvents: [],
    });

    expect(output).toContain("OpsForge verify");
    expect(output).toContain("Original run:       run_original");
    expect(output).toContain("Verifications:      1");
  });
});
```

- [ ] **Step 2: Run the CLI test and verify RED**

Run:

```bash
pnpm --filter @opsforge/cli test -- --runInBand apps/cli/test/verify.test.ts
```

Expected: FAIL because `apps/cli/src/commands/verify.ts` does not exist.

- [ ] **Step 3: Export reusable default verify dependencies**

In `apps/cli/src/commands/apply.ts`, export a function that wraps the existing command runner:

```ts
export const createDefaultVerifyDeps = (): VerifyDeps => ({
  runCommand: async (cmd) => defaultRunner({ shell: detectOs(process.platform) === "windows" ? "powershell" : "bash", argv: cmd, needsElevation: false, describe: `Verify ${cmd}` }),
  readFile: (path) => readFileFromDisk(path),
});
```

Add `VerifyDeps` to the verifier imports if needed.

- [ ] **Step 4: Implement the verify command**

Create `apps/cli/src/commands/verify.ts` with:

```ts
import { Command } from "commander";
import { createSqliteAuditStore, resolveOpsForgePaths, type AuditStore } from "@opsforge/audit";
import { loadConfig, type OpsForgeConfig } from "@opsforge/config";
import { verifyStoredPlan, type VerifyStoredPlanResult } from "@opsforge/core";
import type { VerifyDeps } from "@opsforge/verifier";
import { createDefaultVerifyDeps } from "./apply";

export interface BuildVerifyCommandDeps {
  auditStore?: AuditStore;
  config?: OpsForgeConfig;
  verifyDeps?: VerifyDeps;
  write?: (text: string) => void;
}

const createStore = (deps: BuildVerifyCommandDeps): { store: AuditStore; shouldClose: boolean } => {
  if (deps.auditStore) return { store: deps.auditStore, shouldClose: false };
  return {
    store: createSqliteAuditStore(resolveOpsForgePaths(deps.config ?? loadConfig())),
    shouldClose: true,
  };
};

const verificationName = (result: VerifyStoredPlanResult["verificationResults"][number]): string => result.verification.type;

export const formatVerifyResult = (result: VerifyStoredPlanResult): string => [
  "OpsForge verify",
  `  Original run:       ${result.originalRunId}`,
  `  Verifications:      ${result.verificationResults.length}`,
  ...result.verificationResults.map((verification, index) =>
    `    ${index + 1}. ${verification.ok ? "ok" : "failed"} ${verificationName(verification)} ${verification.message}`,
  ),
].join("\n");

export const buildVerifyCommand = (deps: BuildVerifyCommandDeps = {}): Command => {
  const write = deps.write ?? ((text: string) => console.log(text));
  const command = new Command("verify");

  command
    .description("重跑一次已审计 run 的验证步骤")
    .argument("<runId>", "Run ID to verify")
    .option("--json", "输出 JSON", false)
    .action(async (runId: string, options: { json: boolean }) => {
      const { store, shouldClose } = createStore(deps);
      try {
        const detail = store.showRun(runId);
        if (!detail?.plan) {
          write(options.json ? JSON.stringify({ error: `Verification plan not found for run: ${runId}` }, null, 2) : `Verification plan not found for run: ${runId}`);
          process.exitCode = 1;
          return;
        }

        const result = await verifyStoredPlan({
          originalRunId: runId,
          plan: detail.plan,
          audit: store,
          verifyDeps: deps.verifyDeps ?? createDefaultVerifyDeps(),
        });
        write(options.json ? JSON.stringify(result, null, 2) : formatVerifyResult(result));
        if (result.verificationResults.some((verification) => !verification.ok)) process.exitCode = 1;
      } finally {
        if (shouldClose) store.close();
      }
    });

  return command;
};
```

- [ ] **Step 5: Register the command**

In `apps/cli/src/index.ts`, import and register:

```ts
import { buildVerifyCommand } from "./commands/verify";
```

```ts
program.addCommand(buildVerifyCommand());
```

- [ ] **Step 6: Run CLI test and verify GREEN**

Run:

```bash
pnpm --filter @opsforge/cli test -- --runInBand apps/cli/test/verify.test.ts
```

Expected: PASS.

---

### Task 3: Documentation And Design Check

**Files:**
- Modify: `README.md`
- Modify: `docs/implementation-status.md`

- [ ] **Step 1: Update README CLI examples**

Add `opsforge verify <run_id>` to the available CLI command list and include one short example:

```bash
opsforge verify run_plan_1_20260623
opsforge verify run_plan_1_20260623 --json
```

- [ ] **Step 2: Update implementation status**

Add Plan 9 to the implemented plans list and document:

```md
## Delivered In Plan 9

- `@opsforge/core`
  - `verifyStoredPlan()` reruns stored Plan verifications and records a fresh `run.verified` event against the original run ID.

- `@opsforge/cli`
  - `opsforge verify <run_id>` loads the Plan stored in audit history and replays `plan.verifications`.
  - `opsforge verify <run_id> --json` emits the same result payload for scripts.
```

Update §7.2 CLI mode from "`verify` remains" to "`verify` exists". Remove "CLI `verify` is not implemented" from Known Gaps and add "Verification replay is manual only; no scheduled or automatic verification loop yet."

- [ ] **Step 3: Check against design**

Re-read spec §4, §7.2, and §8. Confirm the implementation:

- Uses stored Plan JSON from audit history.
- Replays only `plan.verifications`, not mutation steps.
- Records `run.verified` audit evidence.
- Returns non-zero exit code when any verification fails or no Plan is found.

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

- [ ] **Step 4: Review git diff**

Run:

```bash
git status --short --branch
git diff -- docs/superpowers/specs/2026-06-23-opsforge-local-ops-agent-design.md
git diff -- README.md docs/implementation-status.md packages/core/src/execute.ts packages/core/test/execute.test.ts apps/cli/src/commands/apply.ts apps/cli/src/commands/verify.ts apps/cli/src/index.ts apps/cli/test/verify.test.ts
```

Expected: spec unchanged; docs and implementation match Plan 9.

- [ ] **Step 5: Commit and push main**

Run:

```bash
git add README.md docs/implementation-status.md docs/superpowers/plans/2026-06-23-opsforge-plan-9-verify-command.md packages/core/src/execute.ts packages/core/test/execute.test.ts apps/cli/src/commands/apply.ts apps/cli/src/commands/verify.ts apps/cli/src/index.ts apps/cli/test/verify.test.ts
git commit -m "feat: add verify command"
git push origin main
git rev-parse HEAD
git rev-parse origin/main
```

Expected: both hashes match after push. `docs/pi_soul.md` remains untracked and untouched.
