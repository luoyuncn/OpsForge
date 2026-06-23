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
  input
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
  if (input) {
    return { state: withApprovalReasonDraft(state, `${state.controls.approvalReasonDraft}${input}`) };
  }
  return { state };
};

const slashCommandAction = (state: TuiState, prompt: string): TuiUserAction | undefined => {
  const command = prompt.trim();
  if (command === "/history") return { type: "audit.history.load" };

  const auditMatch = /^\/audit\s+(.+)$/i.exec(command);
  if (!auditMatch) return undefined;

  const selector = auditMatch[1].trim();
  if (/^[1-9]$/.test(selector)) {
    const run = state.status.auditHistory?.runs[Number(selector) - 1];
    return run ? { type: "audit.run.open", runId: run.runId } : undefined;
  }
  return { type: "audit.run.open", runId: selector };
};

const localSlashCommandState = (state: TuiState, prompt: string): TuiState | undefined => {
  const command = prompt.trim();
  if (command === "/provider") {
    return reduceTuiEvent(state, {
      type: "thinking.delta",
      text: `Provider: ${state.status.provider}; Model: ${state.status.model ?? "default"}`,
    });
  }
  if (command.startsWith("/")) {
    return reduceTuiEvent(state, {
      type: "runtime.error",
      message: `Unknown command: ${command}. Available commands: /provider, /history, /audit <n>.`,
    });
  }
  return undefined;
};

const actionFeedbackText = (action: TuiUserAction): string => {
  switch (action.type) {
    case "submit.prompt":
      return "Planning with the configured provider...";
    case "approval.approve":
      return "Approval recorded; continuing guarded execution...";
    case "approval.deny":
      return "Approval denied.";
    case "rollback.run":
      return `Running rollback for ${action.runId}...`;
    case "rollback.skip":
      return `Rollback skipped for ${action.runId}.`;
    case "audit.history.load":
      return "Loading audit history...";
    case "audit.run.open":
      return `Opening audit run ${action.runId}...`;
  }
};

const withActionFeedback = (state: TuiState, action: TuiUserAction): TuiState =>
  reduceTuiEvent(state, { type: "thinking.delta", text: actionFeedbackText(action) });

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

  if (key.backspace || key.delete) return { state: removeLastInput(state) };
  if (key.return) {
    const prompt = state.input.draft.trim();
    if (!prompt) return { state };
    const next = reduceTuiEvent(state, { type: "input.submitted" });
    const action = slashCommandAction(state, prompt);
    if (action) return { state: withActionFeedback(next, action), action };
    const localState = localSlashCommandState(next, prompt);
    if (localState) return { state: localState };
    const submitAction: TuiUserAction = { type: "submit.prompt", prompt };
    return { state: withActionFeedback(next, submitAction), action: submitAction };
  }

  return { state: appendInput(state, input) };
};
