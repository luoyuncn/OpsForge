import { describe, expect, it } from "vitest";
import { buildApplyCommand, formatApplyResult } from "../src/commands/apply";
import { createMemoryAuditRecorder, type AuditStore } from "@opsforge/audit";
import type { HostFacts } from "@opsforge/executor-base";

const facts: HostFacts = {
  osFamily: "linux",
  arch: "x64",
  isElevated: false,
  packageManagers: ["apt"],
};

const installPlan = {
  id: "plan_1",
  title: "Install nginx",
  intent: "install",
  steps: [{ type: "package-install", name: "nginx" }],
  risk: "L1",
  createdAt: "2026-06-23T00:00:00Z",
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

describe("buildApplyCommand", () => {
  it("dry-runs a JSON plan and does not execute the runner", async () => {
    let runnerCalls = 0;
    const apply = buildApplyCommand({
      readFile: async () => JSON.stringify(installPlan),
      platform: "linux",
      facts,
      auditStore: createFakeAuditStore(),
      runner: async () => {
        runnerCalls += 1;
        return { stdout: "", stderr: "", exitCode: 0 };
      },
    });

    const result = await apply("plan.json", { dryRun: true, yes: false, json: false, riskMax: "L3", allowShell: false });
    expect(runnerCalls).toBe(0);
    expect(result.commands[0].argv).toEqual(["apt-get", "install", "-y", "nginx"]);
    expect(formatApplyResult(result)).toContain("Dry run: true");
  });

  it("denies risky file writes without yes", async () => {
    const apply = buildApplyCommand({
      readFile: async () =>
        JSON.stringify({
          ...installPlan,
          steps: [{ type: "file-write", path: "/tmp/a", content: "x" }],
          risk: "L2",
      }),
      platform: "linux",
      facts,
      auditStore: createFakeAuditStore(),
      runner: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    });

    const result = await apply("plan.json", { dryRun: false, yes: false, json: false, riskMax: "L3", allowShell: false });
    expect(result.gate.allowed).toBe(false);
    expect(result.stepResults).toEqual([]);
  });

  it("records dry-run audit events into an injected audit store", async () => {
    const auditStore = createFakeAuditStore();
    const apply = buildApplyCommand({
      readFile: async () => JSON.stringify(installPlan),
      platform: "linux",
      facts,
      auditStore,
      runner: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    });

    const result = await apply("plan.json", { dryRun: true, yes: false, json: false, riskMax: "L3", allowShell: false });

    expect(result.auditEvents.length).toBeGreaterThan(0);
    expect(auditStore.events().map((event) => event.type)).toEqual(result.auditEvents.map((event) => event.type));
  });

  it("records stdout and stderr artifacts for executed steps", async () => {
    const auditStore = createFakeAuditStore();
    const apply = buildApplyCommand({
      readFile: async () => JSON.stringify(installPlan),
      platform: "linux",
      facts,
      auditStore,
      runner: async () => ({ stdout: "installed", stderr: "note", exitCode: 0 }),
    });

    const result = await apply("plan.json", { dryRun: false, yes: true, json: false, riskMax: "L3", allowShell: false });

    expect(result.stepResults).toHaveLength(1);
    expect(auditStore.artifactWrites).toEqual([
      { runId: result.runId, stepIndex: 0, stdout: "installed", stderr: "note" },
    ]);
  });
});
