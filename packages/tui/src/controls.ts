import { reduceTuiEvent, type TuiState } from "./state";

export interface TuiKeyInput {
  return?: boolean;
  backspace?: boolean;
  delete?: boolean;
  escape?: boolean;
  ctrl?: boolean;
  meta?: boolean;
}

export type TuiUserAction =
  | { type: "submit.prompt"; prompt: string }
  | { type: "approval.approve"; planId: string; reason?: string }
  | { type: "approval.deny"; planId: string }
  | { type: "rollback.run"; runId: string }
  | { type: "rollback.skip"; runId: string }
  | { type: "audit.history.load" }
  | { type: "audit.run.open"; runId: string };

export interface TuiKeyInputResult {
  state: TuiState;
  action?: TuiUserAction;
}

const appendInput = (state: TuiState, input: string): TuiState =>
  input && input.length === 1
    ? reduceTuiEvent(state, { type: "input.changed", draft: `${state.input.draft}${input}` })
    : state;

const removeLastInput = (state: TuiState): TuiState =>
  reduceTuiEvent(state, { type: "input.changed", draft: state.input.draft.slice(0, -1) });

const withApprovalReasonDraft = (state: TuiState, approvalReasonDraft: string): TuiState => ({
  ...state,
  controls: {
    ...state.controls,
    approvalReasonDraft,
  },
});

const handleRollbackInput = (state: TuiState, input: string): TuiKeyInputResult | undefined => {
  const prompt = state.status.rollbackPrompt;
  if (!prompt?.required) return undefined;
  if (input.toLowerCase() === "r") return { state, action: { type: "rollback.run", runId: prompt.runId } };
  if (input.toLowerCase() === "s") return { state, action: { type: "rollback.skip", runId: prompt.runId } };
  return { state };
};

const handleApprovalInput = (state: TuiState, input: string, key: TuiKeyInput): TuiKeyInputResult | undefined => {
  const prompt = state.status.approvalPrompt;
  if (!prompt?.required || prompt.status !== "required") return undefined;

  if (!prompt.reasonRequired) {
    if (input.toLowerCase() === "a") return { state, action: { type: "approval.approve", planId: prompt.planId } };
    if (input.toLowerCase() === "d") return { state, action: { type: "approval.deny", planId: prompt.planId } };
    return { state };
  }

  if (key.escape) return { state, action: { type: "approval.deny", planId: prompt.planId } };
  if (key.backspace || key.delete) {
    return { state: withApprovalReasonDraft(state, state.controls.approvalReasonDraft.slice(0, -1)) };
  }
  if (key.return) {
    const reason = state.controls.approvalReasonDraft.trim();
    return reason
      ? {
        state: withApprovalReasonDraft(state, ""),
        action: { type: "approval.approve", planId: prompt.planId, reason },
      }
      : { state };
  }
  if (input && input.length === 1) {
    return { state: withApprovalReasonDraft(state, `${state.controls.approvalReasonDraft}${input}`) };
  }
  return { state };
};

const handleAuditInput = (state: TuiState, input: string): TuiKeyInputResult | undefined => {
  if (state.input.draft) return undefined;
  if (input.toLowerCase() === "h") return { state, action: { type: "audit.history.load" } };
  if (/^[1-9]$/.test(input)) {
    const run = state.status.auditHistory?.runs[Number(input) - 1];
    return run ? { state, action: { type: "audit.run.open", runId: run.runId } } : { state };
  }
  return undefined;
};

export const reduceTuiKeyInput = (
  state: TuiState,
  input: string,
  key: TuiKeyInput,
): TuiKeyInputResult => {
  if (key.ctrl || key.meta) return { state };

  const rollback = handleRollbackInput(state, input);
  if (rollback) return rollback;

  const approval = handleApprovalInput(state, input, key);
  if (approval) return approval;

  const audit = handleAuditInput(state, input);
  if (audit) return audit;

  if (key.backspace || key.delete) return { state: removeLastInput(state) };
  if (key.return) {
    const prompt = state.input.draft.trim();
    if (!prompt) return { state };
    const next = reduceTuiEvent(state, { type: "input.submitted" });
    return { state: next, action: { type: "submit.prompt", prompt } };
  }

  return { state: appendInput(state, input) };
};
