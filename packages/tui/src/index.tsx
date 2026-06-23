import React from "react";
import { Box, Text, render, useInput } from "ink";
import type { ExecutePlanResult } from "@opsforge/core";
import type { Plan } from "@opsforge/dsl";
import type { HostFacts } from "@opsforge/executor-base";
import {
  createTuiPlanCard,
  formatPlanCardSnapshot,
  type TuiPlanCard,
} from "./plan-card";
import {
  createApprovalPrompt,
  createRollbackPrompt,
  formatApprovalPromptSnapshot,
  formatRollbackPromptSnapshot,
  type ApprovalPromptInput,
  type RollbackPromptInput,
  type TuiApprovalPrompt,
  type TuiRollbackPrompt,
} from "./prompts";
import {
  createExecutionTimeline,
  formatExecutionTimelineSnapshot,
  type TuiExecutionTimeline,
} from "./timeline";
import { reduceTuiKeyInput, type TuiUserAction } from "./controls";
import { createInitialTuiState, type TuiState } from "./state";

export {
  reduceTuiKeyInput,
  type TuiKeyInput,
  type TuiKeyInputResult,
  type TuiUserAction,
} from "./controls";

export {
  createInitialTuiState,
  formatTuiStateSnapshot,
  reduceTuiEvent,
  type TuiControlState,
  type TuiEvent,
  type TuiInputState,
  type TuiState,
  type TuiThinkingState,
} from "./state";

export {
  runtimeEventToTuiEvent,
} from "./runtime-adapter";

export {
  createTuiPlanCard,
  formatPlanCardSnapshot,
  type TuiCommandPreview,
  type TuiPlanCard,
  type TuiPlanStepPreview,
} from "./plan-card";
export {
  createApprovalPrompt,
  createRollbackPrompt,
  formatApprovalPromptSnapshot,
  formatRollbackPromptSnapshot,
  type ApprovalPromptInput,
  type RollbackPromptInput,
  type TuiApprovalPrompt,
  type TuiRollbackPrompt,
  type TuiApprovalStatus,
  type TuiRollbackStatus,
} from "./prompts";
export {
  createExecutionTimeline,
  formatExecutionTimelineSnapshot,
  type TuiExecutionTimeline,
  type TuiTimelineRollback,
  type TuiTimelineStep,
  type TuiTimelineVerification,
} from "./timeline";

export interface TuiStatus {
  facts: HostFacts;
  provider: string;
  model?: string;
  sessionLabel: string;
  auditLabel: string;
  planCard?: TuiPlanCard;
  timeline?: TuiExecutionTimeline;
  approvalPrompt?: TuiApprovalPrompt;
  rollbackPrompt?: TuiRollbackPrompt;
  thinkingText?: string;
  inputDraft?: string;
  lastSubmittedPrompt?: string;
}

export interface TuiLaunchOptions {
  facts: HostFacts;
  provider: string;
  model?: string;
  sessionLabel?: string;
  auditLabel?: string;
  plan?: Plan;
  execution?: ExecutePlanResult;
  approval?: ApprovalPromptInput;
  rollbackPrompt?: RollbackPromptInput;
  thinkingText?: string;
  inputDraft?: string;
  lastSubmittedPrompt?: string;
}

export const createTuiStatus = (options: TuiLaunchOptions): TuiStatus => ({
  facts: options.facts,
  provider: options.provider,
  model: options.model,
  sessionLabel: options.sessionLabel ?? "local",
  auditLabel: options.auditLabel ?? "default",
  planCard: options.plan ? createTuiPlanCard(options.plan, options.facts) : undefined,
  timeline: options.execution ? createExecutionTimeline(options.execution) : undefined,
  approvalPrompt: options.approval ? createApprovalPrompt(options.approval) : undefined,
  rollbackPrompt: options.rollbackPrompt ? createRollbackPrompt(options.rollbackPrompt) : undefined,
  thinkingText: options.thinkingText,
  inputDraft: options.inputDraft,
  lastSubmittedPrompt: options.lastSubmittedPrompt,
});

const formatDistro = (facts: HostFacts): string => {
  if (!facts.distro) return "unknown";
  return `${facts.distro}${facts.version ? ` ${facts.version}` : ""}`;
};

const formatPackageManagers = (facts: HostFacts): string =>
  facts.packageManagers.length ? facts.packageManagers.join(", ") : "none";

