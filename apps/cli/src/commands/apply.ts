import { execFile } from "node:child_process";
import { readFile as readFileFromDisk } from "node:fs/promises";
import { createConnection } from "node:net";
import { promisify } from "node:util";
import { createSqliteAuditStore, resolveOpsForgePaths, type AuditStore } from "@opsforge/audit";
import { loadConfig, type OpsForgeConfig } from "@opsforge/config";
import { executePlan, rollbackPlan, type ExecutePlanResult, type VerifyStoredPlanInput } from "@opsforge/core";
import { parsePlan, type Plan, type RiskLevel } from "@opsforge/dsl";
import type { CommandRunner, HostFacts, RawCommandResult } from "@opsforge/executor-base";
import { createLinuxExecutor } from "@opsforge/executor-linux";
import { createWindowsExecutor } from "@opsforge/executor-windows";
import { detectOs, detectPackageManagers, type DetectedOs, type WhichRunner } from "../detect";
import { systemWhich } from "../which";

const execFileAsync = promisify(execFile);

export interface ApplyOptions {
  dryRun: boolean;
  yes: boolean;
  json: boolean;
  riskMax: RiskLevel;
  allowShell: boolean;
  autoRollback?: boolean;
}

export interface ExecutePlanDeps {
  platform?: NodeJS.Platform;
  facts?: HostFacts;
  which?: WhichRunner;
  runner?: CommandRunner;
  verifyDeps?: VerifyStoredPlanInput["verifyDeps"];
  auditStore?: AuditStore;
  config?: OpsForgeConfig;
}

export interface BuildApplyDeps extends ExecutePlanDeps {
  readFile?: (path: string) => Promise<string>;
}

export type ApplyResult = ExecutePlanResult & {
  dryRun: boolean;
};

const commandToText = (argv: string[] | string): string => (Array.isArray(argv) ? argv.join(" ") : argv);

export interface DefaultVerifyDepsOptions {
  platform?: NodeJS.Platform;
  packageManagers?: string[];
  runner?: CommandRunner;
}

const defaultRunner: CommandRunner = async (command): Promise<RawCommandResult> => {
  const commandText = commandToText(command.argv);
  const shellArgs = command.shell === "powershell"
    ? ["-NoProfile", "-Command", commandText]
    : ["-lc", commandText];
  const shellBin = command.shell === "powershell" ? "powershell" : "bash";

  try {
    const result = await execFileAsync(shellBin, shellArgs, { windowsHide: true });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; code?: number };
    return { stdout: err.stdout ?? "", stderr: err.stderr ?? "", exitCode: typeof err.code === "number" ? err.code : 1 };
  }
};

const safeBashArg = (value: string): string =>
  /^[A-Za-z0-9_.@/+:-]+$/.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`;

const safePowerShellString = (value: string): string => `'${value.replaceAll("'", "''")}'`;

const firstOutputLine = (stdout: string): string | undefined => {
  const line = stdout.split(/\r?\n/).map((part) => part.trim()).find(Boolean);
  return line;
};

const normalizeServiceStatus = (status: string | undefined): string | undefined => {
  const normalized = status?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "inactive") return "stopped";
  return normalized;
};

const isLocalPortOpen = (port: number, timeoutMs = 500): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    const finish = (open: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });

export const createDefaultVerifyDeps = (
  options: DefaultVerifyDepsOptions = {},
): VerifyStoredPlanInput["verifyDeps"] => {
  const platform = options.platform ?? process.platform;
  const os = detectOs(platform);
  const runner = options.runner ?? defaultRunner;
  const packageManagers = options.packageManagers ?? (os === "linux" || os === "windows"
    ? detectPackageManagers(os, systemWhich)
    : []);
  const runProbe = async (cmd: string) =>
    runner({
      shell: os === "windows" ? "powershell" : "bash",
      argv: cmd,
      needsElevation: false,
      describe: `Verify ${cmd}`,
    });

  return {
    runCommand: (cmd) => runProbe(cmd),
    readFile: (path) => readFileFromDisk(path),
    getPackageVersion: async (name) => {
      if (os === "windows") {
        const result = await runProbe(
          `Get-Package -Name ${safePowerShellString(name)} -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Version`,
        );
        return result.exitCode === 0 ? firstOutputLine(result.stdout) : undefined;
      }

      if (os !== "linux") return undefined;
      const packageName = safeBashArg(name);
      const command = packageManagers.includes("apt")
        ? `dpkg-query -W -f=\${Version} ${packageName}`
        : packageManagers.some((manager) => manager === "dnf" || manager === "yum")
          ? `rpm -q --qf %{VERSION} ${packageName}`
          : undefined;
      if (!command) return undefined;

      const result = await runProbe(command);
      return result.exitCode === 0 ? firstOutputLine(result.stdout) : undefined;
    },
    getServiceStatus: async (name) => {
      if (os === "windows") {
        const result = await runProbe(
          `Get-Service -Name ${safePowerShellString(name)} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Status`,
        );
        return normalizeServiceStatus(firstOutputLine(result.stdout));
      }

      if (os !== "linux") return undefined;
      const result = await runProbe(`systemctl is-active ${safeBashArg(name)}`);
      return normalizeServiceStatus(firstOutputLine(result.stdout));
    },
    isPortOpen: (port) => isLocalPortOpen(port),
    isProcessAlive: async (name) => {
      if (os === "windows") {
        const result = await runProbe(
          `Get-Process -Name ${safePowerShellString(name)} -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty ProcessName`,
        );
        return result.exitCode === 0 && Boolean(firstOutputLine(result.stdout));
      }

      if (os !== "linux") return false;
      const result = await runProbe(`pgrep -x ${safeBashArg(name)}`);
      return result.exitCode === 0;
    },
  };
};

