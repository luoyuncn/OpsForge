import { describe, expect, it } from "vitest";
import type { ExecutePlanResult } from "@opsforge/core";
import type { Plan } from "@opsforge/dsl";
import type { HostFacts } from "@opsforge/executor-base";
import {
  createApprovalPrompt,
  createExecutionTimeline,
  createInitialTuiState,
  createRollbackPrompt,
  createTuiPlanCard,
  createTuiStatus,
  formatApprovalPromptSnapshot,
  formatExecutionTimelineSnapshot,
  formatPlanCardSnapshot,
  formatRollbackPromptSnapshot,
  formatTuiStateSnapshot,
  formatTuiSnapshot,
  reduceTuiEvent,
  reduceTuiKeyInput,
} from "../src/index";
import { runtimeEventToTuiEvent } from "../src/runtime-adapter";

const linuxFacts: HostFacts = {
  osFamily: "linux",
  arch: "x64",
  distro: "ubuntu",
  version: "24.04",
  isElevated: true,
  packageManagers: ["apt"],
};

const nginxPlan: Plan = {
  id: "plan_nginx",
  title: "Install nginx",
  intent: "install",
  osFamily: "linux",
  packageSpec: {
    name: "nginx",
  },
  prechecks: [
    { type: "os-detect" },
    { type: "privilege-check", requireElevated: true },
  ],
  steps: [
    { type: "package-update-cache" },
    { type: "package-install", name: "nginx" },
    { type: "service-enable", name: "nginx" },
    { type: "service-start", name: "nginx" },
  ],
  verifications: [
    { type: "service-status", name: "nginx", expect: "active" },
  ],
  rollback: [
    { type: "service-stop", name: "nginx" },
    { type: "package-remove", name: "nginx" },
  ],
  risk: "L1",
  explanation: ["Install nginx from the system package manager."],
  createdAt: "2026-06-23T00:00:00.000Z",
};

const nginxExecutionResult: ExecutePlanResult = {
  runId: "run_plan_nginx",
  risk: "L1",
  gate: {
    allowed: true,
    reason: "risk gate passed",
  },
  commands: [
    {
      shell: "bash",
      argv: ["apt-get", "install", "-y", "nginx"],
      needsElevation: true,
      describe: "Install package nginx with apt",
    },
  ],
  stepResults: [
    {
      step: { type: "package-install", name: "nginx" },
      command: {
        shell: "bash",
        argv: ["apt-get", "install", "-y", "nginx"],
        needsElevation: true,
        describe: "Install package nginx with apt",
      },
      stdout: "installed nginx",
      stderr: "",
      exitCode: 0,
      startedAt: "2026-06-23T00:00:00.000Z",
      endedAt: "2026-06-23T00:00:01.250Z",
      truncated: false,
    },
  ],
  verificationResults: [
    {
      verification: { type: "service-status", name: "nginx", expect: "active" },
      ok: true,
      message: "service nginx status active",
    },
  ],
  rollback: {
    autoExecuted: false,
    available: false,
    reason: "rollback not needed",
  },
  auditEvents: [],
};

describe("createTuiStatus", () => {
  it("keeps host facts and provider status for the TUI shell", () => {
    const status = createTuiStatus({
      facts: {
        osFamily: "linux",
        arch: "x64",
        distro: "ubuntu",
        version: "24.04",
        isElevated: true,
        packageManagers: ["apt"],
      },
      provider: "openai-compatible (gpt-4.1-mini)",
      model: "gpt-4.1-mini",
    });

    expect(status.facts.osFamily).toBe("linux");
    expect(status.provider).toBe("openai-compatible (gpt-4.1-mini)");
    expect(status.model).toBe("gpt-4.1-mini");
  });
});

