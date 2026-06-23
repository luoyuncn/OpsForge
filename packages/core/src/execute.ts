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
}

export interface ExecutePlanResult {
  runId: string;
  risk: RiskLevel;
  gate: GateDecision;
  commands: CompiledCommand[];
  stepResults: StepResult[];
  verificationResults: VerificationResult[];
  auditEvents: ReturnType<AuditRecorder["events"]>;
}

const now = (): string => new Date().toISOString();

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

    commands.push(command);
  }

  return { commands };
};

export const executePlan = async (input: ExecutePlanInput): Promise<ExecutePlanResult> => {
  const runId = createRunId(input.plan.id);
  const classified = classifyPlanRisk(input.plan);
  input.audit.record({
    type: "plan.created",
    at: now(),
    payload: { planId: input.plan.id, intent: input.plan.intent, risk: input.plan.risk },
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
      auditEvents: input.audit.events(),
    };
  }

  if (input.dryRun) {
    return {
      runId,
      risk: classified.risk,
      gate,
      commands: compiled.commands,
      stepResults: [],
      verificationResults: [],
      auditEvents: input.audit.events(),
    };
  }

  input.audit.record({ type: "job.dispatched", at: now(), payload: { runId, planId: input.plan.id } });

  const stepResults: StepResult[] = [];
  for (const [index, step] of input.plan.steps.entries()) {
    const command = compiled.commands[index];
    input.audit.record({ type: "run.step.started", at: now(), payload: { runId, step, command } });
    const result = await input.executor.run(step, command, input.runner, { maxOutputBytes: 64_000 });
    stepResults.push(result);
    input.audit.record({ type: "run.step.finished", at: now(), payload: { runId, step, exitCode: result.exitCode } });
    if (result.exitCode !== 0) break;
  }

  const verificationResults = await verifyPlan(input.plan.verifications, input.verifyDeps);
  input.audit.record({ type: "run.verified", at: now(), payload: { runId, results: verificationResults } });

  return {
    runId,
    risk: classified.risk,
    gate,
    commands: compiled.commands,
    stepResults,
    verificationResults,
    auditEvents: input.audit.events(),
  };
};
