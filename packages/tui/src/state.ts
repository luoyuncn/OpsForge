import type { ExecutePlanResult } from "@opsforge/core";
import type { Plan } from "@opsforge/dsl";
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

export interface TuiState {
  status: TuiStatus;
  input: TuiInputState;
  thinking: TuiThinkingState;
}

export type TuiEvent =
  | { type: "thinking.delta"; text: string }
  | { type: "input.changed"; draft: string }
  | { type: "input.submitted" }
  | { type: "plan.ready"; plan: Plan }
  | { type: "execution.finished"; result: ExecutePlanResult }
  | { type: "approval.requested"; approval: ApprovalPromptInput }
  | { type: "rollback.requested"; rollbackPrompt: RollbackPromptInput };

export const createInitialTuiState = (status: TuiStatus): TuiState => ({
  status,
  input: {
    draft: status.inputDraft ?? "",
    lastSubmitted: status.lastSubmittedPrompt,
  },
  thinking: {
    text: status.thinkingText ?? "",
  },
});

export const reduceTuiEvent = (state: TuiState, event: TuiEvent): TuiState => {
  switch (event.type) {
    case "thinking.delta": {
      const text = `${state.thinking.text}${event.text}`;
      return {
        ...state,
        thinking: { text },
        status: { ...state.status, thinkingText: text },
      };
    }
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
        status: { ...state.status, inputDraft: "", lastSubmittedPrompt: submitted },
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
  }
};

export const formatTuiStateSnapshot = (state: TuiState): string => [
  state.status.thinkingText ? `Thinking: ${state.status.thinkingText}` : undefined,
  state.status.lastSubmittedPrompt ? `Last prompt: ${state.status.lastSubmittedPrompt}` : undefined,
  `Ask Forge > ${state.status.inputDraft ?? ""}`.trimEnd(),
  state.status.planCard ? formatPlanCardSnapshot(state.status.planCard) : undefined,
  state.status.timeline ? formatExecutionTimelineSnapshot(state.status.timeline) : undefined,
  state.status.approvalPrompt ? formatApprovalPromptSnapshot(state.status.approvalPrompt) : undefined,
  state.status.rollbackPrompt ? formatRollbackPromptSnapshot(state.status.rollbackPrompt) : undefined,
].filter((line): line is string => Boolean(line)).join("\n");