describe("formatTuiSnapshot", () => {
  it("renders the TUI foundation shell as deterministic text", () => {
    const snapshot = formatTuiSnapshot(createTuiStatus({
      facts: {
        osFamily: "windows",
        arch: "x64",
        isElevated: false,
        packageManagers: ["winget"],
      },
      provider: "未配置",
    }));

    expect(snapshot).toContain("Forge");
    expect(snapshot).toContain("OS: windows x64");
    expect(snapshot).toContain("Elevated: false");
    expect(snapshot).toContain("Provider: 未配置");
    expect(snapshot).toContain("Package managers: winget");
    expect(snapshot).toContain("Ask Forge");
  });

  it("renders an attached plan card inside the TUI snapshot", () => {
    const snapshot = formatTuiSnapshot(createTuiStatus({
      facts: linuxFacts,
      provider: "mock",
      plan: nginxPlan,
    }));

    expect(snapshot).toContain("Plan: Install nginx");
    expect(snapshot).toContain("Risk: L1");
    expect(snapshot).toContain("apt-get install -y nginx");
  });

  it("renders an attached execution timeline inside the TUI snapshot", () => {
    const snapshot = formatTuiSnapshot(createTuiStatus({
      facts: linuxFacts,
      provider: "mock",
      plan: nginxPlan,
      execution: nginxExecutionResult,
    }));

    expect(snapshot).toContain("Run: run_plan_nginx");
    expect(snapshot).toContain("Exit: 0");
    expect(snapshot).toContain("Verification: pass");
    expect(snapshot).toContain("rollback not needed");
  });

  it("renders inline approval and rollback prompts inside the TUI snapshot", () => {
    const snapshot = formatTuiSnapshot(createTuiStatus({
      facts: linuxFacts,
      provider: "mock",
      plan: nginxPlan,
      approval: {
        planId: "plan_nginx",
        title: "Install nginx",
        risk: "L3",
        interactive: true,
      },
      rollbackPrompt: {
        runId: "run_plan_nginx",
        rollback: {
          trigger: "verification-failed",
          autoExecuted: false,
          available: true,
          reason: "rollback recommended after verification-failed",
          suggestedCommand: "opsforge rollback run_plan_nginx",
        },
      },
    }));

    expect(snapshot).toContain("Approval: required");
    expect(snapshot).toContain("Reason: required");
    expect(snapshot).toContain("Rollback prompt: recommended");
    expect(snapshot).toContain("opsforge rollback run_plan_nginx");
  });

  it("renders thinking and input state inside the TUI snapshot", () => {
    const snapshot = formatTuiSnapshot(createTuiStatus({
      facts: linuxFacts,
      provider: "mock",
      thinkingText: "Forge is building a safe plan.",
      inputDraft: "install nginx",
      lastSubmittedPrompt: "diagnose nginx",
    }));

    expect(snapshot).toContain("Thinking: Forge is building a safe plan.");
    expect(snapshot).toContain("Last prompt: diagnose nginx");
    expect(snapshot).toContain("Ask Forge > install nginx");
  });
});

describe("createTuiPlanCard", () => {
  it("builds a deterministic plan card with compiled command previews", () => {
    const card = createTuiPlanCard(nginxPlan, linuxFacts);

    expect(card.title).toBe("Install nginx");
    expect(card.intent).toBe("install");
    expect(card.risk).toBe("L1");
    expect(card.steps[1]?.command.command).toBe("apt-get install -y nginx");
    expect(card.verifications).toContain("service-status nginx active");
    expect(card.rollback[0]?.command.command).toBe("systemctl stop nginx");
  });
});

describe("formatPlanCardSnapshot", () => {
  it("renders plan card sections for review before execution", () => {
    const snapshot = formatPlanCardSnapshot(createTuiPlanCard(nginxPlan, linuxFacts));

    expect(snapshot).toContain("Plan: Install nginx");
    expect(snapshot).toContain("Intent: install");
    expect(snapshot).toContain("Risk: L1");
    expect(snapshot).toContain("Prechecks:");
    expect(snapshot).toContain("Steps:");
    expect(snapshot).toContain("apt-get install -y nginx");
    expect(snapshot).toContain("Verifications:");
    expect(snapshot).toContain("service-status nginx active");
    expect(snapshot).toContain("Rollback:");
    expect(snapshot).toContain("systemctl stop nginx");
  });
});

describe("createExecutionTimeline", () => {
  it("builds a deterministic execution timeline from a core execution result", () => {
    const timeline = createExecutionTimeline(nginxExecutionResult);

    expect(timeline.runId).toBe("run_plan_nginx");
    expect(timeline.steps[0]?.command).toBe("apt-get install -y nginx");
    expect(timeline.steps[0]?.stdout).toBe("installed nginx");
    expect(timeline.steps[0]?.exitCode).toBe(0);
    expect(timeline.verifications[0]?.status).toBe("pass");
    expect(timeline.rollback.reason).toBe("rollback not needed");
  });
});

