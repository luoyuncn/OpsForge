import type { CompiledCommandLike } from "./types";
import type { GuardDecision } from "./path-guard";

const commandText = (cmd: CompiledCommandLike): string =>
  Array.isArray(cmd.argv) ? cmd.argv.join(" ") : cmd.argv;

const BLOCKED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(curl|wget)\b.+\|\s*(sh|bash|pwsh|powershell)\b/i, reason: "download-and-execute pipeline blocked" },
  { pattern: /\brm\s+-rf\s+\/(?:\s|$)/i, reason: "destructive root removal blocked" },
  { pattern: /\bRemove-Item\b.+\b-Recurse\b.+\b-Force\b.+C:\\Windows/i, reason: "destructive Windows removal blocked" },
  { pattern: /\/etc\/sudoers|\/etc\/ssh\/sshd_config|\/root\/\.ssh/i, reason: "protected security file edit blocked" },
  { pattern: /C:\\Windows\\System32|HKLM:\\SYSTEM/i, reason: "protected Windows system path blocked" },
];

export const guardCommand = (cmd: CompiledCommandLike): GuardDecision => {
  const text = commandText(cmd);
  const blocked = BLOCKED_PATTERNS.find((entry) => entry.pattern.test(text));
  if (blocked) return { allowed: false, reason: blocked.reason };
  return { allowed: true, reason: "command allowed" };
};
