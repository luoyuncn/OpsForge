import React from "react";
import { Box, Text, render } from "ink";
import type { HostFacts } from "@opsforge/executor-base";

export interface TuiStatus {
  facts: HostFacts;
  provider: string;
  model?: string;
  sessionLabel: string;
  auditLabel: string;
}

export interface TuiLaunchOptions {
  facts: HostFacts;
  provider: string;
  model?: string;
  sessionLabel?: string;
  auditLabel?: string;
}

export const createTuiStatus = (options: TuiLaunchOptions): TuiStatus => ({
  facts: options.facts,
  provider: options.provider,
  model: options.model,
  sessionLabel: options.sessionLabel ?? "local",
  auditLabel: options.auditLabel ?? "default",
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
  "Timeline: waiting for a task",
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
      <Text color="gray">Timeline: waiting for a task</Text>
      <Text color="gray">Plan card, execution timeline, approvals, and rollback prompts land in the next TUI plans.</Text>
    </Box>
    <Box marginTop={1}>
      <Text color="green">Ask Forge &gt; </Text>
    </Box>
    <Box marginTop={1}>
      <Text color="gray">Session: {status.sessionLabel} | Audit: {status.auditLabel}</Text>
    </Box>
  </Box>
);

export const runTui = (options: TuiLaunchOptions): void => {
  const status = createTuiStatus(options);
  render(<TuiApp status={status} />);
};
