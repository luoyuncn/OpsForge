import type { AuditEvent } from "./events";

export interface AuditRunSummary {
  runId: string;
  planId: string;
  risk: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  stepCount: number;
}

export interface AuditStepRun {
  stepIndex: number;
  step: unknown;
  exitCode?: number;
  stdoutPath?: string;
  stderrPath?: string;
}

export interface AuditRunDetail extends AuditRunSummary {
  events: AuditEvent[];
  steps: AuditStepRun[];
}
