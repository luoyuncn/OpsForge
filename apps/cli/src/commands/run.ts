import { Command } from "commander";
import type { Plan } from "@opsforge/dsl";
import { buildPlanFromPrompt, createMockPlanProvider, type PlanProvider } from "@opsforge/planner";
import {
  executeParsedPlan,
  formatApplyResult,
  parseRiskMax,
  type ApplyOptions,
  type ApplyResult,
  type ExecutePlanDeps,
} from "./apply";

export interface BuildRunCommandDeps extends ExecutePlanDeps {
  provider?: PlanProvider;
  write?: (text: string) => void;
  now?: () => string;
  planId?: () => string;
}

export interface RunCommandResult {
  plan: Plan;
  result: ApplyResult;
}

export const formatRunResult = ({ plan, result }: RunCommandResult): string => [
  "OpsForge run",
  `  Plan ID:            ${plan.id}`,
  `  Plan title:         ${plan.title}`,
  "",
  formatApplyResult(result),
].join("\n");

export const buildRunCommand = (deps: BuildRunCommandDeps = {}): Command => {
  const write = deps.write ?? ((text: string) => console.log(text));
  const command = new Command("run");

  command
    .description("根据自然语言生成 Plan 并执行")
    .argument("<prompt>", "Natural language operation goal")
    .option("--dry-run", "只生成、编译和检查，不执行", false)
    .option("-y, --yes", "批准 L2/L3 风险门禁", false)
    .option("--json", "输出 JSON", false)
    .option("--risk-max <level>", "允许的最高风险等级", "L3")
    .option("--allow-shell", "允许 shell 逃生舱步骤", false)
    .action(async (prompt: string, options: { dryRun: boolean; yes: boolean; json: boolean; riskMax: string; allowShell: boolean }) => {
      const plan = await buildPlanFromPrompt({
        prompt,
        provider: deps.provider ?? createMockPlanProvider(),
        now: deps.now,
        planId: deps.planId,
      });
      const applyOptions: ApplyOptions = {
        dryRun: options.dryRun,
        yes: options.yes,
        json: options.json,
        riskMax: parseRiskMax(options.riskMax),
        allowShell: options.allowShell,
      };
      const result = await executeParsedPlan(plan, applyOptions, deps);
      const payload = { plan, result };
      write(options.json ? JSON.stringify(payload, null, 2) : formatRunResult(payload));
      if (!result.gate.allowed) process.exitCode = 1;
    });

  return command;
};
