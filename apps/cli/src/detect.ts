import type { OsFamily } from "@opsforge/dsl";

export type DetectedOs = OsFamily | "other";

export function detectOs(platform: NodeJS.Platform): DetectedOs {
  if (platform === "linux") return "linux";
  if (platform === "win32") return "windows";
  return "other";
}

export type WhichRunner = (cmd: string) => boolean;

const LINUX_PMS = ["apt", "yum", "dnf"];
const WINDOWS_PMS = ["winget", "choco"];

export function detectPackageManagers(os: DetectedOs, which: WhichRunner): string[] {
  const candidates = os === "windows" ? WINDOWS_PMS : os === "linux" ? LINUX_PMS : [];
  return candidates.filter((c) => which(c));
}
