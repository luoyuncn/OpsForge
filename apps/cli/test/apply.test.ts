import { createServer } from "node:net";
import { describe, expect, it } from "vitest";
import { buildApplyCommand, createDefaultVerifyDeps, formatApplyResult } from "../src/commands/apply";
import { createMemoryAuditRecorder, type AuditStore } from "@opsforge/audit";
import type { HostFacts } from "@opsforge/executor-base";

const facts: HostFacts = {
  osFamily: "linux",
  arch: "x64",
  isElevated: false,
  packageManagers: ["apt"],
};

const installPlan = {
  id: "plan_1",
  title: "Install nginx",
  intent: "install",
  steps: [{ type: "package-install", name: "nginx" }],
  risk: "L1",
  createdAt: "2026-06-23T00:00:00Z",
};

const createFakeAuditStore = (): AuditStore & { artifactWrites: Array<{ runId: string; stepIndex: number; stdout: string; stderr: string }> } => {
  const memory = createMemoryAuditRecorder();
  const artifactWrites: Array<{ runId: string; stepIndex: number; stdout: string; stderr: string }> = [];

  return {
    ...memory,
    artifactWrites,
    listRuns: () => [],
    showRun: () => undefined,
    recordStepArtifacts: (runId, stepIndex, stdout, stderr) => {
      artifactWrites.push({ runId, stepIndex, stdout, stderr });
      return { stdoutPath: `${runId}-${stepIndex}.out`, stderrPath: `${runId}-${stepIndex}.err` };
    },
    close: () => {},
  };
};

describe("buildApplyCommand", () => {
  it("dry-runs a JSON plan and does not execute the runner", async () => {
    let runnerCalls = 0;
    const apply = buildApplyCommand({
      readFile: async () => JSON.stringify(installPlan),
      platform: "linux",
      facts,
      auditStore: createFakeAuditStore(),
      runner: async () => {
        runnerCalls += 1;
        return { stdout: "", stderr: "", exitCode: 0 };
      },
    });

    const result = await apply("plan.json", { dryRun: true, yes: false, json: false, riskMax: "L3", allowShell: false });
    expect(runnerCalls).toBe(0);
    expect(result.commands[0].argv).toEqual(["apt-get", "install", "-y", "nginx"]);
    expect(formatApplyResult(result)).toContain("Dry run: true");
  });

  it("denies risky file writes without yes", async () => {
    const apply = buildApplyCommand({
      readFile: async () =>
        JSON.stringify({
          ...installPlan,
          steps: [{ type: "file-write", path: "/tmp/a", content: "x" }],
          risk: "L2",
      }),
      platform: "linux",
      facts,
      auditStore: createFakeAuditStore(),
      runner: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    });

    const result = await apply("plan.json", { dryRun: false, yes: false, json: false, riskMax: "L3", allowShell: false });
    expect(result.gate.allowed).toBe(false);
    expect(result.stepResults).toEqual([]);
  });

  it("records dry-run audit events into an injected audit store", async () => {
    const auditStore = createFakeAuditStore();
    const apply = buildApplyCommand({
      readFile: async () => JSON.stringify(installPlan),
      platform: "linux",
      facts,
      auditStore,
      runner: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    });

    const result = await apply("plan.json", { dryRun: true, yes: false, json: false, riskMax: "L3", allowShell: false });

    expect(result.auditEvents.length).toBeGreaterThan(0);
    expect(auditStore.events().map((event) => event.type)).toEqual(result.auditEvents.map((event) => event.type));
  });

  it("records stdout and stderr artifacts for executed steps", async () => {
    const auditStore = createFakeAuditStore();
    const apply = buildApplyCommand({
      readFile: async () => JSON.stringify(installPlan),
      platform: "linux",
      facts,
      auditStore,
      runner: async () => ({ stdout: "installed", stderr: "note", exitCode: 0 }),
    });

    const result = await apply("plan.json", { dryRun: false, yes: true, json: false, riskMax: "L3", allowShell: false });

    expect(result.stepResults).toHaveLength(1);
    expect(auditStore.artifactWrites).toEqual([
      { runId: result.runId, stepIndex: 0, stdout: "installed", stderr: "note" },
    ]);
  });

  it("uses detected host facts when explicit facts are not supplied", async () => {
    const apply = buildApplyCommand({
      readFile: async () => JSON.stringify(installPlan),
      platform: "linux",
      arch: "x64",
      getUid: () => 0,
      linuxRelease: "ID=fedora\nVERSION_ID=40\n",
      which: (cmd) => cmd === "dnf",
      auditStore: createFakeAuditStore(),
      runner: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    });

    const result = await apply("plan.json", { dryRun: true, yes: false, json: false, riskMax: "L3", allowShell: false });

    expect(result.commands[0].argv).toEqual(["dnf", "-y", "install", "nginx"]);
  });
});

