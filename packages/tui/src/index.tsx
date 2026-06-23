import React from "react";
import { Box, Text, render, useInput } from "ink";
import type { AuditRunReport } from "@opsforge/audit";
import type { ExecutePlanResult } from "@opsforge/core";
import type { Plan } from "@opsforge/dsl";
import type { HostFacts } from "@opsforge/executor-base";
import {
  formatAuditDetailSnapshot,
  formatAuditHistorySnapshot,
  type TuiAuditHistory,
} from "./audit-history";
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
import { createInitialTuiState, reduceTuiEvents, type TuiEvent, type TuiState } from "./state";
import { selectStatusViewModel, type StatusViewModel } from "./state/selectors";
import { createRuntimeError, type TuiStructuredError } from "./domain/errors";

export {
  reduceTuiKeyInput,
  type TuiKeyInput,
  type TuiKeyInputResult,
  type TuiUserAction,
} from "./controls";

export {
  formatAuditDetailSnapshot,
  formatAuditHistorySnapshot,
  type TuiAuditHistory,
} from "./audit-history";

export {
  createInitialTuiState,
  formatTuiStateSnapshot,
  reduceTuiEvent,
  reduceTuiEvents,
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
  parseInput,
  type InputIntent,
} from "./commands/parseInput";

export {
  createRuntimeError,
  createUnknownCommandError,
  type TuiStructuredError,
  type TuiErrorPhase,
} from "./domain/errors";

export {
  selectStatusViewModel,
  type StatusViewModel,
  type StatusViewLevel,
} from "./state/selectors";

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
  auditHistory?: TuiAuditHistory;
  auditDetail?: AuditRunReport;
  thinkingText?: string;
  errorText?: string;
  error?: TuiStructuredError;
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
  auditHistory?: TuiAuditHistory;
  auditDetail?: AuditRunReport;
  thinkingText?: string;
  errorText?: string;
  error?: TuiStructuredError;
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
  auditHistory: options.auditHistory,
  auditDetail: options.auditDetail,
  thinkingText: options.thinkingText,
  errorText: options.errorText,
  error: options.error ?? (options.errorText ? createRuntimeError(options.errorText) : undefined),
  inputDraft: options.inputDraft,
  lastSubmittedPrompt: options.lastSubmittedPrompt,
});

const formatDistro = (facts: HostFacts): string => {
  if (!facts.distro) return "unknown";
  return `${facts.distro}${facts.version ? ` ${facts.version}` : ""}`;
};

const formatPackageManagers = (facts: HostFacts): string =>
  facts.packageManagers.length ? facts.packageManagers.join(", ") : "none";

const TUI_WIDTH = 100;
const SUMMARY_WIDTH = 49;
const STATUS_TEXT_LIMIT = 118;

const normalizeText = (value: string): string => value.replace(/\s+/g, " ").trim();

const truncateText = (value: string, limit = STATUS_TEXT_LIMIT): string => {
  const normalized = normalizeText(value);
  return normalized.length > limit ? `${normalized.slice(0, limit - 3)}...` : normalized;
};

const providerConfigured = (provider: string): boolean =>
  provider !== "未配置" && provider.toLowerCase() !== "unconfigured";

const selectStatusForRender = (status: TuiStatus): StatusViewModel =>
  selectStatusViewModel(createInitialTuiState(status));

const formatStatusLine = (status: TuiStatus): string => {
  const view = selectStatusForRender(status);
  if (view.level === "error") return `Error: ${view.summary}`;
  if (view.level === "busy") return `Thinking: ${view.summary}`;
  return view.summary;
};

const workspacePlaceholder = (status: TuiStatus): string =>
  providerConfigured(status.provider)
    ? "No active run yet. Submit a task to plan, review, execute, verify, and audit it."
    : "Provider is not configured yet. Run `opsforge config provider ...` in another shell, then restart the TUI.";

const hasWorkspaceContent = (status: TuiStatus): boolean =>
  Boolean(
    status.planCard
      || status.timeline
      || status.approvalPrompt
      || status.rollbackPrompt
      || status.auditHistory
      || status.auditDetail,
  );

const snapshotSection = (title: string, lines: readonly (string | undefined)[]): string[] => [
  title,
  ...lines.filter((line): line is string => Boolean(line)),
];

