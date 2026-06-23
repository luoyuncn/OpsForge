import { loadConfigFile, type OpsForgeConfig, type ProviderConfig } from "@opsforge/config";
import {
  createAnthropicPlanProvider,
  createGooglePlanProvider,
  createMockPlanProvider,
  createOpenAICompatiblePlanProvider,
  type PlanProvider,
} from "@opsforge/planner";

export class ProviderResolutionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ProviderResolutionError";
  }
}

export type ProviderMode = "mock" | "configured" | "openai-compatible" | "anthropic" | "google";

export interface ResolvePlanProviderOptions {
  provider: string;
  model?: string;
  baseUrl?: string;
  apiKeyEnv?: string;
  env?: Record<string, string | undefined>;
  configPath?: string;
  config?: OpsForgeConfig;
}

export type PlanProviderResolver = (options: ResolvePlanProviderOptions) => Promise<PlanProvider>;

const openAIModel = (config: ProviderConfig, override?: string): string => override ?? config.model ?? "gpt-4.1-mini";
const openAIBaseUrl = (config: ProviderConfig, override?: string): string => override ?? config.baseUrl ?? "https://api.openai.com/v1";
const openAIApiKeyEnv = (config: ProviderConfig, override?: string): string => override ?? config.apiKeyEnv ?? "OPENAI_API_KEY";
const anthropicModel = (config: ProviderConfig, override?: string): string => override ?? config.model ?? "claude-3-5-sonnet-latest";
const anthropicApiKeyEnv = (config: ProviderConfig, override?: string): string => override ?? config.apiKeyEnv ?? "ANTHROPIC_API_KEY";
const googleModel = (config: ProviderConfig, override?: string): string => override ?? config.model ?? "gemini-1.5-flash";
const googleApiKeyEnv = (config: ProviderConfig, override?: string): string => override ?? config.apiKeyEnv ?? "GEMINI_API_KEY";

const createConfiguredProvider = (
  config: ProviderConfig,
  options: ResolvePlanProviderOptions,
  env: Record<string, string | undefined>,
): PlanProvider => {
  const apiKeyEnv =
    config.kind === "anthropic"
      ? anthropicApiKeyEnv(config, options.apiKeyEnv)
      : config.kind === "google"
        ? googleApiKeyEnv(config, options.apiKeyEnv)
        : openAIApiKeyEnv(config, options.apiKeyEnv);
  const apiKey = env[apiKeyEnv];
  if (!apiKey) {
    throw new ProviderResolutionError(`Missing API key environment variable: ${apiKeyEnv}`, "PROVIDER_API_KEY_MISSING");
  }

  if (config.kind === "openai-compatible") {
    return createOpenAICompatiblePlanProvider({
      apiKey,
      model: openAIModel(config, options.model),
      baseUrl: openAIBaseUrl(config, options.baseUrl),
    });
  }

  if (config.kind === "anthropic") {
    return createAnthropicPlanProvider({
      apiKey,
      model: anthropicModel(config, options.model),
      baseUrl: options.baseUrl ?? config.baseUrl,
    });
  }

  if (config.kind === "google") {
    return createGooglePlanProvider({
      apiKey,
      model: googleModel(config, options.model),
      baseUrl: options.baseUrl ?? config.baseUrl,
    });
  }

  throw new ProviderResolutionError(`Provider '${config.kind}' is not implemented yet`, "PROVIDER_NOT_IMPLEMENTED");
};

export const resolvePlanProvider: PlanProviderResolver = async (options) => {
  const env = options.env ?? process.env;

  if (options.provider === "mock") return createMockPlanProvider();

  if (options.provider === "openai-compatible") {
    return createConfiguredProvider(
      {
        kind: "openai-compatible",
        model: options.model,
        baseUrl: options.baseUrl,
        apiKeyEnv: options.apiKeyEnv ?? "OPENAI_API_KEY",
      },
      options,
      env,
    );
  }

  if (options.provider === "anthropic") {
    return createConfiguredProvider(
      {
        kind: "anthropic",
        model: options.model,
        apiKeyEnv: options.apiKeyEnv ?? "ANTHROPIC_API_KEY",
      },
      options,
      env,
    );
  }

  if (options.provider === "google") {
    return createConfiguredProvider(
      {
        kind: "google",
        model: options.model,
        apiKeyEnv: options.apiKeyEnv ?? "GEMINI_API_KEY",
      },
      options,
      env,
    );
  }

  if (options.provider === "configured") {
    const config = options.config ?? (await loadConfigFile(options.configPath, { env }));
    if (!config.provider) {
      throw new ProviderResolutionError("No provider configured. Run `opsforge config provider ...` first.", "PROVIDER_NOT_CONFIGURED");
    }
    return createConfiguredProvider(config.provider, options, env);
  }

  throw new ProviderResolutionError(`Unknown provider mode: ${options.provider}`, "PROVIDER_UNKNOWN");
};
