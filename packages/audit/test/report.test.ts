import { describe, expect, it } from "vitest";
import type { AuditRunDetail } from "../src/summary";
import { createAuditRunReport, formatAuditRunReport } from "../src/index";

const detail: AuditRunDetail = {
  runId: "run_1",
  planId: "plan_1",
  risk: "L2",
  status: "rolled_back",
  startedAt: "2026-06-23T00:00:00Z",
  endedAt: "2026-06-23T00:00:05Z",
  stepCount: 1,
  plan: {
    id: "plan_1",
    title: "Install nginx",
    intent: "install",
    osFamily: "linux",
    prechecks: [],
    steps: [{ type: "package-install", name: "nginx" }],
    verifications: [{ type: "service-status", name: "nginx", expect: "active" }],
    rollback: [{ type: "package-remove", name: "nginx" }],
    risk: "L2",
    explanation: ["Install nginx safely."],
    createdAt: "2026-06-23T00:00:00Z",
  },
  events: [
    { type: "plan.created", at: "2026-06-23T00:00:00Z", payload: { planId: "plan_1", intent: "install", risk: "L2" } },
    { type: "job.dispatched", at: "2026-06-23T00:00:01Z", payload: { runId: "run_1", planId: "plan_1" } },
    {
      type: "run.step.finished",
      at: "2026-06-23T00:00:02Z",
      payload: { runId: "run_1", step: { type: "package-install", name: "nginx" }, exitCode: 0 },
    },
    { type: "run.verified", at: "2026-06-23T00:00:03Z", payload: { runId: "run_1", results: [{ ok: false }] } },
    { type: "run.rollback.started", at: "2026-06-23T00:00:04Z", payload: { runId: "run_1" } },
    { type: "run.rollback.finished", at: "2026-06-23T00:00:05Z", payload: { runId: "run_1", results: [] } },
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
};

describe("createAuditRunReport", () => {
  it("summarizes plan, events, steps, artifacts, verification, and rollback state", () => {
    const report = createAuditRunReport(detail);

    expect(report.summary).toEqual({
      runId: "run_1",
      planId: "plan_1",
      title: "Install nginx",
      intent: "install",
      risk: "L2",
      status: "rolled_back",
      startedAt: "2026-06-23T00:00:00Z",
      endedAt: "2026-06-23T00:00:05Z",
      stepCount: 1,
    });
    expect(report.steps[0]).toMatchObject({
      stepIndex: 0,
      label: "package-install nginx",
      exitCode: 0,
      stdoutPath: "artifacts/run_1/step-0-stdout.txt",
    });
    expect(report.eventTimeline.map((event) => event.type)).toEqual([
      "plan.created",
      "job.dispatched",
      "run.step.finished",
      "run.verified",
      "run.rollback.started",
      "run.rollback.finished",
    ]);
    expect(report.artifactCount).toBe(2);
    expect(report.verificationEventCount).toBe(1);
    expect(report.rollback.status).toBe("finished");
    expect(report.rollback.available).toBe(true);
  });
});

describe("formatAuditRunReport", () => {
  it("renders a deterministic human report", () => {
    const output = formatAuditRunReport(createAuditRunReport(detail));

    expect(output).toContain("Audit report run_1");
    expect(output).toContain("Plan:    Install nginx (plan_1)");
    expect(output).toContain("Intent:  install");
    expect(output).toContain("Rollback: finished available=true");
    expect(output).toContain("1. package-install nginx exit=0");
    expect(output).toContain("stdout: artifacts/run_1/step-0-stdout.txt");
    expect(output).toContain("6. 2026-06-23T00:00:05Z  run.rollback.finished");
  });
});
