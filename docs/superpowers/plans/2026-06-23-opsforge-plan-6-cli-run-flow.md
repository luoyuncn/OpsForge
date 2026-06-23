# OpsForge Plan 6 — CLI Run Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `opsforge run "<NL>"` as the first composed natural-language workflow: planner output feeds the existing gated execution pipeline, with `--dry-run` proving the flow without mutating the host.

**Architecture:** Extract the already-tested apply execution path into a reusable `executeParsedPlan()` helper that accepts a parsed DSL Plan. Keep `apply` responsible for reading a plan file, and make a new `run` command responsible for natural-language planning plus calling the same execution helper. This keeps audit, risk gate, compiler, guard, executor, and verifier behavior identical between `apply` and `run`.

**Tech Stack:** TypeScript, commander, vitest, `@opsforge/planner`, `@opsforge/core`, `@opsforge/audit`, `@opsforge/dsl`, existing local executors.

**Spec Coverage:** `docs/superpowers/specs/2026-06-23-opsforge-local-ops-agent-design.md` §4 full lifecycle pipeline, §6 planner/provider layer, §7.2 `opsforge run "<NL>"`, §8 audit, §11 no-host-mutation tests.

**Branch:** `main` (explicit user instruction for this goal).

---

## File Structure

```text
apps/cli/
├─ src/commands/apply.ts          # expose executeParsedPlan(plan, options, deps)
├─ src/commands/run.ts            # new NL -> Plan -> execute command
├─ src/index.ts                   # register run command
└─ test/run.test.ts               # command-level tests
docs/
├─ implementation-status.md
└─ README.md
```

---

## Task 1: Reusable Parsed Plan Execution

**Files:**
- Modify: `apps/cli/src/commands/apply.ts`
- Existing tests: `apps/cli/test/apply.test.ts`

- [ ] **Step 1: Refactor `apply.ts` without changing behavior**

Modify `apps/cli/src/commands/apply.ts` so `buildApplyCommand()` reads and parses the file, then delegates to this new helper:

```ts
export interface ExecutePlanDeps {
  platform?: NodeJS.Platform;
  facts?: HostFacts;
  which?: WhichRunner;
  runner?: CommandRunner;
  auditStore?: AuditStore;
  config?: OpsForgeConfig;
}

export const executeParsedPlan = async (
  plan: Plan,
  options: ApplyOptions,
  deps: ExecutePlanDeps = {},
): Promise<ApplyResult> => {
  const hostOs = detectOs(deps.platform ?? process.platform);
  const facts = deps.facts ?? factsFromHost(plan.osFamily ?? hostOs, deps.which ?? systemWhich);
  const createdAuditStore = deps.auditStore === undefined;
  const audit = deps.auditStore ?? createSqliteAuditStore(resolveOpsForgePaths(deps.config ?? loadConfig()));

  try {
    const result = await executePlan({
      plan,
      executor: executorForFacts(facts),
      facts,
      audit,
      dryRun: options.dryRun,
      yes: options.yes,
      riskMax: options.riskMax,
      allowShell: options.allowShell,
      runner: deps.runner ?? defaultRunner,
      verifyDeps: {},
    });

    for (const [index, stepResult] of result.stepResults.entries()) {
      audit.recordStepArtifacts(result.runId, index, stepResult.stdout, stepResult.stderr);
    }

    return { ...result, dryRun: options.dryRun };
  } finally {
    if (createdAuditStore) audit.close();
  }
};
```

Keep `BuildApplyDeps` as:

```ts
export interface BuildApplyDeps extends ExecutePlanDeps {
  readFile?: (path: string) => Promise<string>;
}
```

Update `buildApplyCommand()` to call:

```ts
return executeParsedPlan(plan, options, deps);
```

- [ ] **Step 2: Verify apply still passes**

Run:

```bash
pnpm --filter @opsforge/cli exec vitest run test/apply.test.ts
pnpm --filter @opsforge/cli typecheck
```

Expected: apply tests and CLI typecheck pass with no behavior change.

---

## Task 2: CLI `opsforge run`

**Files:**
- Create: `apps/cli/src/commands/run.ts`
- Create: `apps/cli/test/run.test.ts`
- Modify: `apps/cli/src/index.ts`

- [ ] **Step 1: Write failing run command tests**

