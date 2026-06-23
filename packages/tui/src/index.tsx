import React from "react";
import { Box, Text, render } from "ink";
import type { Plan } from "@opsforge/dsl";
import type { HostFacts } from "@opsforge/executor-base";
import {
  createTuiPlanCard,
  formatPlanCardSnapshot,
  type TuiPlanCard,
} from "./plan-card";

export {
  createTuiPlanCard,
  formatPlanCardSnapshot,
  type TuiCommandPreview,
  type TuiPlanCard,
  type TuiPlanStepPreview,
} from "./plan-card";

export interface TuiStatus {
  facts: HostFacts;
  provider: string;
  model?: string;
  sessionLabel: string;
  auditLabel: string;
  planCard?: TuiPlanCard;
}

export interface TuiLaunchOptions {
  facts: HostFacts;
  provider: string;
  model?: string;
  sessionLabel?: string;
  auditLabel?: string;
  plan?: Plan;
}

export const createTuiStatus = (options: TuiLaunchOptions): TuiStatus => ({
  facts: options.facts,
  provider: options.provider,
  model: options.model,
  sessionLabel: options.sessionLabel ?? "local",
  auditLabel: options.auditLabel ?? "default",
  planCard: options.plan ? createTuiPlanCard(options.plan, options.facts) : undefined,
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
  status.planCard ? formatPlanCardSnapshot(status.planCard) : "Timeline: waiting for a task",
  "Ask Forge >",
].join("\n");

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
      {status.planCard ? <PlanCardView card={status.planCard} /> : (
        <>
          <Text color="gray">Timeline: waiting for a task</Text>
          <Text color="gray">Plan card, execution timeline, approvals, and rollback prompts land in the next TUI plans.</Text>
        </>
      )}
    </Box>
    <Box marginTop={1}>
      <Text color="green">Ask Forge &gt; </Text>
    </Box>
    <Box marginTop={1}>
      <Text color="gray">Session: {status.sessionLabel} | Audit: {status.auditLabel}</Text>
    </Box>
  </Box>
);

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

export const runTui = (options: TuiLaunchOptions): void => {
  const status = createTuiStatus(options);
  render(<TuiApp status={status} />);
};