describe("createDefaultVerifyDeps", () => {
  it("creates linux default verifier probes for package, service, and process checks", async () => {
    const calls: string[] = [];
    const deps = createDefaultVerifyDeps({
      platform: "linux",
      packageManagers: ["apt"],
      runner: async (command) => {
        const commandText = Array.isArray(command.argv) ? command.argv.join(" ") : command.argv;
        calls.push(commandText);
        if (commandText.startsWith("dpkg-query")) return { stdout: "1.24.0\n", stderr: "", exitCode: 0 };
        if (commandText.startsWith("systemctl")) return { stdout: "active\n", stderr: "", exitCode: 0 };
        if (commandText.startsWith("pgrep")) return { stdout: "123\n", stderr: "", exitCode: 0 };
        return { stdout: "", stderr: "", exitCode: 1 };
      },
    });

    await expect(deps.getPackageVersion?.("nginx")).resolves.toBe("1.24.0");
    await expect(deps.getServiceStatus?.("nginx")).resolves.toBe("active");
    await expect(deps.isProcessAlive?.("nginx")).resolves.toBe(true);
    expect(calls).toEqual([
      "dpkg-query -W -f=${Version} nginx",
      "systemctl is-active nginx",
      "pgrep -x nginx",
    ]);
  });

  it("creates windows default verifier probes for package, service, and process checks", async () => {
    const calls: string[] = [];
    const deps = createDefaultVerifyDeps({
      platform: "win32",
      runner: async (command) => {
        const commandText = Array.isArray(command.argv) ? command.argv.join(" ") : command.argv;
        calls.push(commandText);
        if (commandText.startsWith("Get-Package")) return { stdout: "2.0.0\n", stderr: "", exitCode: 0 };
        if (commandText.startsWith("Get-Service")) return { stdout: "Running\n", stderr: "", exitCode: 0 };
        if (commandText.startsWith("Get-Process")) return { stdout: "nginx\n", stderr: "", exitCode: 0 };
        return { stdout: "", stderr: "", exitCode: 1 };
      },
    });

    await expect(deps.getPackageVersion?.("nginx")).resolves.toBe("2.0.0");
    await expect(deps.getServiceStatus?.("nginx")).resolves.toBe("running");
    await expect(deps.isProcessAlive?.("nginx")).resolves.toBe(true);
    expect(calls).toEqual([
      "Get-Package -Name 'nginx' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Version",
      "Get-Service -Name 'nginx' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Status",
      "Get-Process -Name 'nginx' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty ProcessName",
    ]);
  });

  it("checks local TCP ports through the default verifier probes", async () => {
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP server address");

    const deps = createDefaultVerifyDeps({ platform: "linux", packageManagers: [] });

    await expect(deps.isPortOpen?.(address.port)).resolves.toBe(true);
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await expect(deps.isPortOpen?.(address.port)).resolves.toBe(false);
  });
});

describe("formatApplyResult", () => {
  it("prints rollback recommendation when verification fails without auto rollback", async () => {
    const output = formatApplyResult({
      runId: "run_plan_1",
      risk: "L1",
      gate: { allowed: true, reason: "risk gate passed" },
      commands: [],
      stepResults: [],
      verificationResults: [
        { verification: { type: "smoke-test", cmd: "false" }, ok: false, message: "smoke-test exited 1" },
      ],
      rollback: {
        trigger: "verification-failed",
        autoExecuted: false,
        available: true,
        reason: "rollback recommended after verification-failed",
        suggestedCommand: "opsforge rollback run_plan_1",
      },
      auditEvents: [],
      dryRun: false,
    });

    expect(output).toContain("Rollback:           recommended (rollback recommended after verification-failed)");
    expect(output).toContain("Suggested command:  opsforge rollback run_plan_1");
  });
});
