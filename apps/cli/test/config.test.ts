import { describe, expect, it } from "vitest";
import type { OpsForgeConfig } from "@opsforge/config";
import { buildConfigCommand, formatConfig } from "../src/commands/config";

const baseConfig = (): OpsForgeConfig => ({
  riskMax: "L3",
  allowShell: false,
  dbPath: "~/.opsforge/opsforge.db",
  artifactsDir: "~/.opsforge/artifacts",
});

describe("buildConfigCommand", () => {
  it("stores an OpenAI-compatible provider in the local config file", async () => {
    const writes: string[] = [];
    const saved: OpsForgeConfig[] = [];
    const command = buildConfigCommand({
      configPath: "tmp/config.json",
      write: (text) => writes.push(text),
      load: async () => baseConfig(),
      save: async (_path, config) => {
        saved.push(config);
      },
    });

    await command.parseAsync(
      [
        "provider",
        "openai-compatible",
        "--model",
        "gpt-4.1-mini",
        "--base-url",
        "https://llm.example.com/v1",
        "--api-key-env",
        "OPENAI_API_KEY",
      ],
      { from: "user" },
    );

    expect(saved[0].provider).toEqual({
      kind: "openai-compatible",
      model: "gpt-4.1-mini",
      baseUrl: "https://llm.example.com/v1",
      apiKeyEnv: "OPENAI_API_KEY",
    });
    expect(writes[0]).toContain("Provider configured: openai-compatible");
  });

  it("prints config as JSON", async () => {
    const writes: string[] = [];
    const command = buildConfigCommand({
      write: (text) => writes.push(text),
      load: async () => ({
        ...baseConfig(),
        provider: {
          kind: "openai-compatible",
          model: "gpt-4.1-mini",
          baseUrl: "https://api.openai.com/v1",
          apiKeyEnv: "OPENAI_API_KEY",
        },
      }),
      save: async () => {},
    });

    await command.parseAsync(["show", "--json"], { from: "user" });

    const parsed = JSON.parse(writes[0]);
    expect(parsed.provider.kind).toBe("openai-compatible");
    expect(parsed.provider.model).toBe("gpt-4.1-mini");
  });
});

describe("formatConfig", () => {
  it("prints provider details", () => {
    const output = formatConfig({
      ...baseConfig(),
      provider: {
        kind: "openai-compatible",
        model: "gpt-4.1-mini",
        baseUrl: "https://api.openai.com/v1",
        apiKeyEnv: "OPENAI_API_KEY",
      },
    });

    expect(output).toContain("OpsForge config");
    expect(output).toContain("Provider:         openai-compatible");
    expect(output).toContain("Model:            gpt-4.1-mini");
    expect(output).toContain("Base URL:         https://api.openai.com/v1");
  });
});
