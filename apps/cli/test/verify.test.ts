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
      verificationResults: [
        { verification: { type: "smoke-test", cmd: "true" }, ok: true, message: "smoke-test exited 0" },
      ],
      auditEvents: [],
    });

    expect(output).toContain("OpsForge verify");
    expect(output).toContain("Original run:       run_original");
    expect(output).toContain("Verifications:      1");
  });
});
