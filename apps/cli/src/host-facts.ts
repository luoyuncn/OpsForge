import { readFileSync } from "node:fs";
import type { HostFacts } from "@opsforge/executor-base";
import { detectOs, detectPackageManagers, type DetectedOs, type WhichRunner } from "./detect";
import { systemWhich } from "./which";

export interface HostCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface LocalHostFactsOptions {
  platform?: NodeJS.Platform;
  arch?: string;
  which?: WhichRunner;
  getUid?: () => number;
  linuxRelease?: string | null;
  runCommand?: (cmd: string) => Promise<HostCommandResult>;
}

const parseLinuxRelease = (content: string | null | undefined): Pick<HostFacts, "distro" | "version"> => {
  if (!content) return {};
  const values = new Map<string, string>();

  for (const line of content.split(/\r?\n/)) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    const rawValue = match[2] ?? "";
    values.set(match[1], rawValue.replace(/^"|"$/g, ""));
  }

  return {
    distro: values.get("ID"),
    version: values.get("VERSION_ID"),
  };
};

const readLinuxRelease = (): string | null => {
  try {
    return readFileSync("/etc/os-release", "utf8");
  } catch {
    return null;
  }
};

const toSupportedOs = (os: DetectedOs): HostFacts["osFamily"] => {
  if (os === "linux" || os === "windows") return os;
  throw new Error(`Unsupported OS for local host facts: ${os}`);
};

export const detectLocalHostFacts = (options: LocalHostFactsOptions = {}): HostFacts => {
  const os = toSupportedOs(detectOs(options.platform ?? process.platform));
  const getUid = options.getUid ?? process.getuid?.bind(process);

  const release = os === "linux"
    ? parseLinuxRelease(options.linuxRelease === undefined ? readLinuxRelease() : options.linuxRelease)
    : {};

  return {
    osFamily: os,
    arch: options.arch ?? process.arch,
    ...release,
    isElevated: os === "linux" ? getUid?.() === 0 : false,
    packageManagers: detectPackageManagers(os, options.which ?? systemWhich),
  };
};

export const detectLocalHostFactsAsync = async (options: LocalHostFactsOptions = {}): Promise<HostFacts> => {
  const facts = detectLocalHostFacts(options);
  if (facts.osFamily !== "windows") return facts;

  const result = await options.runCommand?.("net session");
  return {
    ...facts,
    isElevated: result?.exitCode === 0,
  };
};
