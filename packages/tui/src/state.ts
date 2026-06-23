import type { ExecutePlanResult } from "@opsforge/core";
import type { Plan } from "@opsforge/dsl";
import type { AuditRunReport } from "@opsforge/audit";
import { formatAuditDetailSnapshot, formatAuditHistorySnapshot, type TuiAuditHistory } from "./audit-history";
import { createTuiPlanCard, formatPlanCardSnapshot } from "./plan-card";
import {
  createApprovalPrompt,
  createRollbackPrompt,
  formatApprovalPromptSnapshot,
  formatRollbackPromptSnapshot,
  type ApprovalPromptInput,
  type RollbackPromptInput,
} from "./prompts";
import { createExecutionTimeline, formatExecutionTimelineSnapshot } from "./timeline";
import type { TuiStatus } from "./index";

export interface TuiInputState {
  draft: string;
  lastSubmitted?: string;
}

export interface TuiThinkingState {
  text: string;
}

export interface TuiControlState {
  approvalReasonDraft: string;
}

export interface TuiState {
  status: TuiStatus;
  input: TuiInputState;
  thinking: TuiThinkingState;
  controls: TuiControlState;
}

export type TuiEvent =
  | { type: "thinking.delta"; text: string }
  | { type: "runtime.error"; message: string }
  | { type: "input.changed"; draft: string }
  | { type: "input.submitted" }
  | { type: "plan.ready"; plan: Plan }
  | { type: "execution.finished"; result: ExecutePlanResult }
  | { type: "approval.requested"; approval: ApprovalPromptInput }
  | { type: "rollback.requested"; rollbackPrompt: RollbackPromptInput }
  | { type: "audit.history.loaded"; history: TuiAuditHistory }
  | { type: "audit.run.loaded"; report: AuditRunReport };

export const createInitialTuiState = (status: TuiStatus): TuiState => ({
  status,
  input: {
    draft: status.inputDraft ?? "",
    lastSubmitted: status.lastSubmittedPrompt,
  },
  thinking: {
    text: status.thinkingText ?? "",
  },
  controls: {
    approvalReasonDraft: "",
  },
});

export const reduceTuiEvent = (state: TuiState, event: TuiEvent): TuiState => {
  switch (event.type) {
    case "thinking.delta": {
      const text = `${state.thinking.text}${event.text}`;
      return {
        ...state,
        thinking: { text },
        status: { ...state.status, thinkingText: text, errorText: undefined },
      };
    }
    case "runtime.error":
      return {
        ...state,
        thinking: { text: "" },
        status: { ...state.status, thinkingText: undefined, errorText: event.message },
      };
    case "input.changed":
      return {
        ...state,
        input: { ...state.input, draft: event.draft },
        status: { ...state.status, inputDraft: event.draft },
      };
    case "input.submitted": {
      const submitted = state.input.draft;
      return {
        ...state,
        input: { draft: "", lastSubmitted: submitted },
        thinking: { text: "" },
        status: {
          ...state.status,
          inputDraft: "",
          lastSubmittedPrompt: submitted,
          thinkingText: undefined,
          errorText: undefined,
        },
      };
    }
    case "plan.ready":
      return {
        ...state,
        status: { ...state.status, planCard: createTuiPlanCard(event.plan, state.status.facts) },
      };
    case "execution.finished":
      return {
        ...state,
        status: { ...state.status, timeline: createExecutionTimeline(event.result) },
      };
    case "approval.requested":
      return {
        ...state,
        status: { ...state.status, approvalPrompt: createApprovalPrompt(event.approval) },
      };
    case "rollback.requested":
      return {
        ...state,
        status: { ...state.status, rollbackPrompt: createRollbackPrompt(event.rollbackPrompt) },
      };
    case "audit.history.loaded":
      return {
        ...state,
        status: { ...state.status, auditHistory: event.history },
      };
    case "audit.run.loaded":
      return {
        ...state,
        status: { ...state.status, auditDetail: event.report },
      };
  }
};

export const reduceTuiEvents = (state: TuiState, events: readonly TuiEvent[]): TuiState =>
  events.reduce((current, event) => reduceTuiEvent(current, event), state);

export const formatTuiStateSnapshot = (state: TuiState): string => [
  state.status.errorText ? `Error: ${state.status.errorText}` : undefined,
  state.status.thinkingText ? `Thinking: ${state.status.thinkingText}` : undefined,
  state.status.lastSubmittedPrompt ? `Last prompt: ${state.status.lastSubmittedPrompt}` : undefined,
  `Ask Forge > ${state.status.inputDraft ?? ""}`.trimEnd(),
  state.status.planCard ? formatPlanCardSnapshot(state.status.planCard) : undefined,
  state.status.timeline ? formatExecutionTimelineSnapshot(state.status.timeline) : undefined,
  state.status.approvalPrompt ? formatApprovalPromptSnapshot(state.status.approvalPrompt) : undefined,
  state.status.rollbackPrompt ? formatRollbackPromptSnapshot(state.status.rollbackPrompt) : undefined,
  state.status.auditHistory ? formatAuditHistorySnapshot(state.status.auditHistory) : undefined,
  state.status.auditDetail ? formatAuditDetailSnapshot(state.status.auditDetail) : undefined,
].filter((line): line is string => Boolean(line)).join("\n");
