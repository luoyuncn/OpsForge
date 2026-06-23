import { describe, expect, it } from "vitest";
import type { AuditStore } from "@opsforge/audit";
import { buildAuditCommand, formatAuditList, formatAuditShow } from "../src/commands/audit";

describe("formatAuditList", () => {
  it("prints a stable empty state", () => {
    expect(formatAuditList([])).toBe("No audit runs found");
  });

  it("includes run identity, risk, status, and step count", () => {
    expect(
      formatAuditList([
        {
          runId: "run_1",
          planId: "plan_1",
          risk: "L1",
          status: "completed",
          startedAt: "2026-06-23T00:00:00Z",
          endedAt: "2026-06-23T00:00:03Z",
          stepCount: 2,
        },
      ]),
    ).toContain("run_1  plan=plan_1  risk=L1  status=completed  steps=2");
  });
});

describe("formatAuditShow", () => {
  it("prints ordered event types and artifact paths", () => {
    const output = formatAuditShow({
      runId: "run_1",
      planId: "plan_1",
      risk: "L1",
      status: "completed",
      startedAt: "2026-06-23T00:00:00Z",
      endedAt: "2026-06-23T00:00:03Z",
      stepCount: 1,
      plan: {
        id: "plan_1",
        title: "Install nginx",
        intent: "install",
        osFamily: "linux",
        prechecks: [],
        steps: [{ type: "package-install", name: "nginx" }],
        verifications: [],
        rollback: [],
        risk: "L1",
        explanation: [],
        createdAt: "2026-06-23T00:00:00Z",
      },
      events: [
        { type: "plan.created", at: "2026-06-23T00:00:00Z", payload: { planId: "plan_1", intent: "install", risk: "L1" } },
        { type: "job.dispatched", at: "2026-06-23T00:00:01Z", payload: { runId: "run_1", planId: "plan_1" } },
        {
          type: "run.step.finished",
          at: "2026-06-23T00:00:02Z",
          payload: { runId: "run_1", step: { type: "package-install", name: "nginx" }, exitCode: 0 },
        },
      ],
      steps: [
        {
          stepIndex: 0,
          step: { type: "package-install", name: "nginx" },
          exitCode: 0,
          stdoutPath: "artifacts/run_1/step-0-stdout.txt",
          stderrPath: "artifacts/run_1/step-0-stderr.txt",
        },
      ],
    });

    expect(output).toContain("Audit report run_1");
    expect(output).toContain("Plan:    Install nginx (plan_1)");
    expect(output).toContain("1. 2026-06-23T00:00:00Z  plan.created");
    expect(output).toContain("2. 2026-06-23T00:00:01Z  job.dispatched");
    expect(output).toContain("3. 2026-06-23T00:00:02Z  run.step.finished");
    expect(output).toContain("stdout: artifacts/run_1/step-0-stdout.txt");
    expect(output).toContain("stderr: artifacts/run_1/step-0-stderr.txt");
  });
});

describe("buildAuditCommand", () => {
  it("exports a rich audit report as JSON", async () => {
    const writes: string[] = [];
    const files: Array<{ path: string; contents: string }> = [];
    const auditStore: AuditStore = {
      record: () => {},
      events: () => [],
      listRuns: () => [],
      showRun: (runId) => ({
        runId,
        planId: "plan_1",
        risk: "L1",
        status: "completed",
        startedAt: "2026-06-23T00:00:00Z",
        stepCount: 0,
        plan: {
          id: "plan_1",
          title: "Install nginx",
          intent: "install",
          osFamily: "linux",
          prechecks: [],
          steps: [],
          verifications: [],
          rollback: [],
          risk: "L1",
          explanation: [],
          createdAt: "2026-06-23T00:00:00Z",
        },
        events: [],
        steps: [],
      }),
      recordStepArtifacts: () => ({ stdoutPath: "stdout.txt", stderrPath: "stderr.txt" }),
      close: () => {},
    };

    const command = buildAuditCommand({
      auditStore,
      write: (text) => writes.push(text),
      writeFile: async (path, contents) => {
        files.push({ path, contents });
      },
    });

    await command.parseAsync(["export", "run_1", "--out", "report.json"], { from: "user" });

    expect(writes).toEqual(["Exported audit report to report.json"]);
    expect(files[0]?.path).toBe("report.json");
    expect(JSON.parse(files[0]?.contents ?? "{}").summary.title).toBe("Install nginx");
  });
});