const factsFromHost = (os: DetectedOs, which: WhichRunner): HostFacts => {
  if (os !== "linux" && os !== "windows") {
    throw new Error(`Unsupported OS for apply: ${os}`);
  }
  return {
    osFamily: os,
    arch: process.arch,
    isElevated: false,
    packageManagers: detectPackageManagers(os, which),
  };
};

const executorForFacts = (facts: HostFacts) =>
  facts.osFamily === "windows" ? createWindowsExecutor() : createLinuxExecutor();

const recordArtifacts = (audit: AuditStore, runId: string, stepResults: ExecutePlanResult["stepResults"]): void => {
  for (const [index, stepResult] of stepResults.entries()) {
    audit.recordStepArtifacts(runId, index, stepResult.stdout, stepResult.stderr);
  }
};

export const executeParsedPlan = async (
  plan: Plan,
  options: ApplyOptions,
  deps: ExecutePlanDeps = {},
): Promise<ApplyResult> => {
  const hostOs = detectOs(deps.platform ?? process.platform);
  const facts = deps.facts ?? factsFromHost(plan.osFamily ?? hostOs, deps.which ?? systemWhich);
  const createdAuditStore = deps.auditStore === undefined;
  const audit = deps.auditStore ?? createSqliteAuditStore(resolveOpsForgePaths(deps.config ?? loadConfig()));

  try {
    const result = await executePlan({
      plan,
      executor: executorForFacts(facts),
      facts,
      audit,
      dryRun: options.dryRun,
      yes: options.yes,
      riskMax: options.riskMax,
      allowShell: options.allowShell,
      runner: deps.runner ?? defaultRunner,
      verifyDeps: deps.verifyDeps ?? createDefaultVerifyDeps(),
      autoRollback: options.autoRollback ?? false,
    });

    recordArtifacts(audit, result.runId, result.stepResults);
    if (result.rollback.result) recordArtifacts(audit, result.rollback.result.runId, result.rollback.result.stepResults);

    return { ...result, dryRun: options.dryRun };
  } finally {
    if (createdAuditStore) audit.close();
  }
};

export const executeRollbackPlan = async (
  plan: Plan,
  originalRunId: string,
  options: ApplyOptions,
  deps: ExecutePlanDeps = {},
): Promise<ApplyResult> => {
  const hostOs = detectOs(deps.platform ?? process.platform);
  const facts = deps.facts ?? factsFromHost(plan.osFamily ?? hostOs, deps.which ?? systemWhich);
  const createdAuditStore = deps.auditStore === undefined;
  const audit = deps.auditStore ?? createSqliteAuditStore(resolveOpsForgePaths(deps.config ?? loadConfig()));

  try {
    const result = await rollbackPlan({
      plan,
      originalRunId,
      executor: executorForFacts(facts),
      facts,
      audit,
      dryRun: options.dryRun,
      yes: options.yes,
      riskMax: options.riskMax,
      allowShell: options.allowShell,
      runner: deps.runner ?? defaultRunner,
      verifyDeps: {},
      autoRollback: false,
    });

    recordArtifacts(audit, result.runId, result.stepResults);

    return { ...result, dryRun: options.dryRun };
  } finally {
    if (createdAuditStore) audit.close();
  }
};

export const buildApplyCommand = (deps: BuildApplyDeps = {}) => async (
  planPath: string,
  options: ApplyOptions,
): Promise<ApplyResult> => {
  const readFile = deps.readFile ?? ((path: string) => readFileFromDisk(path, "utf8"));
  const input = await readFile(planPath);
  const plan = parsePlan(JSON.parse(input));
  return executeParsedPlan(plan, options, deps);
};

export const formatApplyResult = (result: ApplyResult): string => {
  const rollbackLines = result.rollback.autoExecuted
    ? [
      `  Rollback:           auto-executed (${result.rollback.reason})`,
      `  Rollback run ID:    ${result.rollback.result?.runId ?? ""}`,
    ]
    : result.rollback.available
      ? [
        `  Rollback:           recommended (${result.rollback.reason})`,
        `  Suggested command:  ${result.rollback.suggestedCommand ?? ""}`,
      ]
      : result.rollback.trigger
        ? [`  Rollback:           unavailable (${result.rollback.reason})`]
        : ["  Rollback:           not needed"];
  const lines = [
    "OpsForge apply",
    `  Run ID:             ${result.runId}`,
    `  Risk:               ${result.risk}`,
    `  Gate:               ${result.gate.allowed ? "allowed" : "denied"} (${result.gate.reason})`,
    `  Dry run: ${result.dryRun}`,
    `  Compiled commands:  ${result.commands.length}`,
    ...result.commands.map((command, index) => `    ${index + 1}. [${command.shell}] ${commandToText(command.argv)} — ${command.describe}`),
    `  Step results:       ${result.stepResults.length}`,
    `  Verifications:      ${result.verificationResults.length}`,
    ...rollbackLines,
  ];
  return lines.join("\n");
};

export const parseRiskMax = (value: string): RiskLevel => {
  if (value === "L0" || value === "L1" || value === "L2" || value === "L3") return value;
  throw new Error(`Invalid risk level: ${value}`);
};
