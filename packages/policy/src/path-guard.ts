import type { Step } from "@opsforge/dsl";

export interface GuardDecision {
  allowed: boolean;
  reason: string;
}

export interface PathGuardOptions {
  allowShell?: boolean;
}

const PROTECTED_PATHS = [
  "/etc/sudoers",
  "/root/.ssh",
  "/etc/ssh/sshd_config",
  "/usr/lib/systemd/system",
  "c:\\windows\\system32",
  "hklm:\\system",
];

const normalizePath = (path: string): string => path.replaceAll("/", "\\").toLowerCase();

export const guardStepPath = (step: Step, options: PathGuardOptions = {}): GuardDecision => {
  if (step.type === "shell" && !options.allowShell) {
    return { allowed: false, reason: "shell steps require allowShell=true" };
  }

  if (step.type !== "file-write" && step.type !== "file-template") {
    return { allowed: true, reason: "no protected path write detected" };
  }

  const rawPath = step.path.toLowerCase();
  const windowsPath = normalizePath(step.path);
  const matched = PROTECTED_PATHS.find((protectedPath) => {
    const normalizedProtected = normalizePath(protectedPath);
    return rawPath.startsWith(protectedPath) || windowsPath.startsWith(normalizedProtected);
  });

  if (matched) {
    return { allowed: false, reason: `protected path blocked: ${matched}` };
  }

  return { allowed: true, reason: "path allowed" };
};
