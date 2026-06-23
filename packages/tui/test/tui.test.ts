import { describe, expect, it } from "vitest";
import type { ExecutePlanResult } from "@opsforge/core";
import type { Plan } from "@opsforge/dsl";
import type { HostFacts } from "@opsforge/executor-base";
import {
  createApprovalPrompt,
  createExecutionTimeline,
  createRollbackPrompt,
  createTuiPlanCard,
  createTuiStatus,
  formatApprovalPromptSnapshot,
  formatExecutionTimelineSnapshot,
  formatPlanCardSnapshot,
  formatRollbackPromptSnapshot,
  formatTuiSnapshot,
} from "../src/index";

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
