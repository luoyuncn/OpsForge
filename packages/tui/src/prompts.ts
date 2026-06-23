import type { RollbackOutcome } from "@opsforge/core";
import type { RiskLevel } from "@opsforge/dsl";

export interface ApprovalPromptInput {
  planId: string;
  title: string;
  risk: RiskLevel;
  interactive: boolean;
}

export type TuiApprovalStatus = "bypassed" | "required" | "non-interactive-denied";

export interface TuiApprovalPrompt {
  planId: string;
  title: string;
  risk: RiskLevel;
  required: boolean;
  reasonRequired: boolean;
  status: TuiApprovalStatus;
  message: string;
  actions: Array<"approve" | "deny">;
  reasonLabel?: string;
}

export interface RollbackPromptInput {
  runId: string;
  rollback: RollbackOutcome;
}

export type TuiRollbackStatus = "not-needed" | "recommended" | "unavailable" | "auto-executed";

export interface TuiRollbackPrompt {
  runId: string;
  required: boolean;
  status: TuiRollbackStatus;
  reason: string;
  trigger?: RollbackOutcome["trigger"];
  actions: Array<"rollback" | "skip">;
  suggestedCommand?: string;
}

export const createApprovalPrompt = (input: ApprovalPromptInput): TuiApprovalPrompt => {
  if (input.risk === "L0" || input.risk === "L1") {
    return {
      planId: input.planId,
      title: input.title,
      risk: input.risk,
      required: false,
      reasonRequired: false,
      status: "bypassed",
      message: `Risk ${input.risk} can run automatically and will still be audited.`,
      actions: [],
    };
  }

  if (!input.interactive) {
    return {
      planId: input.planId,
      title: input.title,
      risk: input.risk,
      required: true,
      reasonRequired: input.risk === "L3",
      status: "non-interactive-denied",
      message: `Risk ${input.risk} is denied unless explicitly approved in an interactive TUI session.`,
      actions: [],
      reasonLabel: input.risk === "L3" ? "Approval reason" : undefined,
    };
  }

  return {
    planId: input.planId,
    title: input.title,
    risk: input.risk,
    required: true,
    reasonRequired: input.risk === "L3",
    status: "required",
    message: input.risk === "L3"
      ? "L3 approval requires a reason before execution can continue."
      : "Approve or deny this plan before execution can continue.",
    actions: ["approve", "deny"],
    reasonLabel: input.risk === "L3" ? "Approval reason" : undefined,
  };
};

export const formatApprovalPromptSnapshot = (prompt: TuiApprovalPrompt): string => [
  `Approval: ${prompt.status}`,
  `Plan: ${prompt.title}`,
  `Risk: ${prompt.risk}`,
  `Required: ${prompt.required}`,
  `Reason: ${prompt.reasonRequired ? "required" : "not required"}`,
  prompt.reasonLabel ? `Reason label: ${prompt.reasonLabel}` : undefined,
  `Message: ${prompt.message}`,
  `Actions: ${prompt.actions.length ? prompt.actions.join(", ") : "none"}`,
].filter((line): line is string => Boolean(line)).join("\n");

const rollbackStatus = (rollback: RollbackOutcome): TuiRollbackStatus => {
  if (rollback.autoExecuted) return "auto-executed";
  if (rollback.available) return "recommended";
  if (rollback.reason === "rollback not needed") return "not-needed";
  return "unavailable";
};

export const createRollbackPrompt = (input: RollbackPromptInput): TuiRollbackPrompt => {
  const status = rollbackStatus(input.rollback);
  const required = status === "recommended";

  return {
    runId: input.runId,
    required,
    status,
    reason: input.rollback.reason,
    trigger: input.rollback.trigger,
    actions: required ? ["rollback", "skip"] : [],
    suggestedCommand: input.rollback.suggestedCommand,
  };
};

export const formatRollbackPromptSnapshot = (prompt: TuiRollbackPrompt): string => [
  `Rollback prompt: ${prompt.status}`,
  `Run: ${prompt.runId}`,
  `Required: ${prompt.required}`,
  prompt.trigger ? `Trigger: ${prompt.trigger}` : undefined,
  `Reason: ${prompt.reason}`,
  `Actions: ${prompt.actions.length ? prompt.actions.join(", ") : "none"}`,
  prompt.suggestedCommand ? `Command: ${prompt.suggestedCommand}` : undefined,
].filter((line): line is string => Boolean(line)).join("\n");
