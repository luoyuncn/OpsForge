import { ConfigSchema, type OpsForgeConfig, type ProviderConfig } from "./schema";

export interface LoadConfigDeps {
  /** Defaults to process.env; injectable for tests. */
  env?: Record<string, string | undefined>;
  /** Raw ~/.opsforge/config.json content; pass null when absent. */
  fileContents?: string | null;
}

/** Merge order: schema defaults <- config file <- environment overrides. */
export function loadConfig(deps: LoadConfigDeps = {}): OpsForgeConfig {
  const env = deps.env ?? process.env;
  const fromFile: unknown = deps.fileContents ? JSON.parse(deps.fileContents) : {};
  const merged = ConfigSchema.parse(fromFile);

  if (env.OPSFORGE_RISK_MAX) {
    merged.riskMax = ConfigSchema.shape.riskMax.parse(env.OPSFORGE_RISK_MAX);
  }
  if (env.OPSFORGE_ALLOW_SHELL === "1" || env.OPSFORGE_ALLOW_SHELL === "true") {
    merged.allowShell = true;
  }

  const resolved = resolveProvider(merged.provider, env);
  if (resolved) merged.provider = resolved;
  return merged;
}

/** Return configured provider, otherwise infer one from environment keys. */
export function resolveProvider(
  existing: ProviderConfig | undefined,
  env: Record<string, string | undefined>,
): ProviderConfig | undefined {
  if (existing) return existing;
  if (env.ANTHROPIC_API_KEY) return { kind: "anthropic", model: env.OPSFORGE_MODEL };
  if (env.OPENAI_API_KEY) {
    return { kind: "openai-compatible", model: env.OPSFORGE_MODEL, baseUrl: env.OPENAI_BASE_URL };
  }
  if (env.GEMINI_API_KEY) return { kind: "google", model: env.OPSFORGE_MODEL };
  return undefined;
}
