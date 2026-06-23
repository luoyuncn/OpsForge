import type { ExecutePlanResult } from "@opsforge/core";
import type { CompiledCommand } from "@opsforge/executor-base";

export interface TuiTimelineStep {
  label: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  truncated: boolean;
}

export interface TuiTimelineVerification {
  label: string;
  status: "pass" | "fail";
  message: string;
}

export interface TuiTimelineRollback {
  status: "not-needed" | "recommended" | "unavailable" | "auto-executed";
  reason: string;
  suggestedCommand?: string;
}

export interface TuiExecutionTimeline {
  runId: string;
  risk: ExecutePlanResult["risk"];
  gateReason: string;
  steps: TuiTimelineStep[];
  verifications: TuiTimelineVerification[];
  rollback: TuiTimelineRollback;
}

const commandToString = (argv: CompiledCommand["argv"]): string =>
  Array.isArray(argv) ? argv.join(" ") : argv;

const previewText = (value: string): string => {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return "none";
  return compact.length > 160 ? `${compact.slice(0, 157)}...` : compact;
};

const durationMs = (startedAt: string, endedAt: string): number => {
  const started = Date.parse(startedAt);
  const ended = Date.parse(endedAt);
  if (Number.isNaN(started) || Number.isNaN(ended)) return 0;
  return Math.max(0, ended - started);
};

const rollbackStatus = (rollback: ExecutePlanResult["rollback"]): TuiTimelineRollback["status"] => {
  if (rollback.autoExecuted) return "auto-executed";
  if (rollback.available) return "recommended";
  if (rollback.reason === "rollback not needed") return "not-needed";
  return "unavailable";
};

const formatVerificationLabel = (verification: ExecutePlanResult["verificationResults"][number]["verification"]): string => {
  switch (verification.type) {
    case "package-version":
      return `package-version ${verification.name}`;
    case "service-status":
      return `service-status ${verification.name} ${verification.expect}`;
    case "port-open":
      return `port-open ${verification.port}`;
    case "process-alive":
      return `process-alive ${verification.name}`;
    case "file-checksum":
      return `file-checksum ${verification.path}`;
    case "smoke-test":
      return `smoke-test ${verification.cmd}`;
  }
};

export const createExecutionTimeline = (result: ExecutePlanResult): TuiExecutionTimeline => ({
  runId: result.runId,
  risk: result.risk,
  gateReason: result.gate.reason,
  steps: result.stepResults.map((stepResult, index) => ({
    label: `${index + 1}. ${stepResult.command.describe}`,
    command: commandToString(stepResult.command.argv),
    stdout: previewText(stepResult.stdout),
    stderr: previewText(stepResult.stderr),
    exitCode: stepResult.exitCode,
    durationMs: durationMs(stepResult.startedAt, stepResult.endedAt),
    truncated: stepResult.truncated,
  })),
  verifications: result.verificationResults.map((verificationResult) => ({
    label: formatVerificationLabel(verificationResult.verification),
    status: verificationResult.ok ? "pass" : "fail",
    message: verificationResult.message,
  })),
  rollback: {
    status: rollbackStatus(result.rollback),
    reason: result.rollback.reason,
    suggestedCommand: result.rollback.suggestedCommand,
  },
});

export const formatExecutionTimelineSnapshot = (timeline: TuiExecutionTimeline): string => [
  `Run: ${timeline.runId}`,
  `Risk: ${timeline.risk}`,
  `Gate: ${timeline.gateReason}`,
  "Execution:",
  ...(timeline.steps.length
    ? timeline.steps.map((step) => [
      `${step.label}`,
      `  command: ${step.command}`,
      `  stdout: ${step.stdout}`,
      `  stderr: ${step.stderr}`,
      `  Exit: ${step.exitCode}`,
      `  Duration: ${step.durationMs}ms${step.truncated ? " truncated" : ""}`,
    ].join("\n"))
    : ["- none"]),
  "Verifications:",
  ...(timeline.verifications.length
    ? timeline.verifications.map((verification) =>
      `- Verification: ${verification.status} ${verification.label} - ${verification.message}`)
    : ["- none"]),
  `Rollback: ${timeline.rollback.reason}`,
  timeline.rollback.suggestedCommand ? `Rollback command: ${timeline.rollback.suggestedCommand}` : undefined,
].filter((line): line is string => Boolean(line)).join("\n");