Create `apps/cli/test/run.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createMemoryAuditRecorder, type AuditStore } from "@opsforge/audit";
import type { HostFacts } from "@opsforge/executor-base";
import { buildRunCommand, formatRunResult } from "../src/commands/run";

const facts: HostFacts = {
  osFamily: "linux",
  arch: "x64",
  isElevated: false,
  packageManagers: ["apt"],
};

const createFakeAuditStore = (): AuditStore & { artifactWrites: Array<{ runId: string; stepIndex: number; stdout: string; stderr: string }> } => {
  const memory = createMemoryAuditRecorder();
  const artifactWrites: Array<{ runId: string; stepIndex: number; stdout: string; stderr: string }> = [];

  return {
    ...memory,
    artifactWrites,
    listRuns: () => [],
    showRun: () => undefined,
    recordStepArtifacts: (runId, stepIndex, stdout, stderr) => {
      artifactWrites.push({ runId, stepIndex, stdout, stderr });
      return { stdoutPath: `${runId}-${stepIndex}.out`, stderrPath: `${runId}-${stepIndex}.err` };
    },
    close: () => {},
  };
};

describe("buildRunCommand", () => {
  it("plans and dry-runs a natural-language prompt without executing the runner", async () => {
    const writes: string[] = [];
    let runnerCalls = 0;
    const command = buildRunCommand({
      write: (text) => writes.push(text),
      now: () => "2026-06-23T00:00:00Z",
      planId: () => "plan_run_1",
      platform: "linux",
      facts,
      auditStore: createFakeAuditStore(),
      runner: async () => {
        runnerCalls += 1;
        return { stdout: "", stderr: "", exitCode: 0 };
      },
    });

    await command.parseAsync(["node", "test", "install nginx", "--dry-run"], { from: "user" });

    expect(runnerCalls).toBe(0);
    expect(writes[0]).toContain("OpsForge run");
    expect(writes[0]).toContain("Plan ID:            plan_run_1");
    expect(writes[0]).toContain("Dry run: true");
    expect(writes[0]).toContain("apt-get install -y nginx");
  });

  it("emits JSON containing both the generated plan and execution result", async () => {
    const writes: string[] = [];
    const command = buildRunCommand({
      write: (text) => writes.push(text),
      now: () => "2026-06-23T00:00:00Z",
      planId: () => "plan_run_json",
      platform: "linux",
      facts,
      auditStore: createFakeAuditStore(),
      runner: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    });

    await command.parseAsync(["node", "test", "install nginx", "--dry-run", "--json"], { from: "user" });

    const parsed = JSON.parse(writes[0]);
    expect(parsed.plan.id).toBe("plan_run_json");
    expect(parsed.result.dryRun).toBe(true);
    expect(parsed.result.commands[0].argv).toEqual(["apt-get", "install", "-y", "nginx"]);
  });
});

describe("formatRunResult", () => {
  it("prints the generated plan and execution summary together", () => {
    const output = formatRunResult({
      plan: {
        id: "plan_1",
        title: "Install nginx",
        intent: "install",
        risk: "L1",
        steps: [{ type: "package-install", name: "nginx" }],
        verifications: [],
        rollback: [],
        explanation: [],
        createdAt: "2026-06-23T00:00:00Z",
        prechecks: [],
      },
      result: {
        runId: "run_1",
        risk: "L1",
        gate: { allowed: true, reason: "risk gate passed" },
        commands: [],
        stepResults: [],
        verificationResults: [],
        auditEvents: [],
        dryRun: true,
      },
    });

    expect(output).toContain("OpsForge run");
    expect(output).toContain("Plan ID:            plan_1");
    expect(output).toContain("Run ID:             run_1");
  });
});
```

Run:

```bash
pnpm --filter @opsforge/cli exec vitest run test/run.test.ts
```

Expected: FAIL because `apps/cli/src/commands/run.ts` does not exist.

- [ ] **Step 2: Implement run command**

Create `apps/cli/src/commands/run.ts`:

