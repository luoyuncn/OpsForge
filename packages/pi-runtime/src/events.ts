import type { ExecutePlanResult } from "@opsforge/core";
import type { Plan, RiskLevel } from "@opsforge/dsl";

export interface RuntimeSessionStatus {
  sessionId: string;
  provider: string;
  model?: string;
  rawShellToolsEnabled: false;
  tools: RuntimeToolName[];
}

export type RuntimeToolName =
  | "inspect_host"
  | "build_plan"
  | "execute_job"
  | "verify_run"
  | "rollback_run";

export interface RuntimeApprovalRequest {
  planId: string;
  title: string;
  risk: RiskLevel;
  interactive: boolean;
}

export interface RuntimeRollbackRequest {
  runId: string;
  rollback: ExecutePlanResult["rollback"];
}

export type RuntimeEvent =
  | { type: "runtime.session.started"; status: RuntimeSessionStatus }
  | { type: "runtime.thinking.delta"; text: string }
  | { type: "runtime.plan.ready"; plan: Plan }
  | { type: "runtime.approval.requested"; approval: RuntimeApprovalRequest }
  | { type: "runtime.execution.finished"; result: ExecutePlanResult }
  | { type: "runtime.rollback.requested"; rollbackPrompt: RuntimeRollbackRequest }
  | { type: "runtime.error"; message: string; recoverable: boolean };

export const runtimeTools: RuntimeToolName[] = [
  "inspect_host",
  "build_plan",
  "execute_job",
  "verify_run",
  "rollback_run",
];

export interface CreateRuntimeSessionStatusOptions {
  sessionId: string;
  provider: string;
  model?: string;
}

export const createRuntimeSessionStatus = (
  options: CreateRuntimeSessionStatusOptions,
): RuntimeSessionStatus => ({
  sessionId: options.sessionId,
  provider: options.provider,
  model: options.model,
  rawShellToolsEnabled: false,
  tools: [...runtimeTools],
});

export const normalizeRuntimeEvent = <TEvent extends RuntimeEvent>(event: TEvent): TEvent => ({ ...event });

export const formatRuntimeEventSummary = (event: RuntimeEvent): string => {
  switch (event.type) {
    case "runtime.session.started":
      return `session: ${event.status.sessionId} ${event.status.provider}`;
    case "runtime.thinking.delta":
      return `thinking: ${event.text}`;
    case "runtime.plan.ready":
      return `plan: ${event.plan.title}`;
    case "runtime.approval.requested":
      return `approval: ${event.approval.risk} ${event.approval.title}`;
    case "runtime.execution.finished":
      return `execution: ${event.result.runId}`;
    case "runtime.rollback.requested":
      return `rollback: ${event.rollbackPrompt.runId} ${event.rollbackPrompt.rollback.reason}`;
    case "runtime.error":
      return `error: ${event.recoverable ? "recoverable" : "fatal"} ${event.message}`;
  }
};