export const formatTuiSnapshot = (status: TuiStatus): string => [
  "Forge OpsForge TUI",
  `Session: ${status.sessionLabel} | Audit: ${status.auditLabel}`,
  "",
  ...snapshotSection("Host", [
    `OS: ${status.facts.osFamily} ${status.facts.arch}`,
    `Distro: ${formatDistro(status.facts)}`,
    `Elevated: ${status.facts.isElevated}`,
    `Package managers: ${formatPackageManagers(status.facts)}`,
  ]),
  "",
  ...snapshotSection("Runtime", [
    `Provider: ${status.provider}`,
    `Model: ${status.model ?? "default"}`,
  ]),
  "",
  ...snapshotSection("Status", [
    formatStatusLine(status),
  ]),
  "",
  ...snapshotSection("Workspace", [
    status.planCard ? formatPlanCardSnapshot(status.planCard) : undefined,
    status.timeline ? formatExecutionTimelineSnapshot(status.timeline) : undefined,
    status.approvalPrompt ? formatApprovalPromptSnapshot(status.approvalPrompt) : undefined,
    status.rollbackPrompt ? formatRollbackPromptSnapshot(status.rollbackPrompt) : undefined,
    status.auditHistory ? formatAuditHistorySnapshot(status.auditHistory) : undefined,
    status.auditDetail ? formatAuditDetailSnapshot(status.auditDetail) : undefined,
    hasWorkspaceContent(status) ? undefined : workspacePlaceholder(status),
  ]),
  "",
  ...snapshotSection("Prompt", [
    status.lastSubmittedPrompt ? `Last prompt: ${status.lastSubmittedPrompt}` : undefined,
    `Ask Forge > ${status.inputDraft ?? ""}`.trimEnd(),
    "Commands: /history, /audit <n>",
  ]),
].filter((line): line is string => Boolean(line)).join("\n");

export interface TuiAppProps {
  status: TuiStatus;
}

interface PanelProps {
  title: string;
  children: React.ReactNode;
  width?: number;
  marginTop?: number;
}

const Panel = ({ title, children, width, marginTop = 0 }: PanelProps): React.ReactElement => (
  <Box
    borderStyle="single"
    borderColor="gray"
    flexDirection="column"
    paddingX={1}
    paddingY={0}
    width={width}
    marginTop={marginTop}
  >
    <Text bold color="cyan">{title}</Text>
    {children}
  </Box>
);

const StatusView = ({ status }: TuiAppProps): React.ReactElement => {
  const view = selectStatusForRender(status);
  const color = view.level === "error" ? "red" : view.level === "warn" ? "yellow" : view.level === "busy" ? "cyan" : "green";
  return (
    <Panel title="Status" width={TUI_WIDTH} marginTop={1}>
      <Text color={color}>{formatStatusLine(status)}</Text>
      {view.level === "error" ? <Text color="gray">{view.title}</Text> : null}
      {view.details.slice(0, 2).map((detail) => <Text key={detail} color="gray">- {truncateText(detail)}</Text>)}
      {view.suggestedAction ? <Text color="gray">Next: {truncateText(view.suggestedAction)}</Text> : null}
      <Text color="gray">Flow: plan - approve - execute - verify - audit - rollback</Text>
    </Panel>
  );
};

const WorkspaceView = ({ status }: TuiAppProps): React.ReactElement => (
  <Panel title="Workspace" width={TUI_WIDTH} marginTop={1}>
    {status.planCard ? <PlanCardView card={status.planCard} /> : null}
    {status.timeline ? <ExecutionTimelineView timeline={status.timeline} /> : null}
    {status.approvalPrompt ? <ApprovalPromptView prompt={status.approvalPrompt} /> : null}
    {status.rollbackPrompt ? <RollbackPromptView prompt={status.rollbackPrompt} /> : null}
    {status.auditHistory ? <AuditHistoryView history={status.auditHistory} /> : null}
    {status.auditDetail ? <AuditDetailView report={status.auditDetail} /> : null}
    {hasWorkspaceContent(status) ? null : (
      <>
        <Text>{workspacePlaceholder(status)}</Text>
        <Text color="gray">Audit commands: /history, /audit &lt;n&gt;</Text>
      </>
    )}
  </Panel>
);

const PromptView = ({ status }: TuiAppProps): React.ReactElement => (
  <Panel title="Prompt" width={TUI_WIDTH} marginTop={1}>
    {status.lastSubmittedPrompt ? <Text color="gray">Last prompt: {status.lastSubmittedPrompt}</Text> : null}
    <Text color="green">Ask Forge &gt; {status.inputDraft ?? ""}</Text>
  </Panel>
);

