import { execFileSync } from "node:child_process";

/** Probe whether a command exists via the host which/where command. */
export function systemWhich(cmd: string): boolean {
  const probe = process.platform === "win32" ? "where" : "which";
  try {
    execFileSync(probe, [cmd], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
