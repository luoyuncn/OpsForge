import type { Plan, RiskLevel, Step } from "@opsforge/dsl";

export type AuditEvent =
  | { type: "plan.created"; at: string; payload: { planId: string; intent: Plan["intent"]; risk: RiskLevel } }
  | { type: "plan.classified"; at: string; payload: { planId: string; risk: RiskLevel } }
  | { type: "gate.confirmed"; at: string; payload: { planId: string; risk: RiskLevel; reason?: string } }
  | { type: "job.dispatched"; at: string; payload: { runId: string; planId: string } }
  | { type: "run.step.started"; at: string; payload: { runId: string; step: Step; command: unknown } }
  | { type: "run.step.finished"; at: string; payload: { runId: string; step: Step; exitCode: number } }
  | { type: "run.verified"; at: string; payload: { runId: string; results: unknown[] } }
  | { type: "run.rollback.started"; at: string; payload: { runId: string } }
  | { type: "run.rollback.finished"; at: string; payload: { runId: string; results: unknown[] } };

export interface AuditRecorder {
  record(event: AuditEvent): void;
  events(): AuditEvent[];
}
