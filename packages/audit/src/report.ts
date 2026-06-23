import type { AuditEvent } from "./events";
import type { AuditRunDetail } from "./summary";

export interface AuditReportSummary {
  runId: string;
  planId: string;
  title: string;
  intent: string;
  risk: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  stepCount: number;
}

export interface AuditReportStep {
  stepIndex: number;
  label: string;
  exitCode?: number;
  stdoutPath?: string;
  stderrPath?: string;
}

export interface AuditReportEvent {
  index: number;
  at: string;
  type: AuditEvent["type"];
}

export interface AuditRollbackReport {
  status: "not-recorded" | "started" | "finished";
  available: boolean;
  eventCount: number;
}

export interface AuditRunReport {
  summary: AuditReportSummary;
  steps: AuditReportStep[];
  eventTimeline: AuditReportEvent[];
  artifactCount: number;
  verificationEventCount: number;
  rollback: AuditRollbackReport;
}

const stepLabel = (step: unknown): string => {
  if (!step || typeof step !== "object" || !("type" in step)) return "unknown step";
  const typed = step as { type: string; name?: string; path?: string; cmd?: string };
  if (typed.name) return `${typed.type} ${typed.name}`;
  if (typed.path) return `${typed.type} ${typed.path}`;
  if (typed.cmd) return `${typed.type} ${typed.cmd}`;
  return typed.type;
};

const rollbackStatus = (events: AuditEvent[]): AuditRollbackReport["status"] => {
  if (events.some((event) => event.type === "run.rollback.finished")) return "finished";
  if (events.some((event) => event.type === "run.rollback.started")) return "started";
  return "not-recorded";
};

export const createAuditRunReport = (run: AuditRunDetail): AuditRunReport => {
  const rollbackEvents = run.events.filter((event) => event.type.startsWith("run.rollback."));
  return {
    summary: {
      runId: run.runId,
      planId: run.planId,
      title: run.plan?.title ?? run.planId,
      intent: run.plan?.intent ?? "unknown",
      risk: run.risk,
      status: run.status,
      startedAt: run.startedAt,
      endedAt: run.endedAt,
      stepCount: run.stepCount,
    },
    steps: run.steps.map((step) => ({
      stepIndex: step.stepIndex,
      label: stepLabel(step.step),
      exitCode: step.exitCode,
      stdoutPath: step.stdoutPath,
      stderrPath: step.stderrPath,
    })),
    eventTimeline: run.events.map((event, index) => ({
      index: index + 1,
      at: event.at,
      type: event.type,
    })),
    artifactCount: run.steps.reduce((count, step) => count + (step.stdoutPath ? 1 : 0) + (step.stderrPath ? 1 : 0), 0),
    verificationEventCount: run.events.filter((event) => event.type === "run.verified").length,
    rollback: {
      status: rollbackStatus(run.events),
      available: Boolean(run.plan?.rollback.length),
      eventCount: rollbackEvents.length,
    },
  };
};

export const formatAuditRunReport = (report: AuditRunReport): string => {
  const lines = [
    `Audit report ${report.summary.runId}`,
    `  Plan:    ${report.summary.title} (${report.summary.planId})`,
    `  Intent:  ${report.summary.intent}`,
    `  Risk:    ${report.summary.risk}`,
    `  Status:  ${report.summary.status}`,
    `  Started: ${report.summary.startedAt}`,
    `  Ended:   ${report.summary.endedAt ?? "-"}`,
    `  Steps:   ${report.summary.stepCount}`,
    `  Artifacts: ${report.artifactCount}`,
    `  Verification events: ${report.verificationEventCount}`,
    `  Rollback: ${report.rollback.status} available=${report.rollback.available}`,
    "Steps",
    ...(report.steps.length
      ? report.steps.flatMap((step) => [
        `${step.stepIndex + 1}. ${step.label} exit=${step.exitCode ?? "-"}`,
        step.stdoutPath ? `   stdout: ${step.stdoutPath}` : undefined,
        step.stderrPath ? `   stderr: ${step.stderrPath}` : undefined,
      ].filter((line): line is string => Boolean(line)))
      : ["- none"]),
    "Events",
    ...report.eventTimeline.map((event) => `${event.index}. ${event.at}  ${event.type}`),
  ];

  return lines.join("\n");
};
