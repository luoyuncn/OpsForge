import type { Plan, Precheck, Step, Verification } from "@opsforge/dsl";
import type { CompiledCommand, HostFacts } from "@opsforge/executor-base";
import { compileLinuxStep } from "@opsforge/executor-linux";
import { compileWindowsStep } from "@opsforge/executor-windows";

export interface TuiCommandPreview {
  shell: CompiledCommand["shell"] | HostFacts["osFamily"];
  command: string;
  needsElevation: boolean;
  describe: string;
}

export interface TuiPlanStepPreview {
  label: string;
  command: TuiCommandPreview;
}

export interface TuiPlanCard {
  id: string;
  title: string;
  intent: Plan["intent"];
  risk: Plan["risk"];
  prechecks: string[];
  steps: TuiPlanStepPreview[];
  verifications: string[];
  rollback: TuiPlanStepPreview[];
  explanation: string[];
}

const commandToString = (argv: CompiledCommand["argv"]): string =>
  Array.isArray(argv) ? argv.join(" ") : argv;

const previewCommand = (step: Step, facts: HostFacts): TuiCommandPreview => {
  try {
    const command = facts.osFamily === "linux"
      ? compileLinuxStep(step, facts)
      : compileWindowsStep(step, facts);

    return {
      shell: command.shell,
      command: commandToString(command.argv),
      needsElevation: command.needsElevation,
      describe: command.describe,
    };
  } catch (error) {
    return {
      shell: facts.osFamily,
      command: `unavailable: ${error instanceof Error ? error.message : String(error)}`,
      needsElevation: false,
      describe: `Cannot compile ${step.type}`,
    };
  }
};

const formatPrecheck = (precheck: Precheck): string => {
  switch (precheck.type) {
    case "os-detect":
      return "os-detect";
    case "privilege-check":
      return `privilege-check${precheck.requireElevated ? " elevated" : ""}`;
    case "disk-check":
      return `disk-check ${precheck.minFreeMB}MB`;
    case "command-exists":
      return `command-exists ${precheck.name}`;
  }
};

const formatStep = (step: Step): string => {
  switch (step.type) {
    case "package-update-cache":
      return "package-update-cache";
    case "package-install":
      return `package-install ${step.name}${step.version ? `@${step.version}` : ""}`;
    case "package-remove":
      return `package-remove ${step.name}`;
    case "service-enable":
      return `service-enable ${step.name}`;
    case "service-start":
      return `service-start ${step.name}`;
    case "service-stop":
      return `service-stop ${step.name}`;
    case "service-status":
      return `service-status ${step.name}`;
    case "file-write":
      return `file-write ${step.path}`;
    case "file-template":
      return `file-template ${step.path}`;
    case "shell":
      return `shell ${step.shell ?? "default"}`;
  }
};

const formatVerification = (verification: Verification): string => {
  switch (verification.type) {
    case "package-version":
      return `package-version ${verification.name}${verification.expect ? ` ${verification.expect}` : ""}`;
    case "service-status":
      return `service-status ${verification.name} ${verification.expect}`;
    case "port-open":
      return `port-open ${verification.port}`;
    case "process-alive":
      return `process-alive ${verification.name}`;
    case "file-checksum":
      return `file-checksum ${verification.path}`;
    case "smoke-test":
      return `smoke-test ${verification.cmd}`;
  }
};

const createStepPreview = (step: Step, facts: HostFacts): TuiPlanStepPreview => ({
  label: formatStep(step),
  command: previewCommand(step, facts),
});

export const createTuiPlanCard = (plan: Plan, facts: HostFacts): TuiPlanCard => ({
  id: plan.id,
  title: plan.title,
  intent: plan.intent,
  risk: plan.risk,
  prechecks: plan.prechecks.map(formatPrecheck),
  steps: plan.steps.map((step) => createStepPreview(step, facts)),
  verifications: plan.verifications.map(formatVerification),
  rollback: plan.rollback.map((step) => createStepPreview(step, facts)),
  explanation: plan.explanation,
});

const formatCommandLine = (step: TuiPlanStepPreview, index: number): string =>
  `${index + 1}. ${step.label} -> ${step.command.command}`;

export const formatPlanCardSnapshot = (card: TuiPlanCard): string => [
  `Plan: ${card.title}`,
  `Intent: ${card.intent}`,
  `Risk: ${card.risk}`,
  "Prechecks:",
  ...(card.prechecks.length ? card.prechecks.map((precheck) => `- ${precheck}`) : ["- none"]),
  "Steps:",
  ...(card.steps.length ? card.steps.map(formatCommandLine) : ["- none"]),
  "Verifications:",
  ...(card.verifications.length ? card.verifications.map((verification) => `- ${verification}`) : ["- none"]),
  "Rollback:",
  ...(card.rollback.length ? card.rollback.map(formatCommandLine) : ["- none"]),
  "Explanation:",
  ...(card.explanation.length ? card.explanation.map((line) => `- ${line}`) : ["- none"]),
].join("\n");
