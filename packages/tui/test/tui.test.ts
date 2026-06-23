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
  reduceTuiEvents,
  reduceTuiKeyInput,
  type TuiActionHandler,
} from "../src/index";
import { parseInput } from "../src/commands/parseInput";
import { selectStatusViewModel } from "../src/state/selectors";
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

  it("keeps long runtime status readable and separates the prompt area", () => {
    const repeatedError = Array.from({ length: 4 }, () =>
      "Runtime error: No provider configured. Run `opsforge config provider ...` first.",
    ).join("");
    const snapshot = formatTuiSnapshot(createTuiStatus({
      facts: {
        osFamily: "windows",
        arch: "x64",
        isElevated: false,
        packageManagers: ["winget", "choco"],
      },
      provider: "未配置",
      thinkingText: repeatedError,
      inputDraft: "安装 nginx",
      lastSubmittedPrompt: "1111",
    }));

    expect(snapshot).toContain("Status");
    expect(snapshot).toContain("Runtime error: No provider configured.");
    expect(snapshot).toContain("Prompt");
    expect(snapshot).toContain("Last prompt: 1111");
    expect(snapshot).toContain("Ask Forge > 安装 nginx");
    expect(Math.max(...snapshot.split("\n").map((line) => line.length))).toBeLessThanOrEqual(140);
  });

  it("renders loaded audit history and opened audit detail", () => {
    const snapshot = formatTuiSnapshot(createTuiStatus({
      facts: linuxFacts,
      provider: "mock",
      auditHistory: {
        runs: [
          {
            runId: "run_1",
            planId: "plan_1",
            risk: "L2",
            status: "rolled_back",
            startedAt: "2026-06-23T00:00:00Z",
            endedAt: "2026-06-23T00:00:05Z",
            stepCount: 1,
          },
        ],
      },
      auditDetail: {
        summary: {
          runId: "run_1",
          planId: "plan_1",
          title: "Install nginx",
          intent: "install",
          risk: "L2",
          status: "rolled_back",
          startedAt: "2026-06-23T00:00:00Z",
          endedAt: "2026-06-23T00:00:05Z",
          stepCount: 1,
        },
        steps: [
          {
            stepIndex: 0,
            label: "package-install nginx",
            exitCode: 0,
            stdoutPath: "artifacts/run_1/step-0-stdout.txt",
          },
        ],
        eventTimeline: [
          { index: 1, at: "2026-06-23T00:00:00Z", type: "plan.created" },
        ],
        artifactCount: 1,
        verificationEventCount: 1,
        rollback: { status: "finished", available: true, eventCount: 2 },
      },
    }));

    expect(snapshot).toContain("Audit history");
    expect(snapshot).toContain("1. run_1 plan=plan_1 risk=L2 status=rolled_back steps=1");
    expect(snapshot).toContain("Audit detail: Install nginx (run_1)");
    expect(snapshot).toContain("package-install nginx exit=0");
    expect(snapshot).toContain("artifacts/run_1/step-0-stdout.txt");
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

  it("clears stale thinking text when a new prompt is submitted", () => {
    let state = createInitialTuiState(createTuiStatus({
      facts: linuxFacts,
      provider: "mock",
      thinkingText: "Runtime error: No provider configured.",
      inputDraft: "retry",
    }));

    state = reduceTuiEvent(state, { type: "input.submitted" });
    state = reduceTuiEvent(state, { type: "thinking.delta", text: "Planning safely." });

    expect(state.status.lastSubmittedPrompt).toBe("retry");
    expect(state.status.thinkingText).toBe("Planning safely.");
  });

  it("renders runtime errors as a separate status instead of appending to pending thinking", () => {
    let state = createInitialTuiState(createTuiStatus({ facts: linuxFacts, provider: "mock" }));
    state = reduceTuiEvent(state, { type: "thinking.delta", text: "Planning with the configured provider..." });
    state = reduceTuiEvent(state, { type: "runtime.error", message: "Provider returned invalid OpsForge Plan DSL." });

    expect(state.status.thinkingText).toBeUndefined();
    expect(state.status.errorText).toBe("Provider returned invalid OpsForge Plan DSL.");

    const snapshot = formatTuiSnapshot(state.status);
    expect(snapshot).toContain("Error: Provider returned invalid OpsForge Plan DSL.");
    expect(snapshot).not.toContain("Planning with the configured provider...Provider");
  });

  it("stores structured runtime errors for status selectors", () => {
    let state = createInitialTuiState(createTuiStatus({ facts: linuxFacts, provider: "mock" }));
    state = reduceTuiEvent(state, {
      type: "runtime.error",
      error: {
        phase: "planning",
        type: "INVALID_SCHEMA",
        summary: "Provider returned invalid OpsForge Plan DSL.",
        details: ["steps.0.type: Invalid discriminator value"],
        retryable: true,
        suggestedAction: "Try a concrete local-ops task, or switch models/provider.",
      },
    });

    expect(state.status.error?.type).toBe("INVALID_SCHEMA");
    expect(state.status.errorText).toBe("Provider returned invalid OpsForge Plan DSL.");

    const view = selectStatusViewModel(state);
    expect(view.level).toBe("error");
    expect(view.title).toBe("Planning error: INVALID_SCHEMA");
    expect(view.summary).toBe("Provider returned invalid OpsForge Plan DSL.");
    expect(view.suggestedAction).toBe("Try a concrete local-ops task, or switch models/provider.");
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

  it("stores loaded audit history and opened audit detail from events", () => {
    let state = createInitialTuiState(createTuiStatus({ facts: linuxFacts, provider: "mock" }));
    state = reduceTuiEvent(state, {
      type: "audit.history.loaded",
      history: {
        runs: [
          {
            runId: "run_1",
            planId: "plan_1",
            risk: "L1",
            status: "completed",
            startedAt: "2026-06-23T00:00:00Z",
            stepCount: 1,
          },
        ],
      },
    });
    state = reduceTuiEvent(state, {
      type: "audit.run.loaded",
      report: {
        summary: {
          runId: "run_1",
          planId: "plan_1",
          title: "Install nginx",
          intent: "install",
          risk: "L1",
          status: "completed",
          startedAt: "2026-06-23T00:00:00Z",
          stepCount: 1,
        },
        steps: [],
        eventTimeline: [],
        artifactCount: 0,
        verificationEventCount: 0,
        rollback: { status: "not-recorded", available: false, eventCount: 0 },
      },
    });

    expect(state.status.auditHistory?.runs[0]?.runId).toBe("run_1");
    expect(state.status.auditDetail?.summary.title).toBe("Install nginx");
  });
});

describe("reduceTuiEvents", () => {
  it("applies runtime-derived events in order", () => {
    const state = createInitialTuiState(createTuiStatus({ facts: linuxFacts, provider: "mock" }));
    const next = reduceTuiEvents(state, [
      { type: "thinking.delta", text: "Planning safely." },
      { type: "plan.ready", plan: nginxPlan },
    ]);

    expect(next.status.thinkingText).toBe("Planning safely.");
    expect(next.status.planCard?.title).toBe("Install nginx");
    expect(state.status.planCard).toBeUndefined();
  });

  it("types async TUI action handlers as event producers", async () => {
    const handler: TuiActionHandler = async () => [{ type: "thinking.delta", text: "handled" }];

    await expect(handler({ type: "submit.prompt", prompt: "install nginx" })).resolves.toEqual([
      { type: "thinking.delta", text: "handled" },
    ]);
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

  it("ignores session events and maps runtime errors into dedicated TUI error state", () => {
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
      .toEqual({
        type: "runtime.error",
        error: {
          phase: "runtime",
          type: "RUNTIME_ERROR",
          summary: "provider failed",
          retryable: true,
          suggestedAction: "Review the runtime error, adjust the task/provider, then retry.",
        },
      });
  });
});

describe("parseInput", () => {
  it("classifies supported slash commands without routing them to the provider", () => {
    expect(parseInput("/provider")).toEqual({ kind: "command", name: "provider", args: [], raw: "/provider" });
    expect(parseInput("/history")).toEqual({ kind: "command", name: "history", args: [], raw: "/history" });
    expect(parseInput("/audit 1")).toEqual({ kind: "command", name: "audit", args: ["1"], raw: "/audit 1" });
  });

  it("keeps unknown slash commands local and plain language as tasks", () => {
    expect(parseInput("/wat now")).toEqual({ kind: "command", name: "wat", args: ["now"], raw: "/wat now" });
    expect(parseInput("install nginx")).toEqual({ kind: "task", text: "install nginx" });
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
    expect(state.status.thinkingText).toBe("Planning with the configured provider...");
    expect(result.action).toEqual({ type: "submit.prompt", prompt: "in" });
  });

  it("keeps plain h and pasted text as prompt input instead of global shortcuts", () => {
    let state = createInitialTuiState(createTuiStatus({ facts: linuxFacts, provider: "mock" }));
    let result = reduceTuiKeyInput(state, "h", {});
    result = reduceTuiKeyInput(result.state, "ello", {});
    result = reduceTuiKeyInput(result.state, " 安装 nginx", {});

    state = result.state;

    expect(result.action).toBeUndefined();
    expect(state.input.draft).toBe("hello 安装 nginx");
    expect(state.status.inputDraft).toBe("hello 安装 nginx");
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

  it("emits audit history and run-open actions from slash commands", () => {
    let state = createInitialTuiState(createTuiStatus({ facts: linuxFacts, provider: "mock" }));

    state = reduceTuiKeyInput(state, "/history", {}).state;
    const historyResult = reduceTuiKeyInput(state, "", { return: true });
    expect(historyResult.action).toEqual({ type: "audit.history.load" });
    expect(historyResult.state.input.draft).toBe("");

    state = reduceTuiEvent(historyResult.state, {
      type: "audit.history.loaded",
      history: {
        runs: [
          {
            runId: "run_1",
            planId: "plan_1",
            risk: "L1",
            status: "completed",
            startedAt: "2026-06-23T00:00:00Z",
            stepCount: 1,
          },
        ],
      },
    });

    state = reduceTuiKeyInput(state, "/audit 1", {}).state;
    expect(reduceTuiKeyInput(state, "", { return: true }).action).toEqual({ type: "audit.run.open", runId: "run_1" });
  });

  it("handles local slash commands without sending them to the provider", () => {
    let state = createInitialTuiState(createTuiStatus({
      facts: linuxFacts,
      provider: "openai-compatible (gpt-5.5)",
      model: "gpt-5.5",
    }));

    state = reduceTuiKeyInput(state, "/provider", {}).state;
    const providerResult = reduceTuiKeyInput(state, "", { return: true });

    expect(providerResult.action).toBeUndefined();
    expect(providerResult.state.status.lastSubmittedPrompt).toBe("/provider");
    expect(providerResult.state.status.thinkingText).toBe("Provider: openai-compatible (gpt-5.5); Model: gpt-5.5");

    state = reduceTuiKeyInput(providerResult.state, "/unknown", {}).state;
    const unknownResult = reduceTuiKeyInput(state, "", { return: true });

    expect(unknownResult.action).toBeUndefined();
    expect(unknownResult.state.status.errorText).toBe("Unknown command: /unknown. Available commands: /provider, /history, /audit <n>.");
    expect(unknownResult.state.status.error?.type).toBe("UNKNOWN_COMMAND");
  });
});
