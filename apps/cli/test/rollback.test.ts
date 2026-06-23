import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryAuditRecorder, type AuditRunDetail, type AuditStore } from "@opsforge/audit";
import type { Plan } from "@opsforge/dsl";
import type { HostFacts } from "@opsforge/executor-base";
import { buildRollbackCommand, formatRollbackResult } from "../src/commands/rollback";

const facts: HostFacts = {
  osFamily: "linux",
  arch: "x64",
  isElevated: false,
  packageManagers: ["apt"],
};

const plan: Plan = {
  id: "plan_1",
  title: "Install nginx",
  intent: "install",
  risk: "L1",
  createdAt: "2026-06-23T00:00:00Z",
  prechecks: [],
  steps: [{ type: "package-install", name: "nginx" }],
  verifications: [],
  rollback: [{ type: "package-remove", name: "nginx" }],
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

describe("buildRollbackCommand", () => {
  it("dry-runs rollback steps from the plan stored for a prior run", async () => {
    const writes: string[] = [];
    let runnerCalls = 0;
    const command = buildRollbackCommand({
      write: (text) => writes.push(text),
      auditStore: createFakeAuditStore(detail),
      platform: "linux",
      facts,
      runner: async () => {
        runnerCalls += 1;
        return { stdout: "", stderr: "", exitCode: 0 };
      },
    });

    await command.parseAsync(["run_original", "--dry-run"], { from: "user" });

    expect(runnerCalls).toBe(0);
    expect(writes[0]).toContain("OpsForge rollback");
    expect(writes[0]).toContain("Original run:       run_original");
    expect(writes[0]).toContain("apt-get remove -y nginx");
  });

  it("reports a missing rollback plan without throwing", async () => {
    const writes: string[] = [];
    const command = buildRollbackCommand({
      write: (text) => writes.push(text),
      auditStore: createFakeAuditStore(undefined),
      platform: "linux",
      facts,
      runner: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    });

    await command.parseAsync(["run_missing", "--dry-run"], { from: "user" });

    expect(process.exitCode).toBe(1);
    expect(writes[0]).toContain("Rollback plan not found for run: run_missing");
  });
});

describe("formatRollbackResult", () => {
  it("prints the original run and rollback summary", () => {
    const output = formatRollbackResult("run_original", {
      runId: "run_rollback",
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
    });

    expect(output).toContain("OpsForge rollback");
    expect(output).toContain("Original run:       run_original");
    expect(output).toContain("Rollback run ID:    run_rollback");
  });
});
