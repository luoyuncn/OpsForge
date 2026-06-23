import { describe, expect, it } from "vitest";
import type { HostFacts } from "@opsforge/executor-base";
import type { Plan } from "@opsforge/dsl";
import { formatNoTtyFallback, main, shouldLaunchTui } from "../src/index";
import { createTuiRuntimeActionHandler } from "../src/tui-runtime";

describe("shouldLaunchTui", () => {
  it("launches TUI only for no-argument interactive terminals", () => {
    expect(shouldLaunchTui([], true, true)).toBe(true);
    expect(shouldLaunchTui(["doctor"], true, true)).toBe(false);
    expect(shouldLaunchTui([], false, true)).toBe(false);
    expect(shouldLaunchTui([], true, false)).toBe(false);
  });
});

describe("formatNoTtyFallback", () => {
  it("explains non-TTY fallback while preserving a TUI snapshot", () => {
    const output = formatNoTtyFallback("Forge\nAsk Forge >");

    expect(output).toContain("OpsForge TUI requires an interactive terminal");
    expect(output).toContain("Forge");
    expect(output).toContain("Use `opsforge --help`");
  });
});

const linuxFacts: HostFacts = {
  osFamily: "linux",
  arch: "x64",
  distro: "ubuntu",
  version: "24.04",
  isElevated: true,
  packageManagers: ["apt"],
};

const plan: Plan = {
  id: "plan_nginx",
  title: "Install nginx",
  intent: "install",
  osFamily: "linux",
  prechecks: [],
  steps: [{ type: "package-install", name: "nginx" }],
  verifications: [],
  rollback: [],
  risk: "L1",
  explanation: [],
  createdAt: "2026-06-23T00:00:00.000Z",
};

describe("createTuiRuntimeActionHandler", () => {
  it("maps submitted prompts through runtime events into TUI events", async () => {
    const handler = await createTuiRuntimeActionHandler({
      facts: linuxFacts,
      provider: {
        name: "mock",
        buildPlan: async () => plan,
      },
      execute: async () => ({
        runId: "run_1",
        risk: "L1",
        gate: { allowed: true, reason: "risk gate passed" },
        commands: [],
        stepResults: [],
        verificationResults: [],
        rollback: { autoExecuted: false, available: false, reason: "rollback not needed" },
        auditEvents: [],
        dryRun: false,
      }),
    });

    const events = await handler({ type: "submit.prompt", prompt: "install nginx" }) ?? [];

    expect(events.map((event) => event.type)).toEqual(["thinking.delta", "plan.ready", "execution.finished"]);
  });
});

describe("main TUI entry", () => {
  it("passes a runtime action handler into runTui for interactive no-arg launches", async () => {
    const calls: unknown[] = [];

    await main(["node", "opsforge"], {
      stdinIsTty: true,
      stdoutIsTty: true,
      buildDoctorReport: async () => ({
        facts: linuxFacts,
        provider: "mock",
        providerCapabilities: ["none"],
        riskMax: "L3",
        allowShell: false,
        warnings: [],
      }),
      runTui: (_status, options) => {
        calls.push(options?.onAction);
      },
      createActionHandler: async () => async () => [],
      write: () => {},
    });

    expect(calls[0]).toEqual(expect.any(Function));
  });
});
