import { execFile } from "node:child_process";
import { readFile as readFileFromDisk } from "node:fs/promises";
import { promisify } from "node:util";
import { createSqliteAuditStore, resolveOpsForgePaths, type AuditStore } from "@opsforge/audit";
import { loadConfig, type OpsForgeConfig } from "@opsforge/config";
import { executePlan, type ExecutePlanResult } from "@opsforge/core";
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
}

export interface ExecutePlanDeps {
  platform?: NodeJS.Platform;
  facts?: HostFacts;
  which?: WhichRunner;
  runner?: CommandRunner;
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
      verifyDeps: {},
    });

    for (const [index, stepResult] of result.stepResults.entries()) {
      audit.recordStepArtifacts(result.runId, index, stepResult.stdout, stepResult.stderr);
    }

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
  ];
  return lines.join("\n");
};

export const parseRiskMax = (value: string): RiskLevel => {
  if (value === "L0" || value === "L1" || value === "L2" || value === "L3") return value;
  throw new Error(`Invalid risk level: ${value}`);
};