describe("formatExecutionTimelineSnapshot", () => {
  it("renders step output, verification status, and rollback outcome", () => {
    const snapshot = formatExecutionTimelineSnapshot(createExecutionTimeline(nginxExecutionResult));

    expect(snapshot).toContain("Run: run_plan_nginx");
    expect(snapshot).toContain("apt-get install -y nginx");
    expect(snapshot).toContain("stdout: installed nginx");
    expect(snapshot).toContain("Exit: 0");
    expect(snapshot).toContain("Verification: pass");
    expect(snapshot).toContain("service nginx status active");
    expect(snapshot).toContain("Rollback: rollback not needed");
  });
});

describe("createApprovalPrompt", () => {
  it("bypasses low-risk plans", () => {
    const prompt = createApprovalPrompt({
      planId: "plan_nginx",
      title: "Install nginx",
      risk: "L1",
      interactive: true,
    });

    expect(prompt.required).toBe(false);
    expect(prompt.status).toBe("bypassed");
  });

  it("requires inline approve or deny for L2 plans", () => {
    const prompt = createApprovalPrompt({
      planId: "plan_config",
      title: "Update config",
      risk: "L2",
      interactive: true,
    });

    expect(prompt.required).toBe(true);
    expect(prompt.reasonRequired).toBe(false);
    expect(prompt.actions).toEqual(["approve", "deny"]);
  });

  it("requires a reason for L3 plans", () => {
    const prompt = createApprovalPrompt({
      planId: "plan_shell",
      title: "Run guarded shell",
      risk: "L3",
      interactive: true,
    });

    expect(prompt.required).toBe(true);
    expect(prompt.reasonRequired).toBe(true);
    expect(prompt.reasonLabel).toBe("Approval reason");
  });

  it("shows non-interactive denial fallback for high-risk plans", () => {
    const snapshot = formatApprovalPromptSnapshot(createApprovalPrompt({
      planId: "plan_config",
      title: "Update config",
      risk: "L2",
      interactive: false,
    }));

    expect(snapshot).toContain("Approval: non-interactive-denied");
    expect(snapshot).toContain("denied unless explicitly approved");
  });
});

describe("createRollbackPrompt", () => {
  it("prompts for recommended rollback", () => {
    const prompt = createRollbackPrompt({
      runId: "run_plan_nginx",
      rollback: {
        trigger: "step-failed",
        autoExecuted: false,
        available: true,
        reason: "rollback recommended after step-failed",
        suggestedCommand: "opsforge rollback run_plan_nginx",
      },
    });

    expect(prompt.required).toBe(true);
    expect(prompt.status).toBe("recommended");
    expect(prompt.actions).toEqual(["rollback", "skip"]);
    expect(prompt.suggestedCommand).toBe("opsforge rollback run_plan_nginx");
  });

  it("does not offer rollback action when unavailable", () => {
    const prompt = createRollbackPrompt({
      runId: "run_plan_nginx",
      rollback: {
        trigger: "verification-failed",
        autoExecuted: false,
        available: false,
        reason: "rollback unavailable: plan has no rollback steps",
      },
    });

    expect(prompt.required).toBe(false);
    expect(prompt.status).toBe("unavailable");
    expect(prompt.actions).toEqual([]);
  });

  it("marks auto-executed rollback as already handled", () => {
    const prompt = createRollbackPrompt({
      runId: "run_plan_nginx",
      rollback: {
        trigger: "step-failed",
        autoExecuted: true,
        available: true,
        reason: "rollback executed after step-failed",
      },
    });

    expect(prompt.required).toBe(false);
    expect(prompt.status).toBe("auto-executed");
  });

  it("bypasses rollback prompt when rollback is not needed", () => {
    const prompt = createRollbackPrompt({
      runId: "run_plan_nginx",
      rollback: {
        autoExecuted: false,
        available: false,
        reason: "rollback not needed",
      },
    });

    expect(prompt.required).toBe(false);
    expect(prompt.status).toBe("not-needed");
  });
});

describe("formatRollbackPromptSnapshot", () => {
  it("renders recommended rollback command and actions", () => {
    const snapshot = formatRollbackPromptSnapshot(createRollbackPrompt({
      runId: "run_plan_nginx",
      rollback: {
        trigger: "verification-failed",
        autoExecuted: false,
        available: true,
        reason: "rollback recommended after verification-failed",
        suggestedCommand: "opsforge rollback run_plan_nginx",
      },
    }));

    expect(snapshot).toContain("Rollback prompt: recommended");
    expect(snapshot).toContain("Actions: rollback, skip");
    expect(snapshot).toContain("opsforge rollback run_plan_nginx");
  });
});