```ts
import { Command } from "commander";
import type { Plan } from "@opsforge/dsl";
import { buildPlanFromPrompt, createMockPlanProvider, type PlanProvider } from "@opsforge/planner";
import {
  executeParsedPlan,
  formatApplyResult,
  parseRiskMax,
  type ApplyOptions,
  type ApplyResult,
  type ExecutePlanDeps,
} from "./apply";

export interface BuildRunCommandDeps extends ExecutePlanDeps {
  provider?: PlanProvider;
  write?: (text: string) => void;
  now?: () => string;
  planId?: () => string;
}

export interface RunCommandResult {
  plan: Plan;
  result: ApplyResult;
}

export const formatRunResult = ({ plan, result }: RunCommandResult): string => [
  "OpsForge run",
  `  Plan ID:            ${plan.id}`,
  `  Plan title:         ${plan.title}`,
  "",
  formatApplyResult(result),
].join("\n");

export const buildRunCommand = (deps: BuildRunCommandDeps = {}): Command => {
  const write = deps.write ?? ((text: string) => console.log(text));
  const command = new Command("run");

  command
    .description("根据自然语言生成 Plan 并执行")
    .argument("<prompt>", "Natural language operation goal")
    .option("--dry-run", "只生成、编译和检查，不执行", false)
    .option("-y, --yes", "批准 L2/L3 风险门禁", false)
    .option("--json", "输出 JSON", false)
    .option("--risk-max <level>", "允许的最高风险等级", "L3")
    .option("--allow-shell", "允许 shell 逃生舱步骤", false)
    .action(async (prompt: string, options: { dryRun: boolean; yes: boolean; json: boolean; riskMax: string; allowShell: boolean }) => {
      const plan = await buildPlanFromPrompt({
        prompt,
        provider: deps.provider ?? createMockPlanProvider(),
        now: deps.now,
        planId: deps.planId,
      });
      const applyOptions: ApplyOptions = {
        dryRun: options.dryRun,
        yes: options.yes,
        json: options.json,
        riskMax: parseRiskMax(options.riskMax),
        allowShell: options.allowShell,
      };
      const result = await executeParsedPlan(plan, applyOptions, deps);
      const payload = { plan, result };
      write(options.json ? JSON.stringify(payload, null, 2) : formatRunResult(payload));
      if (!result.gate.allowed) process.exitCode = 1;
    });

  return command;
};
```

- [ ] **Step 3: Register command**

Modify `apps/cli/src/index.ts`:

```ts
import { buildRunCommand } from "./commands/run";
...
program.addCommand(buildRunCommand());
```

- [ ] **Step 4: Verify run command**

Run:

```bash
pnpm --filter @opsforge/cli exec vitest run test/run.test.ts test/apply.test.ts
pnpm --filter @opsforge/cli typecheck
pnpm --filter @opsforge/cli build
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/commands/apply.ts apps/cli/src/commands/run.ts apps/cli/src/index.ts apps/cli/test/run.test.ts
git commit -m "feat(cli): add natural language run command"
```

---

## Task 3: Documentation, Alignment, Full Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/implementation-status.md`

- [ ] **Step 1: Update implementation status**

Update `docs/implementation-status.md`:

- Add Plan 6 to implemented plans.
- Add "Delivered In Plan 6" with `opsforge run "<NL>"`, `--dry-run`, `--json`, shared execution path, and audit/gate reuse.
- Update §7.2 CLI row to include `run`.
- Remove `run` from the CLI known gaps while keeping `verify`, `rollback`, and `config`.
- Recommend Plan 7 as provider configuration plus OpenAI-compatible adapter, or rollback orchestration.

- [ ] **Step 2: Update README commands**

Add:

```bash
node apps/cli/dist/index.js run "install nginx" --dry-run
node apps/cli/dist/index.js run "install nginx" --dry-run --json
```

- [ ] **Step 3: Full verification**

Run:

```bash
pnpm build
pnpm test
pnpm typecheck
node apps/cli/dist/index.js run "install nginx" --dry-run
node apps/cli/dist/index.js run "install nginx" --dry-run --json
node apps/cli/dist/index.js plan "install nginx" --out .opsforge-tmp/plan-nginx.json
node apps/cli/dist/index.js apply .opsforge-tmp/plan-nginx.json --dry-run
```

Expected:
- all pnpm commands exit 0.
- `run --dry-run` prints `OpsForge run`, generated Plan ID, dry-run status, and compiled nginx install command.
- `run --dry-run --json` emits JSON containing `plan` and `result`.
- existing saved-plan `apply --dry-run` still works.

- [ ] **Step 4: Commit and push**

```bash
git add README.md docs/implementation-status.md
git commit -m "docs: record Plan 6 run command status"
git push origin main
```

---

## Done Definition

- `opsforge run "<NL>"` is registered as a CLI subcommand.
- `run` generates a schema-valid Plan through the planner package.
- `run` reuses the same execution helper as `apply`.
- `run --dry-run` compiles and guards commands without executing host mutation commands.
- `run --json` returns both generated Plan and execution result.
- Existing `apply` behavior remains covered by tests.
- `pnpm build`, `pnpm test`, and `pnpm typecheck` pass.
- Docs state what Plan 6 implemented and keep remaining spec gaps explicit.

## Known Gaps After Plan 6

- `run` still uses the deterministic mock provider by default.
- Real provider configuration, OpenAI-compatible adapter, Anthropic/Google/Pi providers, JSON retry loops, Pi runtime, TUI, `verify`, `rollback`, `config`, and rollback orchestration remain future work.
