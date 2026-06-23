import { describe, expect, it } from "vitest";
import type { ExecutePlanResult } from "@opsforge/core";
import type { Plan } from "@opsforge/dsl";
import {
  createRuntimeActionController,
  createRuntimeSessionStatus,
  formatRuntimeEventSummary,
  normalizeRuntimeEvent,
} from "../src/index";

const plan: Plan = {
  id: "plan_nginx",
  title: "Install nginx",
  intent: "install",
  osFamily: "linux",
  prechecks: [{ type: "os-detect" }],
  steps: [{ type: "package-install", name: "nginx" }],
  verifications: [{ type: "service-status", name: "nginx", expect: "active" }],
  rollback: [{ type: "package-remove", name: "nginx" }],
  risk: "L1",
  explanation: ["Install nginx safely."],
  createdAt: "2026-06-23T00:00:00.000Z",
};

const execution: ExecutePlanResult = {
  runId: "run_plan_nginx",
  risk: "L1",
  gate: { allowed: true, reason: "risk gate passed" },
  commands: [],
  stepResults: [],
  verificationResults: [],
  rollback: {
    autoExecuted: false,
    available: true,
    trigger: "verification-failed",
    reason: "rollback recommended after verification-failed",
    suggestedCommand: "opsforge rollback run_plan_nginx",
  },
  auditEvents: [],
};

describe("createRuntimeSessionStatus", () => {
  it("describes a headless local Pi runtime session without exposing raw tools", () => {
    const status = createRuntimeSessionStatus({
      sessionId: "session_1",
      provider: "openai-compatible",
      model: "gpt-4.1-mini",
    });

    expect(status.sessionId).toBe("session_1");
    expect(status.rawShellToolsEnabled).toBe(false);
    expect(status.tools).toEqual(["inspect_host", "build_plan", "execute_job", "verify_run", "rollback_run"]);
  });
});

describe("normalizeRuntimeEvent", () => {
  it("normalizes runtime event payloads and keeps plan/execution objects intact", () => {
    const planEvent = normalizeRuntimeEvent({ type: "runtime.plan.ready", plan });
    const executionEvent = normalizeRuntimeEvent({ type: "runtime.execution.finished", result: execution });

    expect(planEvent.plan.title).toBe("Install nginx");
    expect(executionEvent.result.runId).toBe("run_plan_nginx");
  });

  it("formats deterministic summaries for runtime timelines", () => {
    expect(formatRuntimeEventSummary({ type: "runtime.thinking.delta", text: "Planning." }))
      .toBe("thinking: Planning.");
    expect(formatRuntimeEventSummary({ type: "runtime.approval.requested", approval: {
      planId: "plan_nginx",
      title: "Install nginx",
      risk: "L2",
      interactive: true,
    } })).toBe("approval: L2 Install nginx");
    expect(formatRuntimeEventSummary({ type: "runtime.rollback.requested", rollbackPrompt: {
      runId: "run_plan_nginx",
      rollback: execution.rollback,
    } })).toBe("rollback: run_plan_nginx rollback recommended after verification-failed");
  });
});

describe("createRuntimeActionController", () => {
  it("turns prompt submissions into thinking and plan events", async () => {
    const controller = createRuntimeActionController({
      buildPlan: async () => plan,
    });

    const events = await controller.handle({ type: "submit.prompt", prompt: "install nginx" });

    expect(events.map((event) => event.type)).toEqual(["runtime.thinking.delta", "runtime.plan.ready"]);
  });

  it("pauses high-risk plans as approval requests instead of executing them", async () => {
    const highRiskPlan: Plan = { ...plan, risk: "L3", steps: [{ type: "shell", cmd: "echo guarded" }] };
    let executed = false;
    const controller = createRuntimeActionController({
      buildPlan: async () => highRiskPlan,
      executePlan: async () => {
        executed = true;
        return execution;
      },
    });

    const events = await controller.handle({ type: "submit.prompt", prompt: "run guarded command" });

    expect(executed).toBe(false);
    expect(events.at(-1)).toMatchObject({
      type: "runtime.approval.requested",
      approval: { planId: "plan_nginx", risk: "L3" },
    });
  });

  it("auto-executes low-risk plans when an executor callback is available", async () => {
    const controller = createRuntimeActionController({
      buildPlan: async () => plan,
      executePlan: async () => execution,
    });

    const events = await controller.handle({ type: "submit.prompt", prompt: "install nginx" });

    expect(events.map((event) => event.type)).toContain("runtime.execution.finished");
  });

  it("resumes execution after approval", async () => {
    const highRiskPlan: Plan = { ...plan, risk: "L2", steps: [{ type: "file-write", path: "/etc/example", content: "ok" }] };
    const controller = createRuntimeActionController({
      buildPlan: async () => highRiskPlan,
      executePlan: async () => execution,
    });
    await controller.handle({ type: "submit.prompt", prompt: "write config" });

    const events = await controller.handle({ type: "approval.approve", planId: "plan_nginx", reason: "needed" });

    expect(events.map((event) => event.type)).toEqual(["runtime.thinking.delta", "runtime.execution.finished"]);
  });

  it("calls injected rollback handler for rollback actions", async () => {
    const controller = createRuntimeActionController({
      buildPlan: async () => plan,
      rollbackRun: async (runId) => ({ ...execution, runId }),
    });

    const events = await controller.handle({ type: "rollback.run", runId: "run_plan_nginx" });

    expect(events).toMatchObject([{ type: "runtime.thinking.delta" }, { type: "runtime.execution.finished" }]);
    expect(events[1]).toMatchObject({ result: { runId: "run_plan_nginx" } });
  });

  it("emits recoverable errors when required runtime state or callbacks are missing", async () => {
    const controller = createRuntimeActionController({
      buildPlan: async () => plan,
    });

    await expect(controller.handle({ type: "approval.approve", planId: "missing" }))
      .resolves.toEqual([{ type: "runtime.error", message: "No pending plan to approve", recoverable: true }]);
    await expect(controller.handle({ type: "rollback.run", runId: "run_plan_nginx" }))
      .resolves.toEqual([{ type: "runtime.error", message: "Rollback handler is not configured", recoverable: true }]);
  });
});