export const formatTuiSnapshot = (status: TuiStatus): string => [
  "Forge",
  "OpsForge TUI",
  `OS: ${status.facts.osFamily} ${status.facts.arch}`,
  `Distro: ${formatDistro(status.facts)}`,
  `Elevated: ${status.facts.isElevated}`,
  `Package managers: ${formatPackageManagers(status.facts)}`,
  `Provider: ${status.provider}`,
  `Model: ${status.model ?? "default"}`,
  `Session: ${status.sessionLabel}`,
  `Audit: ${status.auditLabel}`,
  status.thinkingText ? `Thinking: ${status.thinkingText}` : undefined,
  status.lastSubmittedPrompt ? `Last prompt: ${status.lastSubmittedPrompt}` : undefined,
  status.planCard ? formatPlanCardSnapshot(status.planCard) : "Timeline: waiting for a task",
  status.timeline ? formatExecutionTimelineSnapshot(status.timeline) : undefined,
  status.approvalPrompt ? formatApprovalPromptSnapshot(status.approvalPrompt) : undefined,
  status.rollbackPrompt ? formatRollbackPromptSnapshot(status.rollbackPrompt) : undefined,
  `Ask Forge > ${status.inputDraft ?? ""}`.trimEnd(),
].filter((line): line is string => Boolean(line)).join("\n");

export interface TuiAppProps {
  status: TuiStatus;
}

export const TuiApp = ({ status }: TuiAppProps): React.ReactElement => (
  <Box flexDirection="column">
    <Box>
      <Text bold color="cyan">Forge</Text>
      <Text> OpsForge TUI</Text>
    </Box>
    <Box marginTop={1} flexDirection="column">
      <Text>OS: {status.facts.osFamily} {status.facts.arch}</Text>
      <Text>Distro: {formatDistro(status.facts)}</Text>
      <Text>Elevated: {String(status.facts.isElevated)}</Text>
      <Text>Package managers: {formatPackageManagers(status.facts)}</Text>
      <Text>Provider: {status.provider}</Text>
      <Text>Model: {status.model ?? "default"}</Text>
    </Box>
    <Box marginTop={1} flexDirection="column">
      {status.thinkingText ? <Text>Thinking: {status.thinkingText}</Text> : null}
      {status.planCard ? <PlanCardView card={status.planCard} /> : (
        <>
          <Text color="gray">Timeline: waiting for a task</Text>
          <Text color="gray">Plan card, execution timeline, approvals, and rollback prompts land in the next TUI plans.</Text>
        </>
      )}
      {status.timeline ? <ExecutionTimelineView timeline={status.timeline} /> : null}
      {status.approvalPrompt ? <ApprovalPromptView prompt={status.approvalPrompt} /> : null}
      {status.rollbackPrompt ? <RollbackPromptView prompt={status.rollbackPrompt} /> : null}
    </Box>
    <Box marginTop={1}>
      {status.lastSubmittedPrompt ? <Text color="gray">Last prompt: {status.lastSubmittedPrompt} </Text> : null}
      <Text color="green">Ask Forge &gt; {status.inputDraft ?? ""}</Text>
    </Box>
    <Box marginTop={1}>
      <Text color="gray">Session: {status.sessionLabel} | Audit: {status.auditLabel}</Text>
    </Box>
  </Box>
);

export interface TuiInteractiveAppProps {
  initialStatus: TuiStatus;
  onAction?: (action: TuiUserAction) => void | Promise<void>;
}

export const TuiInteractiveApp = ({ initialStatus, onAction }: TuiInteractiveAppProps): React.ReactElement => {
  const [state, setState] = React.useState<TuiState>(() => createInitialTuiState(initialStatus));

  useInput((input, key) => {
    setState((current) => {
      const result = reduceTuiKeyInput(current, input, key);
      if (result.action) void onAction?.(result.action);
      return result.state;
    });
  });

  return <TuiApp status={state.status} />;
};

interface PlanCardViewProps {
  card: TuiPlanCard;
}

const PlanCardView = ({ card }: PlanCardViewProps): React.ReactElement => (
  <Box flexDirection="column">
    <Text bold>Plan: {card.title}</Text>
    <Text>Intent: {card.intent}</Text>
    <Text>Risk: {card.risk}</Text>
    <Box marginTop={1} flexDirection="column">
      <Text color="cyan">Prechecks</Text>
      {(card.prechecks.length ? card.prechecks : ["none"]).map((precheck) => (
        <Text key={precheck}>- {precheck}</Text>
      ))}
    </Box>
    <Box marginTop={1} flexDirection="column">
      <Text color="cyan">Steps</Text>
      {(card.steps.length ? card.steps : []).map((step, index) => (
        <Text key={`${step.label}-${index}`}>{index + 1}. {step.label} -&gt; {step.command.command}</Text>
      ))}
      {card.steps.length === 0 ? <Text>- none</Text> : null}
    </Box>
    <Box marginTop={1} flexDirection="column">
      <Text color="cyan">Verifications</Text>
      {(card.verifications.length ? card.verifications : ["none"]).map((verification) => (
        <Text key={verification}>- {verification}</Text>
      ))}
    </Box>
    <Box marginTop={1} flexDirection="column">
      <Text color="cyan">Rollback</Text>
      {(card.rollback.length ? card.rollback : []).map((step, index) => (
        <Text key={`${step.label}-${index}`}>{index + 1}. {step.label} -&gt; {step.command.command}</Text>
      ))}
      {card.rollback.length === 0 ? <Text>- none</Text> : null}
    </Box>
    <Box marginTop={1} flexDirection="column">
      <Text color="cyan">Explanation</Text>
      {(card.explanation.length ? card.explanation : ["none"]).map((line) => (
        <Text key={line}>- {line}</Text>
      ))}
    </Box>
  </Box>
);

