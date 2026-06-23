import type { ExecutePlanResult } from "@opsforge/core";
import type { Plan } from "@opsforge/dsl";
import { classifyPlanRisk } from "@opsforge/policy";
import type { RuntimeEvent } from "./events";

export type RuntimeUserAction =
  | { type: "submit.prompt"; prompt: string }
  | { type: "approval.approve"; planId: string; reason?: string }
  | { type: "approval.deny"; planId: string }
  | { type: "rollback.run"; runId: string }
  | { type: "rollback.skip"; runId: string };

export interface RuntimeActionControllerDeps {
  buildPlan: (prompt: string) => Promise<Plan>;
  executePlan?: (plan: Plan, approval?: { reason?: string }) => Promise<ExecutePlanResult>;
  rollbackRun?: (runId: string) => Promise<ExecutePlanResult>;
  interactive?: boolean;
}

export interface RuntimeActionController {
  handle(action: RuntimeUserAction): Promise<RuntimeEvent[]>;
}

const recoverableError = (message: string): RuntimeEvent[] => [
  { type: "runtime.error", message, recoverable: true },
];

const requiresApproval = (plan: Plan): boolean => {
  const classified = classifyPlanRisk(plan);
  return classified.risk === "L2" || classified.risk === "L3";
};

export const createRuntimeActionController = (
  deps: RuntimeActionControllerDeps,
): RuntimeActionController => {
  let pendingPlan: Plan | undefined;

  const maybeExecute = async (plan: Plan, approval?: { reason?: string }): Promise<RuntimeEvent[]> => {
    if (!deps.executePlan) return [];
    const result = await deps.executePlan(plan, approval);
    return [{ type: "runtime.execution.finished", result }];
  };

  const handleSubmit = async (prompt: string): Promise<RuntimeEvent[]> => {
    const plan = await deps.buildPlan(prompt);
    pendingPlan = plan;
    const events: RuntimeEvent[] = [
      { type: "runtime.thinking.delta", text: "Planning task through the guarded runtime." },
      { type: "runtime.plan.ready", plan },
    ];

    if (requiresApproval(plan)) {
      events.push({
        type: "runtime.approval.requested",
        approval: {
          planId: plan.id,
          title: plan.title,
          risk: classifyPlanRisk(plan).risk,
          interactive: deps.interactive ?? true,
        },
      });
      return events;
    }

    events.push(...await maybeExecute(plan));
    return events;
  };

  const handleApprove = async (planId: string, reason?: string): Promise<RuntimeEvent[]> => {
    if (!pendingPlan || pendingPlan.id !== planId) return recoverableError("No pending plan to approve");
    const plan = pendingPlan;
    pendingPlan = undefined;
    return [
      { type: "runtime.thinking.delta", text: "Approval recorded; resuming guarded execution." },
      ...await maybeExecute(plan, { reason }),
    ];
  };

  const handleDeny = (planId: string): RuntimeEvent[] => {
    if (pendingPlan?.id === planId) pendingPlan = undefined;
    return [{ type: "runtime.thinking.delta", text: `Approval denied for ${planId}.` }];
  };

  const handleRollback = async (runId: string): Promise<RuntimeEvent[]> => {
    if (!deps.rollbackRun) return recoverableError("Rollback handler is not configured");
    const result = await deps.rollbackRun(runId);
    return [
      { type: "runtime.thinking.delta", text: `Running guarded rollback for ${runId}.` },
      { type: "runtime.execution.finished", result },
    ];
  };

  return {
    handle: async (action) => {
      switch (action.type) {
        case "submit.prompt":
          return handleSubmit(action.prompt);
        case "approval.approve":
          return handleApprove(action.planId, action.reason);
        case "approval.deny":
          return handleDeny(action.planId);
        case "rollback.run":
          return handleRollback(action.runId);
        case "rollback.skip":
          return [{ type: "runtime.thinking.delta", text: `Rollback skipped for ${action.runId}.` }];
      }
    },
  };
};
