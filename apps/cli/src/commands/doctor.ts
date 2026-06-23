import { loadConfig } from "@opsforge/config";
import { detectOs, detectPackageManagers, type WhichRunner } from "../detect";

export interface DoctorDeps {
  platform: NodeJS.Platform;
  which: WhichRunner;
  env: Record<string, string | undefined>;
}

export interface DoctorReport {
  os: string;
  arch: string;
  packageManagers: string[];
  provider: string;
  riskMax: string;
  allowShell: boolean;
}

export function buildDoctorReport(deps: DoctorDeps): DoctorReport {
  const os = detectOs(deps.platform);
  const config = loadConfig({ env: deps.env, fileContents: null });
  const p = config.provider;
  return {
    os,
    arch: process.arch,
    packageManagers: detectPackageManagers(os, deps.which),
    provider: p ? `${p.kind}${p.model ? ` (${p.model})` : ""}` : "未配置",
    riskMax: config.riskMax,
    allowShell: config.allowShell,
  };
}

export function formatDoctorReport(r: DoctorReport): string {
  return [
    "OpsForge doctor",
    `  OS:               ${r.os}`,
    `  Arch:             ${r.arch}`,
    `  Package managers: ${r.packageManagers.length ? r.packageManagers.join(", ") : "（未检测到）"}`,
    `  Provider:         ${r.provider}`,
    `  Risk max:         ${r.riskMax}`,
    `  Allow shell:      ${r.allowShell}`,
  ].join("\n");
}
