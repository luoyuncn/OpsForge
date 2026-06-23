import { z } from "zod";

export const ProviderKindSchema = z.enum(["openai-compatible", "anthropic", "google", "pi"]);

export const ProviderConfigSchema = z.object({
  kind: ProviderKindSchema,
  model: z.string().optional(),
  baseUrl: z.string().url().optional(),
});

export const ConfigSchema = z.object({
  provider: ProviderConfigSchema.optional(),
  riskMax: z.enum(["L0", "L1", "L2", "L3"]).default("L3"),
  allowShell: z.boolean().default(false),
  dbPath: z.string().default("~/.opsforge/opsforge.db"),
  artifactsDir: z.string().default("~/.opsforge/artifacts"),
});

export type ProviderKind = z.infer<typeof ProviderKindSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type OpsForgeConfig = z.infer<typeof ConfigSchema>;