interface ExecutionTimelineViewProps {
  timeline: TuiExecutionTimeline;
}

const ExecutionTimelineView = ({ timeline }: ExecutionTimelineViewProps): React.ReactElement => (
  <Box marginTop={1} flexDirection="column">
    <Text bold>Run: {timeline.runId}</Text>
    <Text>Gate: {timeline.gateReason}</Text>
    <Box marginTop={1} flexDirection="column">
      <Text color="cyan">Execution</Text>
      {timeline.steps.map((step) => (
        <Box key={`${step.label}-${step.command}`} flexDirection="column">
          <Text>{step.label}</Text>
          <Text>command: {step.command}</Text>
          <Text>stdout: {step.stdout}</Text>
          <Text>stderr: {step.stderr}</Text>
          <Text>Exit: {step.exitCode}</Text>
          <Text>Duration: {step.durationMs}ms{step.truncated ? " truncated" : ""}</Text>
        </Box>
      ))}
      {timeline.steps.length === 0 ? <Text>- none</Text> : null}
    </Box>
    <Box marginTop={1} flexDirection="column">
      <Text color="cyan">Verifications</Text>
      {timeline.verifications.map((verification) => (
        <Text key={`${verification.label}-${verification.message}`}>
          Verification: {verification.status} {verification.label} - {verification.message}
        </Text>
      ))}
      {timeline.verifications.length === 0 ? <Text>- none</Text> : null}
    </Box>
    <Box marginTop={1} flexDirection="column">
      <Text color="cyan">Rollback</Text>
      <Text>{timeline.rollback.reason}</Text>
      {timeline.rollback.suggestedCommand ? <Text>{timeline.rollback.suggestedCommand}</Text> : null}
    </Box>
  </Box>
);

interface ApprovalPromptViewProps {
  prompt: TuiApprovalPrompt;
}

const ApprovalPromptView = ({ prompt }: ApprovalPromptViewProps): React.ReactElement => (
  <Box marginTop={1} flexDirection="column">
    <Text bold>Approval: {prompt.status}</Text>
    <Text>Plan: {prompt.title}</Text>
    <Text>Risk: {prompt.risk}</Text>
    <Text>Required: {String(prompt.required)}</Text>
    <Text>Reason: {prompt.reasonRequired ? "required" : "not required"}</Text>
    {prompt.reasonLabel ? <Text>Reason label: {prompt.reasonLabel}</Text> : null}
    <Text>{prompt.message}</Text>
    <Text>Actions: {prompt.actions.length ? prompt.actions.join(", ") : "none"}</Text>
  </Box>
);

interface RollbackPromptViewProps {
  prompt: TuiRollbackPrompt;
}

const RollbackPromptView = ({ prompt }: RollbackPromptViewProps): React.ReactElement => (
  <Box marginTop={1} flexDirection="column">
    <Text bold>Rollback prompt: {prompt.status}</Text>
    <Text>Run: {prompt.runId}</Text>
    <Text>Required: {String(prompt.required)}</Text>
    {prompt.trigger ? <Text>Trigger: {prompt.trigger}</Text> : null}
    <Text>Reason: {prompt.reason}</Text>
    <Text>Actions: {prompt.actions.length ? prompt.actions.join(", ") : "none"}</Text>
    {prompt.suggestedCommand ? <Text>Command: {prompt.suggestedCommand}</Text> : null}
  </Box>
);

const isTuiStatus = (options: TuiLaunchOptions | TuiStatus): options is TuiStatus =>
  "planCard" in options || "timeline" in options || "approvalPrompt" in options || "rollbackPrompt" in options;

export const runTui = (options: TuiLaunchOptions | TuiStatus): void => {
  const status = isTuiStatus(options) ? options : createTuiStatus(options);
  render(<TuiInteractiveApp initialStatus={status} />);
};
