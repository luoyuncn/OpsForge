import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { loadConfig } from "@opsforge/config";
import type { HostFacts } from "@opsforge/executor-base";
import { describeProviderCapabilities } from "@opsforge/planner";
import { type WhichRunner } from "../detect";
import { detectLocalHostFacts, detectLocalHostFactsAsync, type HostCommandResult } from "../host-facts";

const execFileAsync = promisify(execFile);

export interface DoctorDeps {
  platform: NodeJS.Platform;
  arch?: string;
  which: WhichRunner;
  getUid?: () => number;
  linuxRelease?: string | null;
  runCommand?: (cmd: string) => Promise<HostCommandResult>;
  env: Record<string, string | undefined>;
  fileContents?: string | null;
}

export interface DoctorReport {
  facts: HostFacts;
  provider: string;
  providerCapabilities: string[];
  riskMax: string;
  allowShell: boolean;
  warnings: string[];
}

const buildWarnings = (facts: HostFacts, provider: string): string[] => {
  const warnings: string[] = [];
  if (provider === "未配置") warnings.push("provider is not configured");
  if (facts.packageManagers.length === 0) warnings.push("no supported package manager detected");
  if (!facts.isElevated) {
    warnings.push("current process is not elevated");
    warnings.push("privileged operations will be blocked until OpsForge is started from an elevated shell");
  }
  return warnings;
};

const defaultDoctorCommand = async (cmd: string): Promise<HostCommandResult> => {
  const shellBin = process.platform === "win32" ? "cmd" : "bash";
  const shellArgs = process.platform === "win32" ? ["/c", cmd] : ["-lc", cmd];

  try {
    const result = await execFileAsync(shellBin, shellArgs, { windowsHide: true });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; code?: number };
    return { stdout: err.stdout ?? "", stderr: err.stderr ?? "", exitCode: typeof err.code === "number" ? err.code : 1 };
  }
};

const reportFromFacts = (deps: DoctorDeps, facts: HostFacts): DoctorReport => {
  const config = loadConfig({ env: deps.env, fileContents: deps.fileContents ?? null });
  const p = config.provider;
  const provider = p ? `${p.kind}${p.model ? ` (${p.model})` : ""}` : "未配置";

  return {
    facts,
    provider,
    providerCapabilities: describeProviderCapabilities(p),
    riskMax: config.riskMax,
    allowShell: config.allowShell,
    warnings: buildWarnings(facts, provider),
  };
};

export function buildDoctorReport(deps: DoctorDeps): DoctorReport {
  const facts = detectLocalHostFacts({
    platform: deps.platform,
    arch: deps.arch,
    which: deps.which,
    getUid: deps.getUid,
    linuxRelease: deps.linuxRelease,
  });

  return reportFromFacts(deps, facts);
}

export const buildDoctorReportAsync = async (deps: DoctorDeps): Promise<DoctorReport> => {
  const facts = await detectLocalHostFactsAsync({
    platform: deps.platform,
    arch: deps.arch,
    which: deps.which,
    getUid: deps.getUid,
    linuxRelease: deps.linuxRelease,
    runCommand: deps.runCommand ?? defaultDoctorCommand,
  });

  return reportFromFacts(deps, facts);
};

export function formatDoctorReport(r: DoctorReport): string {
  const distro = r.facts.distro
    ? `${r.facts.distro}${r.facts.version ? ` ${r.facts.version}` : ""}`
    : "（未知）";
  const warnings = r.warnings.length
    ? ["  Warnings:", ...r.warnings.map((warning) => `    - ${warning}`)]
    : ["  Warnings:         none"];
  const capabilities = r.providerCapabilities.length
    ? ["  Provider capabilities:", ...r.providerCapabilities.map((capability) => `    - ${capability}`)]
    : ["  Provider capabilities:", "    - none"];

  return [
    "OpsForge doctor",
    `  OS:               ${r.facts.osFamily}`,
    `  Arch:             ${r.facts.arch}`,
    `  Distro:           ${distro}`,
    `  Elevated:         ${r.facts.isElevated}`,
    `  Package managers: ${r.facts.packageManagers.length ? r.facts.packageManagers.join(", ") : "（未检测到）"}`,
    `  Provider:         ${r.provider}`,
    ...capabilities,
    `  Risk max:         ${r.riskMax}`,
    `  Allow shell:      ${r.allowShell}`,
    ...warnings,
  ].join("\n");
}
