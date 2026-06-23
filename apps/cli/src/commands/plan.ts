import { Command } from "commander";
import type { Plan } from "@opsforge/dsl";
import { buildPlanFromPrompt, createMockPlanProvider, type PlanProvider } from "@opsforge/planner";

export interface BuildPlanCommandDeps {
  provider?: PlanProvider;
  write?: (text: string) => void;
  now?: () => string;
  planId?: () => string;
}

const stepToText = (step: Plan["steps"][number]): string => {
  if ("name" in step && typeof step.name === "string") return `${step.type} ${step.name}`;
  if ("path" in step && typeof step.path === "string") return `${step.type} ${step.path}`;
  if ("cmd" in step && typeof step.cmd === "string") return `${step.type} ${step.cmd}`;
  return step.type;
};

export const formatPlanResult = (plan: Plan): string => [
  "OpsForge plan",
  `  Plan ID:            ${plan.id}`,
  `  Title:              ${plan.title}`,
  `  Intent:             ${plan.intent}`,
  `  Risk:               ${plan.risk}`,
  `  Steps:              ${plan.steps.length}`,
  ...plan.steps.map((step, index) => `    ${index + 1}. ${stepToText(step)}`),
  `  Verifications:      ${plan.verifications.length}`,
  `  Rollback steps:     ${plan.rollback.length}`,
].join("\n");

export const buildPlanCommand = (deps: BuildPlanCommandDeps = {}): Command => {
  const write = deps.write ?? ((text: string) => console.log(text));
  const command = new Command("plan");

  command
    .description("根据自然语言生成一个结构化 Plan（不执行）")
    .argument("<prompt>", "Natural language operation goal")
    .option("--json", "输出 JSON", false)
    .action(async (prompt: string, options: { json: boolean }) => {
      const plan = await buildPlanFromPrompt({
        prompt,
        provider: deps.provider ?? createMockPlanProvider(),
        now: deps.now,
        planId: deps.planId,
      });
      write(options.json ? JSON.stringify(plan, null, 2) : formatPlanResult(plan));
    });

  return command;
};
