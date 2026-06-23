import { Command } from "commander";
import {
  defaultConfigPath,
  loadConfigFile,
  writeConfigFile,
  type OpsForgeConfig,
  type ProviderKind,
} from "@opsforge/config";

export interface BuildConfigCommandDeps {
  configPath?: string;
  write?: (text: string) => void;
  load?: (path: string) => Promise<OpsForgeConfig>;
  save?: (path: string, config: OpsForgeConfig) => Promise<void>;
}

export const formatConfig = (config: OpsForgeConfig): string => {
  const provider = config.provider;
  return [
    "OpsForge config",
    `  Provider:         ${provider?.kind ?? "未配置"}`,
    ...(provider?.model ? [`  Model:            ${provider.model}`] : []),
    ...(provider?.baseUrl ? [`  Base URL:         ${provider.baseUrl}`] : []),
    ...(provider?.apiKeyEnv ? [`  API key env:      ${provider.apiKeyEnv}`] : []),
    `  Risk max:         ${config.riskMax}`,
    `  Allow shell:      ${config.allowShell}`,
    `  DB path:          ${config.dbPath}`,
    `  Artifacts dir:    ${config.artifactsDir}`,
  ].join("\n");
};

export const buildConfigCommand = (deps: BuildConfigCommandDeps = {}): Command => {
  const command = new Command("config");
  const write = deps.write ?? ((text: string) => console.log(text));
  const configPath = deps.configPath ?? defaultConfigPath();
  const load = deps.load ?? loadConfigFile;
  const save = deps.save ?? writeConfigFile;

  command.description("配置 provider、风险默认值和本地存储路径");

  command
    .command("provider")
    .description("配置 planner provider")
    .argument("<kind>", "Provider kind: openai-compatible")
    .option("--model <id>", "Provider model id", "gpt-4.1-mini")
    .option("--base-url <url>", "OpenAI-compatible base URL", "https://api.openai.com/v1")
    .option("--api-key-env <name>", "Environment variable that stores the API key", "OPENAI_API_KEY")
    .action(async (kind: ProviderKind, options: { model: string; baseUrl: string; apiKeyEnv: string }) => {
      if (kind !== "openai-compatible") {
        command.error(`Provider '${kind}' is not implemented yet`);
      }

      const current = await load(configPath);
      const next: OpsForgeConfig = {
        ...current,
        provider: {
          kind,
          model: options.model,
          baseUrl: options.baseUrl,
          apiKeyEnv: options.apiKeyEnv,
        },
      };
      await save(configPath, next);
      write(`Provider configured: ${kind}\nConfig path: ${configPath}`);
    });

  command
    .command("show")
    .description("显示当前配置")
    .option("--json", "输出 JSON", false)
    .action(async (options: { json: boolean }) => {
      const config = await load(configPath);
      write(options.json ? JSON.stringify(config, null, 2) : formatConfig(config));
    });

  return command;
};