export const TuiApp = ({ status }: TuiAppProps): React.ReactElement => (
  <Box flexDirection="column" width={TUI_WIDTH}>
    <Box justifyContent="space-between" width={TUI_WIDTH}>
      <Box>
        <Text bold color="cyan">Forge</Text>
        <Text bold> OpsForge</Text>
      </Box>
      <Text color="gray">Session {status.sessionLabel} | Audit {status.auditLabel}</Text>
    </Box>
    <Box marginTop={1} flexDirection="row" width={TUI_WIDTH}>
      <Panel title="Host" width={SUMMARY_WIDTH}>
        <Text>{status.facts.osFamily} {status.facts.arch}</Text>
        <Text>Distro: {formatDistro(status.facts)}</Text>
        <Text>Elevated: {String(status.facts.isElevated)}</Text>
        <Text>Packages: {formatPackageManagers(status.facts)}</Text>
      </Panel>
      <Box width={2} />
      <Panel title="Runtime" width={SUMMARY_WIDTH}>
        <Text color={providerConfigured(status.provider) ? "green" : "yellow"}>Provider: {status.provider}</Text>
        <Text>Model: {status.model ?? "default"}</Text>
        <Text color="gray">Primary surface: TUI</Text>
      </Panel>
    </Box>
    <StatusView status={status} />
    <WorkspaceView status={status} />
    <PromptView status={status} />
  </Box>
);

export interface TuiInteractiveAppProps {
  initialStatus: TuiStatus;
  onAction?: TuiActionHandler;
}

export type TuiActionHandler = (action: TuiUserAction) => void | readonly TuiEvent[] | Promise<void | readonly TuiEvent[]>;

export const TuiInteractiveApp = ({ initialStatus, onAction }: TuiInteractiveAppProps): React.ReactElement => {
  const [state, setState] = React.useState<TuiState>(() => createInitialTuiState(initialStatus));

  useInput((input, key) => {
    setState((current) => {
      const result = reduceTuiKeyInput(current, input, key);
      if (result.action) {
        void Promise.resolve(onAction?.(result.action)).then((events) => {
          if (events?.length) setState((latest) => reduceTuiEvents(latest, events));
        });
      }
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

interface AuditHistoryViewProps {
  history: TuiAuditHistory;
}

const AuditHistoryView = ({ history }: AuditHistoryViewProps): React.ReactElement => (
  <Box marginTop={1} flexDirection="column">
    <Text bold>Audit history</Text>
    {history.runs.length ? history.runs.map((run, index) => (
      <Text key={run.runId}>
        {index + 1}. {run.runId} plan={run.planId} risk={run.risk} status={run.status} steps={run.stepCount}
      </Text>
    )) : <Text>- none</Text>}
  </Box>
);

interface AuditDetailViewProps {
  report: AuditRunReport;
}

const AuditDetailView = ({ report }: AuditDetailViewProps): React.ReactElement => (
  <Box marginTop={1} flexDirection="column">
    <Text bold>Audit detail: {report.summary.title} ({report.summary.runId})</Text>
    <Text>Plan: {report.summary.planId}</Text>
    <Text>Intent: {report.summary.intent}</Text>
    <Text>Risk: {report.summary.risk}</Text>
    <Text>Status: {report.summary.status}</Text>
    <Text>Rollback: {report.rollback.status} available={String(report.rollback.available)}</Text>
    <Box marginTop={1} flexDirection="column">
      <Text color="cyan">Steps</Text>
      {report.steps.length ? report.steps.map((step) => (
        <Box key={step.stepIndex} flexDirection="column">
          <Text>{step.stepIndex + 1}. {step.label} exit={step.exitCode ?? "-"}</Text>
          {step.stdoutPath ? <Text>stdout: {step.stdoutPath}</Text> : null}
          {step.stderrPath ? <Text>stderr: {step.stderrPath}</Text> : null}
        </Box>
      )) : <Text>- none</Text>}
    </Box>
    <Box marginTop={1} flexDirection="column">
      <Text color="cyan">Events</Text>
      {report.eventTimeline.length ? report.eventTimeline.map((event) => (
        <Text key={`${event.index}-${event.type}`}>{event.index}. {event.at} {event.type}</Text>
      )) : <Text>- none</Text>}
    </Box>
  </Box>
);

const isTuiStatus = (options: TuiLaunchOptions | TuiStatus): options is TuiStatus =>
  "planCard" in options || "timeline" in options || "approvalPrompt" in options || "rollbackPrompt" in options;

export interface RunTuiOptions {
  onAction?: TuiActionHandler;
}

export const runTui = (options: TuiLaunchOptions | TuiStatus, runOptions: RunTuiOptions = {}): void => {
  const status = isTuiStatus(options) ? options : createTuiStatus(options);
  render(<TuiInteractiveApp initialStatus={status} onAction={runOptions.onAction} />);
};
