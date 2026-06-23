import type { AuditRecorder } from "@opsforge/audit";
import type { Plan, RiskLevel } from "@opsforge/dsl";
import type { CommandRunner, CompiledCommand, Executor, HostFacts, StepResult } from "@opsforge/executor-base";
import { classifyPlanRisk, evaluateGate, guardCommand, guardStepPath, type GateDecision } from "@opsforge/policy";
import { verifyPlan, type VerificationResult, type VerifyDeps } from "@opsforge/verifier";
import { createRunId } from "./ids";

export interface ExecutePlanInput {
  plan: Plan;
  executor: Executor;
  facts: HostFacts;
  audit: AuditRecorder;
  dryRun: boolean;
  yes: boolean;
  riskMax: RiskLevel;
  allowShell: boolean;
  runner: CommandRunner;
  verifyDeps: VerifyDeps;
  autoRollback?: boolean;
}

export interface RollbackPlanInput extends ExecutePlanInput {
  originalRunId: string;
}

export interface VerifyStoredPlanInput {
  originalRunId: string;
  plan: Plan;
  audit: AuditRecorder;
  verifyDeps: VerifyDeps;
}

export interface ExecutePlanResult {
  runId: string;
  risk: RiskLevel;
  gate: GateDecision;
  commands: CompiledCommand[];
  stepResults: StepResult[];
  verificationResults: VerificationResult[];
  rollback: RollbackOutcome;
  auditEvents: ReturnType<AuditRecorder["events"]>;
}

export type RollbackTrigger = "step-failed" | "verification-failed";

export interface RollbackOutcome {
  trigger?: RollbackTrigger;
  autoExecuted: boolean;
  available: boolean;
  reason: string;
  suggestedCommand?: string;
  result?: ExecutePlanResult;
}

export interface VerifyStoredPlanResult {
  originalRunId: string;
  verificationResults: VerificationResult[];
  auditEvents: ReturnType<AuditRecorder["events"]>;
}

const now = (): string => new Date().toISOString();

const emptyRollbackOutcome = (): RollbackOutcome => ({
  autoExecuted: false,
  available: false,
  reason: "rollback not needed",
});

const compileAndGuard = (input: ExecutePlanInput): { commands: CompiledCommand[]; gate?: GateDecision } => {
  const commands: CompiledCommand[] = [];

  for (const step of input.plan.steps) {
    const pathDecision = guardStepPath(step, { allowShell: input.allowShell });
    if (!pathDecision.allowed) {
      return { commands: [], gate: pathDecision };
    }

    const command = input.executor.compile(step, input.facts);
    const commandDecision = guardCommand(command);
    if (!commandDecision.allowed) {
      return { commands: [], gate: commandDecision };
    }

    if (!input.dryRun && command.needsElevation && !input.facts.isElevated) {
      return {
        commands: [],
        gate: {
          allowed: false,
          reason: `command requires elevated privileges: ${command.describe}. Re-run OpsForge from an elevated shell before execution.`,
        },
      };
    }

    commands.push(command);
  }

  return { commands };
};

const runCompiledSteps = async (
  input: ExecutePlanInput,
  runId: string,
  commands: CompiledCommand[],
): Promise<StepResult[]> => {
  const stepResults: StepResult[] = [];
  for (const [index, step] of input.plan.steps.entries()) {
    const command = commands[index];
    input.audit.record({ type: "run.step.started", at: now(), payload: { runId, step, command } });
    const result = await input.executor.run(step, command, input.runner, { maxOutputBytes: 64_000 });
    stepResults.push(result);
    input.audit.record({ type: "run.step.finished", at: now(), payload: { runId, step, exitCode: result.exitCode } });
    if (result.exitCode !== 0) break;
  }
  return stepResults;
};

const detectRollbackTrigger = (
  commands: CompiledCommand[],
  stepResults: StepResult[],
  verificationResults: VerificationResult[],
): RollbackTrigger | undefined => {
  if (stepResults.some((result) => result.exitCode !== 0) || stepResults.length < commands.length) return "step-failed";
  if (verificationResults.some((result) => !result.ok)) return "verification-failed";
  return undefined;
};

const buildRollbackOutcome = async (
  input: ExecutePlanInput,
  runId: string,
  trigger: RollbackTrigger | undefined,
): Promise<RollbackOutcome> => {
  if (!trigger) return emptyRollbackOutcome();
  if (input.plan.rollback.length === 0) {
    return { trigger, autoExecuted: false, available: false, reason: "rollback unavailable: plan has no rollback steps" };
  }
  if (!input.autoRollback) {
    return {
      trigger,
      autoExecuted: false,
      available: true,
      reason: `rollback recommended after ${trigger}`,
      suggestedCommand: `opsforge rollback ${runId}`,
    };
  }

  const result = await rollbackPlan({ ...input, originalRunId: runId, dryRun: false, autoRollback: false });
  return { trigger, autoExecuted: true, available: true, reason: `rollback executed after ${trigger}`, result };
};

