import { describe, expect, it } from "vitest";
import { createMemoryAuditRecorder } from "@opsforge/audit";
import type { Executor, HostFacts } from "@opsforge/executor-base";
import type { Plan } from "@opsforge/dsl";
import { executePlan, rollbackPlan, verifyStoredPlan } from "../src/index";

const facts: HostFacts = {
  osFamily: "linux",
  arch: "x64",
  isElevated: false,
  packageManagers: ["apt"],
};

const executor: Executor = {
  osFamily: "linux",
  detect: async () => facts,
  compile: (step) => ({ shell: "bash", argv: ["echo", step.type], needsElevation: false, describe: `Compile ${step.type}` }),
  run: async (step, command, runner, opts) => {
    const raw = await runner(command);
    return {
      step,
      command,
      stdout: raw.stdout,
      stderr: raw.stderr,
      exitCode: raw.exitCode,
      startedAt: "start",
      endedAt: "end",
      truncated: Boolean(opts?.maxOutputBytes && raw.stdout.length > opts.maxOutputBytes),
    };
  },
};

const basePlan: Plan = {
  id: "plan_1",
  title: "Install nginx",
  intent: "install",
  risk: "L1",
  createdAt: "2026-06-23T00:00:00Z",
  prechecks: [],
  steps: [{ type: "package-install", name: "nginx" }],
  verifications: [{ type: "smoke-test", cmd: "nginx -v" }],
  rollback: [],
  explanation: [],
};

describe("executePlan", () => {
  it("dry-runs by classifying, gating, compiling, auditing, and not calling runner", async () => {
    const audit = createMemoryAuditRecorder();
    let runnerCalls = 0;
    const result = await executePlan({
      plan: basePlan,
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
      verifyDeps: {},
    });

    expect(result.gate.allowed).toBe(true);
    expect(result.commands).toHaveLength(1);
    expect(result.stepResults).toEqual([]);
    expect(runnerCalls).toBe(0);
    expect(audit.events().map((event) => event.type)).toEqual([
      "plan.created",
      "plan.classified",
      "gate.confirmed",
      "job.dispatched",
      "run.dry_run.finished",
    ]);
  });

  it("denies L2 plans without yes", async () => {
    const result = await executePlan({
      plan: { ...basePlan, steps: [{ type: "file-write", path: "/tmp/a", content: "x" }] },
      executor,
      facts,
      audit: createMemoryAuditRecorder(),
      dryRun: false,
      yes: false,
      riskMax: "L3",
      allowShell: false,
      runner: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
      verifyDeps: {},
    });

    expect(result.gate.allowed).toBe(false);
    expect(result.commands).toEqual([]);
    expect(result.stepResults).toEqual([]);
  });

  it("executes allowed plans, verifies, and records ordered audit events", async () => {
    const audit = createMemoryAuditRecorder();
    const result = await executePlan({
      plan: basePlan,
      executor,
      facts,
      audit,
      dryRun: false,
      yes: true,
      riskMax: "L3",
      allowShell: false,
      runner: async () => ({ stdout: "ok", stderr: "", exitCode: 0 }),
      verifyDeps: { runCommand: async () => ({ stdout: "", stderr: "", exitCode: 0 }) },
    });

    expect(result.stepResults).toHaveLength(1);
    expect(result.verificationResults[0].ok).toBe(true);
    expect(audit.events().map((event) => event.type)).toEqual([
      "plan.created",
      "plan.classified",
      "gate.confirmed",
      "job.dispatched",
      "run.step.started",
      "run.step.finished",
      "run.verified",
    ]);
  });
});

describe("rollbackPlan", () => {
  it("dry-runs rollback steps without calling the runner", async () => {
    const audit = createMemoryAuditRecorder();
    let runnerCalls = 0;
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
      verifyDeps: {},
    });

    expect(runnerCalls).toBe(0);
    expect(result.commands[0].argv).toEqual(["echo", "package-remove"]);
    expect(result.stepResults).toEqual([]);
    expect(audit.events().map((event) => event.type)).toEqual([
      "plan.created",
      "plan.classified",
      "gate.confirmed",
      "run.rollback.started",
      "job.dispatched",
      "run.dry_run.finished",
      "run.rollback.finished",
    ]);
  });

  it("executes rollback steps and records rollback completion", async () => {
    const audit = createMemoryAuditRecorder();
    const result = await rollbackPlan({
      plan: { ...basePlan, rollback: [{ type: "package-remove", name: "nginx" }] },
      originalRunId: "run_original",
      executor,
      facts,
      audit,
      dryRun: false,
      yes: true,
      riskMax: "L3",
      allowShell: false,
      runner: async () => ({ stdout: "removed", stderr: "", exitCode: 0 }),
      verifyDeps: {},
    });

    expect(result.stepResults).toHaveLength(1);
    expect(result.stepResults[0].step).toEqual({ type: "package-remove", name: "nginx" });
    expect(audit.events().map((event) => event.type)).toContain("run.rollback.finished");
  });
});

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