describe("reduceTuiEvent", () => {
  it("accumulates thinking stream text without mutating the previous state", () => {
    const state = createInitialTuiState(createTuiStatus({ facts: linuxFacts, provider: "mock" }));
    const next = reduceTuiEvent(state, { type: "thinking.delta", text: "Checking " });
    const final = reduceTuiEvent(next, { type: "thinking.delta", text: "host facts." });

    expect(next).not.toBe(state);
    expect(state.status.thinkingText).toBeUndefined();
    expect(final.status.thinkingText).toBe("Checking host facts.");
  });

  it("tracks input draft and clears it after submit", () => {
    const state = createInitialTuiState(createTuiStatus({ facts: linuxFacts, provider: "mock" }));
    const drafted = reduceTuiEvent(state, { type: "input.changed", draft: "install nginx" });
    const submitted = reduceTuiEvent(drafted, { type: "input.submitted" });

    expect(drafted.input.draft).toBe("install nginx");
    expect(submitted.input.draft).toBe("");
    expect(submitted.input.lastSubmitted).toBe("install nginx");
    expect(submitted.status.lastSubmittedPrompt).toBe("install nginx");
  });

  it("builds renderable plan, execution, approval, and rollback state from events", () => {
    let state = createInitialTuiState(createTuiStatus({ facts: linuxFacts, provider: "mock" }));
    state = reduceTuiEvent(state, { type: "plan.ready", plan: nginxPlan });
    state = reduceTuiEvent(state, { type: "execution.finished", result: nginxExecutionResult });
    state = reduceTuiEvent(state, {
      type: "approval.requested",
      approval: {
        planId: "plan_nginx",
        title: "Install nginx",
        risk: "L2",
        interactive: true,
      },
    });
    state = reduceTuiEvent(state, {
      type: "rollback.requested",
      rollbackPrompt: {
        runId: "run_plan_nginx",
        rollback: {
          trigger: "step-failed",
          autoExecuted: false,
          available: true,
          reason: "rollback recommended after step-failed",
          suggestedCommand: "opsforge rollback run_plan_nginx",
        },
      },
    });

    expect(state.status.planCard?.title).toBe("Install nginx");
    expect(state.status.timeline?.runId).toBe("run_plan_nginx");
    expect(state.status.approvalPrompt?.status).toBe("required");
    expect(state.status.rollbackPrompt?.status).toBe("recommended");
  });
});

describe("formatTuiStateSnapshot", () => {
  it("renders an event-driven TUI state snapshot", () => {
    let state = createInitialTuiState(createTuiStatus({ facts: linuxFacts, provider: "mock" }));
    state = reduceTuiEvent(state, { type: "thinking.delta", text: "Planning safely." });
    state = reduceTuiEvent(state, { type: "input.changed", draft: "install nginx" });
    state = reduceTuiEvent(state, { type: "plan.ready", plan: nginxPlan });

    const snapshot = formatTuiStateSnapshot(state);

    expect(snapshot).toContain("Thinking: Planning safely.");
    expect(snapshot).toContain("Ask Forge > install nginx");
    expect(snapshot).toContain("Plan: Install nginx");
  });
});