export const executePlan = async (input: ExecutePlanInput): Promise<ExecutePlanResult> => {
  const runId = createRunId(input.plan.id);
  const classified = classifyPlanRisk(input.plan);
  input.audit.record({
    type: "plan.created",
    at: now(),
    payload: { planId: input.plan.id, intent: input.plan.intent, risk: input.plan.risk, plan: input.plan },
  });
  input.audit.record({
    type: "plan.classified",
    at: now(),
    payload: { planId: input.plan.id, risk: classified.risk },
  });

  const gate = evaluateGate({ risk: classified.risk, riskMax: input.riskMax, yes: input.yes });
  if (!gate.allowed) {
    return {
      runId,
      risk: classified.risk,
      gate,
      commands: [],
      stepResults: [],
      verificationResults: [],
      rollback: emptyRollbackOutcome(),
      auditEvents: input.audit.events(),
    };
  }

  input.audit.record({
    type: "gate.confirmed",
    at: now(),
    payload: { planId: input.plan.id, risk: classified.risk, reason: gate.reason },
  });

  const compiled = compileAndGuard(input);
  if (compiled.gate && !compiled.gate.allowed) {
    return {
      runId,
      risk: classified.risk,
      gate: compiled.gate,
      commands: [],
      stepResults: [],
      verificationResults: [],
      rollback: emptyRollbackOutcome(),
      auditEvents: input.audit.events(),
    };
  }

  if (input.dryRun) {
    input.audit.record({ type: "job.dispatched", at: now(), payload: { runId, planId: input.plan.id } });
    input.audit.record({ type: "run.dry_run.finished", at: now(), payload: { runId } });
    return {
      runId,
      risk: classified.risk,
      gate,
      commands: compiled.commands,
      stepResults: [],
      verificationResults: [],
      rollback: emptyRollbackOutcome(),
      auditEvents: input.audit.events(),
    };
  }

  input.audit.record({ type: "job.dispatched", at: now(), payload: { runId, planId: input.plan.id } });

  const stepResults = await runCompiledSteps(input, runId, compiled.commands);

  const verificationResults = await verifyPlan(input.plan.verifications, input.verifyDeps);
  input.audit.record({ type: "run.verified", at: now(), payload: { runId, results: verificationResults } });
  const rollback = await buildRollbackOutcome(
    input,
    runId,
    detectRollbackTrigger(compiled.commands, stepResults, verificationResults),
  );

  return {
    runId,
    risk: classified.risk,
    gate,
    commands: compiled.commands,
    stepResults,
    verificationResults,
    rollback,
    auditEvents: input.audit.events(),
  };
};

export const rollbackPlan = async (input: RollbackPlanInput): Promise<ExecutePlanResult> => {
  const rollbackOnlyPlan: Plan = {
    ...input.plan,
    id: `${input.plan.id}_rollback`,
    title: `Rollback ${input.plan.title}`,
    intent: "rollback",
    steps: input.plan.rollback,
    verifications: [],
    rollback: [],
  };
  const rollbackInput: ExecutePlanInput = { ...input, plan: rollbackOnlyPlan };
  const runId = createRunId(rollbackOnlyPlan.id);
  const classified = classifyPlanRisk(rollbackOnlyPlan);

  rollbackInput.audit.record({
    type: "plan.created",
    at: now(),
    payload: {
      planId: rollbackOnlyPlan.id,
      intent: rollbackOnlyPlan.intent,
      risk: rollbackOnlyPlan.risk,
      plan: rollbackOnlyPlan,
    },
  });
  rollbackInput.audit.record({
    type: "plan.classified",
    at: now(),
    payload: { planId: rollbackOnlyPlan.id, risk: classified.risk },
  });

  const gate = evaluateGate({ risk: classified.risk, riskMax: rollbackInput.riskMax, yes: rollbackInput.yes });
  if (!gate.allowed) {
    return {
      runId,
      risk: classified.risk,
      gate,
      commands: [],
      stepResults: [],
      verificationResults: [],
      rollback: emptyRollbackOutcome(),
      auditEvents: rollbackInput.audit.events(),
    };
  }

  rollbackInput.audit.record({
    type: "gate.confirmed",
    at: now(),
    payload: { planId: rollbackOnlyPlan.id, risk: classified.risk, reason: gate.reason },
  });
  rollbackInput.audit.record({ type: "run.rollback.started", at: now(), payload: { runId } });

  const compiled = compileAndGuard(rollbackInput);
  if (compiled.gate && !compiled.gate.allowed) {
    return {
      runId,
      risk: classified.risk,
      gate: compiled.gate,
      commands: [],
      stepResults: [],
      verificationResults: [],
      rollback: emptyRollbackOutcome(),
      auditEvents: rollbackInput.audit.events(),
    };
  }

  rollbackInput.audit.record({ type: "job.dispatched", at: now(), payload: { runId, planId: rollbackOnlyPlan.id } });

  if (rollbackInput.dryRun) {
    rollbackInput.audit.record({ type: "run.dry_run.finished", at: now(), payload: { runId } });
    rollbackInput.audit.record({ type: "run.rollback.finished", at: now(), payload: { runId, results: [] } });
    return {
      runId,
      risk: classified.risk,
      gate,
      commands: compiled.commands,
      stepResults: [],
      verificationResults: [],
      rollback: emptyRollbackOutcome(),
      auditEvents: rollbackInput.audit.events(),
    };
  }

  const stepResults = await runCompiledSteps(rollbackInput, runId, compiled.commands);
  rollbackInput.audit.record({ type: "run.rollback.finished", at: now(), payload: { runId, results: stepResults } });

  return {
    runId,
    risk: classified.risk,
    gate,
    commands: compiled.commands,
    stepResults,
    verificationResults: [],
    rollback: emptyRollbackOutcome(),
    auditEvents: rollbackInput.audit.events(),
  };
};

export const verifyStoredPlan = async (input: VerifyStoredPlanInput): Promise<VerifyStoredPlanResult> => {
  const verificationResults = await verifyPlan(input.plan.verifications, input.verifyDeps);
  input.audit.record({
    type: "run.verified",
    at: now(),
    payload: { runId: input.originalRunId, results: verificationResults },
  });

  return {
    originalRunId: input.originalRunId,
    verificationResults,
    auditEvents: input.audit.events(),
  };
};
