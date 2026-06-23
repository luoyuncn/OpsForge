import type { AuditRunReport, AuditRunSummary } from "@opsforge/audit";

export interface TuiAuditHistory {
  runs: AuditRunSummary[];
}

export const formatAuditHistorySnapshot = (history: TuiAuditHistory): string => [
  "Audit history",
  ...(history.runs.length
    ? history.runs.map((run, index) =>
      `${index + 1}. ${run.runId} plan=${run.planId} risk=${run.risk} status=${run.status} steps=${run.stepCount}`,
    )
    : ["- none"]),
].join("\n");

export const formatAuditDetailSnapshot = (report: AuditRunReport): string => [
  `Audit detail: ${report.summary.title} (${report.summary.runId})`,
  `Plan: ${report.summary.planId}`,
  `Intent: ${report.summary.intent}`,
  `Risk: ${report.summary.risk}`,
  `Status: ${report.summary.status}`,
  `Rollback: ${report.rollback.status} available=${report.rollback.available}`,
  "Steps:",
  ...(report.steps.length
    ? report.steps.flatMap((step) => [
      `${step.stepIndex + 1}. ${step.label} exit=${step.exitCode ?? "-"}`,
      step.stdoutPath ? `stdout: ${step.stdoutPath}` : undefined,
      step.stderrPath ? `stderr: ${step.stderrPath}` : undefined,
    ].filter((line): line is string => Boolean(line)))
    : ["- none"]),
  "Events:",
  ...(report.eventTimeline.length
    ? report.eventTimeline.map((event) => `${event.index}. ${event.at} ${event.type}`)
    : ["- none"]),
].join("\n");
