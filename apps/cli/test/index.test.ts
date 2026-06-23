import { describe, expect, it } from "vitest";
import type { AuditStore } from "@opsforge/audit";
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

const rollbackPlan: Plan = {
  ...plan,
  rollback: [{ type: "package-remove", name: "nginx" }],
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

  it("maps rollback recommendations into TUI rollback prompt events", async () => {
    const handler = await createTuiRuntimeActionHandler({
      facts: linuxFacts,
      provider: {
        name: "mock",
        buildPlan: async () => rollbackPlan,
      },
      execute: async () => ({
        runId: "run_1",
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
          suggestedCommand: "opsforge rollback run_1",
        },
        auditEvents: [],
        dryRun: false,
      }),
    });

    const events = await handler({ type: "submit.prompt", prompt: "install nginx" }) ?? [];

    expect(events.map((event) => event.type)).toEqual(["thinking.delta", "plan.ready", "execution.finished", "rollback.requested"]);
  });

  it("maps rollback actions through an injected rollback callback", async () => {
    const rollbackCalls: string[] = [];
    const handler = await createTuiRuntimeActionHandler({
      facts: linuxFacts,
      provider: {
        name: "mock",
        buildPlan: async () => rollbackPlan,
      },
      rollback: async (runId) => {
        rollbackCalls.push(runId);
        return {
          runId: "run_rollback_1",
          risk: "L1",
          gate: { allowed: true, reason: "risk gate passed" },
          commands: [],
          stepResults: [],
          verificationResults: [],
          rollback: { autoExecuted: false, available: false, reason: "rollback not needed" },
          auditEvents: [],
          dryRun: false,
        };
      },
    });

    const events = await handler({ type: "rollback.run", runId: "run_1" }) ?? [];

    expect(rollbackCalls).toEqual(["run_1"]);
    expect(events.map((event) => event.type)).toEqual(["thinking.delta", "execution.finished"]);
  });

  it("runs default TUI rollback through stored audit plans", async () => {
    const commands: string[] = [];
    const auditEvents: ReturnType<AuditStore["events"]> = [];
    const auditStore: AuditStore = {
      record: (event) => {
        auditEvents.push(event);
      },
      events: () => auditEvents.slice(),
      listRuns: () => [],
      showRun: (runId) => ({
        runId,
        planId: rollbackPlan.id,
        risk: rollbackPlan.risk,
        status: "completed",
        startedAt: "2026-06-23T00:00:00.000Z",
        stepCount: 0,
        plan: rollbackPlan,
        events: [],
        steps: [],
      }),
      recordStepArtifacts: () => ({ stdoutPath: "stdout.txt", stderrPath: "stderr.txt" }),
      close: () => {},
    };
    const handler = await createTuiRuntimeActionHandler({
      facts: linuxFacts,
      auditStore,
      config: {
        riskMax: "L3",
        allowShell: false,
        dbPath: ".opsforge-test.db",
        artifactsDir: ".opsforge-test-artifacts",
      },
      runner: async (command) => {
        commands.push(Array.isArray(command.argv) ? command.argv.join(" ") : command.argv);
        return { stdout: "", stderr: "", exitCode: 0 };
      },
    });

    const events = await handler({ type: "rollback.run", runId: "run_1" }) ?? [];

    expect(commands).toEqual(["apt-get remove -y nginx"]);
    expect(events.map((event) => event.type)).toEqual(["thinking.delta", "execution.finished"]);
  });

  it("loads audit history for the TUI from the configured audit store", async () => {
    const auditStore: AuditStore = {
      record: () => {},
      events: () => [],
      listRuns: () => [
        {
          runId: "run_1",
          planId: "plan_1",
          risk: "L1",
          status: "completed",
          startedAt: "2026-06-23T00:00:00Z",
          stepCount: 1,
        },
      ],
      showRun: () => undefined,
      recordStepArtifacts: () => ({ stdoutPath: "stdout.txt", stderrPath: "stderr.txt" }),
      close: () => {},
    };
    const handler = await createTuiRuntimeActionHandler({ facts: linuxFacts, auditStore });

    const events = await handler({ type: "audit.history.load" }) ?? [];

    expect(events).toEqual([
      {
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
      },
    ]);
  });

  it("opens audit run reports for the TUI from the configured audit store", async () => {
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
        plan,
        events: [],
        steps: [],
      }),
      recordStepArtifacts: () => ({ stdoutPath: "stdout.txt", stderrPath: "stderr.txt" }),
      close: () => {},
    };
    const handler = await createTuiRuntimeActionHandler({ facts: linuxFacts, auditStore });

    const events = await handler({ type: "audit.run.open", runId: "run_1" }) ?? [];

    expect(events).toEqual([
      {
        type: "audit.run.loaded",
        report: expect.objectContaining({
          summary: expect.objectContaining({ runId: "run_1", title: "Install nginx" }),
        }),
      },
    ]);
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
