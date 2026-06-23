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

  it("uses a configured provider resolver before executing the generated plan", async () => {
    const writes: string[] = [];
    const requested: string[] = [];
    const command = buildRunCommand({
      write: (text) => writes.push(text),
      resolveProvider: async (options) => {
        requested.push(options.provider);
        return {
          name: "configured-test",
          buildPlan: async () => ({
            title: "Install redis",
            intent: "install",
            steps: [{ type: "package-install", name: "redis" }],
            risk: "L1",
          }),
        };
      },
      now: () => "2026-06-23T00:00:00Z",
      planId: () => "plan_run_configured",
      platform: "linux",
      facts,
      auditStore: createFakeAuditStore(),
      runner: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    });

    await command.parseAsync(["node", "test", "install redis", "--provider", "configured", "--dry-run", "--json"], { from: "user" });

    const parsed = JSON.parse(writes[0]);
    expect(requested).toEqual(["configured"]);
    expect(parsed.plan.steps[0]).toEqual({ type: "package-install", name: "redis" });
    expect(parsed.result.commands[0].argv).toEqual(["apt-get", "install", "-y", "redis"]);
  });

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
      rollback: {
        autoExecuted: false,
        available: false,
        reason: "rollback not needed",
      },
      auditEvents: [],
      dryRun: true,
    },
    });

    expect(output).toContain("OpsForge run");
    expect(output).toContain("Plan ID:            plan_1");
    expect(output).toContain("Run ID:             run_1");
  });
});
