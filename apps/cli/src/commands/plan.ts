import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Command } from "commander";
import type { Plan } from "@opsforge/dsl";
import { buildPlanFromPrompt, type PlanProvider } from "@opsforge/planner";
import { resolvePlanProvider, type PlanProviderResolver } from "../provider";

export interface BuildPlanCommandDeps {
  provider?: PlanProvider;
  resolveProvider?: PlanProviderResolver;
  write?: (text: string) => void;
  writeFile?: (path: string, text: string) => Promise<void>;
  env?: Record<string, string | undefined>;
  configPath?: string;
  now?: () => string;
  planId?: () => string;
}

const stepToText = (step: Plan["steps"][number]): string => {
  if ("name" in step && typeof step.name === "string") return `${step.type} ${step.name}`;
  if ("path" in step && typeof step.path === "string") return `${step.type} ${step.path}`;
  if ("cmd" in step && typeof step.cmd === "string") return `${step.type} ${step.cmd}`;
  return step.type;
};

const writePlanFile = async (path: string, text: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, "utf8");
};

export const formatPlanResult = (plan: Plan, savedPath?: string): string => [
  "OpsForge plan",
  `  Plan ID:            ${plan.id}`,
  `  Title:              ${plan.title}`,
  `  Intent:             ${plan.intent}`,
  `  Risk:               ${plan.risk}`,
  `  Steps:              ${plan.steps.length}`,
  ...plan.steps.map((step, index) => `    ${index + 1}. ${stepToText(step)}`),
  `  Verifications:      ${plan.verifications.length}`,
  `  Rollback steps:     ${plan.rollback.length}`,
  ...(savedPath ? [`  Saved:              ${savedPath}`] : []),
].join("\n");

export const buildPlanCommand = (deps: BuildPlanCommandDeps = {}): Command => {
  const write = deps.write ?? ((text: string) => console.log(text));
  const command = new Command("plan");

  command
    .description("根据自然语言生成一个结构化 Plan（不执行）")
    .argument("<prompt>", "Natural language operation goal")
    .option("--json", "输出 JSON", false)
    .option("--out <file>", "将 Plan JSON 写入文件")
    .option("--provider <mode>", "Provider mode: mock, configured, or openai-compatible", "mock")
    .option("--model <id>", "Provider model id")
    .option("--base-url <url>", "OpenAI-compatible base URL")
    .option("--api-key-env <name>", "Environment variable that stores the API key")
    .action(async (prompt: string, options: { json: boolean; out?: string; provider: string; model?: string; baseUrl?: string; apiKeyEnv?: string }) => {
      const provider =
        deps.provider ??
        (await (deps.resolveProvider ?? resolvePlanProvider)({
          provider: options.provider,
          model: options.model,
          baseUrl: options.baseUrl,
          apiKeyEnv: options.apiKeyEnv,
          env: deps.env,
          configPath: deps.configPath,
        }));
      const plan = await buildPlanFromPrompt({
        prompt,
        provider,
        now: deps.now,
        planId: deps.planId,
      });
      const json = JSON.stringify(plan, null, 2);
      if (options.out) {
        await (deps.writeFile ?? writePlanFile)(options.out, `${json}\n`);
      }
      write(options.json ? json : formatPlanResult(plan, options.out));
    });

  return command;
};