describe("runtimeEventToTuiEvent", () => {
  it("maps runtime thinking, plan, execution, approval, and rollback events into reducer events", () => {
    const runtimeEvents = [
      { type: "runtime.thinking.delta" as const, text: "Planning safely." },
      { type: "runtime.plan.ready" as const, plan: nginxPlan },
      { type: "runtime.execution.finished" as const, result: nginxExecutionResult },
      {
        type: "runtime.approval.requested" as const,
        approval: {
          planId: "plan_nginx",
          title: "Install nginx",
          risk: "L2" as const,
          interactive: true,
        },
      },
      {
        type: "runtime.rollback.requested" as const,
        rollbackPrompt: {
          runId: "run_plan_nginx",
          rollback: {
            trigger: "step-failed" as const,
            autoExecuted: false,
            available: true,
            reason: "rollback recommended after step-failed",
            suggestedCommand: "opsforge rollback run_plan_nginx",
          },
        },
      },
    ];

    let state = createInitialTuiState(createTuiStatus({ facts: linuxFacts, provider: "mock" }));
    for (const event of runtimeEvents) {
      const tuiEvent = runtimeEventToTuiEvent(event);
      if (tuiEvent) state = reduceTuiEvent(state, tuiEvent);
    }

    expect(formatTuiStateSnapshot(state)).toContain("Thinking: Planning safely.");
    expect(state.status.planCard?.title).toBe("Install nginx");
    expect(state.status.timeline?.runId).toBe("run_plan_nginx");
    expect(state.status.approvalPrompt?.status).toBe("required");
    expect(state.status.rollbackPrompt?.status).toBe("recommended");
  });

  it("ignores session and error runtime events until the TUI has dedicated views for them", () => {
    expect(runtimeEventToTuiEvent({
      type: "runtime.session.started",
      status: {
        sessionId: "session_1",
        provider: "mock",
        rawShellToolsEnabled: false,
        tools: ["inspect_host", "build_plan", "execute_job", "verify_run", "rollback_run"],
      },
    })).toBeUndefined();
    expect(runtimeEventToTuiEvent({ type: "runtime.error", message: "provider failed", recoverable: true }))
      .toBeUndefined();
  });
});

describe("reduceTuiKeyInput", () => {
  it("edits prompt input and emits submit actions on enter", () => {
    let state = createInitialTuiState(createTuiStatus({ facts: linuxFacts, provider: "mock" }));
    let result = reduceTuiKeyInput(state, "i", {});
    result = reduceTuiKeyInput(result.state, "n", {});
    result = reduceTuiKeyInput(result.state, "x", {});
    result = reduceTuiKeyInput(result.state, "", { backspace: true });
    result = reduceTuiKeyInput(result.state, "", { return: true });

    state = result.state;

    expect(state.input.lastSubmitted).toBe("in");
    expect(state.status.lastSubmittedPrompt).toBe("in");
    expect(result.action).toEqual({ type: "submit.prompt", prompt: "in" });
  });

  it("emits approve and deny actions for L2 approval prompts", () => {
    let state = createInitialTuiState(createTuiStatus({ facts: linuxFacts, provider: "mock" }));
    state = reduceTuiEvent(state, {
      type: "approval.requested",
      approval: { planId: "plan_config", title: "Update config", risk: "L2", interactive: true },
    });

    expect(reduceTuiKeyInput(state, "a", {}).action).toEqual({ type: "approval.approve", planId: "plan_config" });
    expect(reduceTuiKeyInput(state, "d", {}).action).toEqual({ type: "approval.deny", planId: "plan_config" });
  });

  it("requires L3 approval reason text before emitting approve", () => {
    let state = createInitialTuiState(createTuiStatus({ facts: linuxFacts, provider: "mock" }));
    state = reduceTuiEvent(state, {
      type: "approval.requested",
      approval: { planId: "plan_shell", title: "Run guarded shell", risk: "L3", interactive: true },
    });

    let result = reduceTuiKeyInput(state, "", { return: true });
    expect(result.action).toBeUndefined();

    result = reduceTuiKeyInput(result.state, "r", {});
    result = reduceTuiKeyInput(result.state, "e", {});
    result = reduceTuiKeyInput(result.state, "", { return: true });

    expect(result.action).toEqual({ type: "approval.approve", planId: "plan_shell", reason: "re" });
    expect(result.state.controls.approvalReasonDraft).toBe("");
  });

  it("emits rollback and skip actions for rollback prompts", () => {
    let state = createInitialTuiState(createTuiStatus({ facts: linuxFacts, provider: "mock" }));
    state = reduceTuiEvent(state, {
      type: "rollback.requested",
      rollbackPrompt: {
        runId: "run_plan_nginx",
        rollback: {
          trigger: "step-failed",
          autoExecuted: false,
          available: true,
          reason: "rollback recommended after step-failed",
          suggestedCommand: "opsforge rollback run_plan_nginx",
        },
      },
    });

    expect(reduceTuiKeyInput(state, "r", {}).action).toEqual({ type: "rollback.run", runId: "run_plan_nginx" });
    expect(reduceTuiKeyInput(state, "s", {}).action).toEqual({ type: "rollback.skip", runId: "run_plan_nginx" });
  });
});
