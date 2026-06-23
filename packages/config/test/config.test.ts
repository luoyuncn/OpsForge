import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { loadConfig, loadConfigFile, resolveProvider, writeConfigFile } from "../src/index";

describe("loadConfig", () => {
  it("applies defaults with empty env and no file", () => {
    const c = loadConfig({ env: {}, fileContents: null });
    expect(c.riskMax).toBe("L3");
    expect(c.allowShell).toBe(false);
    expect(c.provider).toBeUndefined();
  });

  it("overrides riskMax and allowShell from env", () => {
    const c = loadConfig({ env: { OPSFORGE_RISK_MAX: "L1", OPSFORGE_ALLOW_SHELL: "1" }, fileContents: null });
    expect(c.riskMax).toBe("L1");
    expect(c.allowShell).toBe(true);
  });

  it("reads provider and riskMax from file", () => {
    const file = JSON.stringify({ riskMax: "L2", provider: { kind: "pi" } });
    const c = loadConfig({ env: {}, fileContents: file });
    expect(c.riskMax).toBe("L2");
    expect(c.provider?.kind).toBe("pi");
  });
});

describe("resolveProvider", () => {
  it("prefers anthropic when its key is present", () => {
    expect(resolveProvider(undefined, { ANTHROPIC_API_KEY: "x" })?.kind).toBe("anthropic");
  });

  it("uses openai-compatible with base url", () => {
    const p = resolveProvider(undefined, { OPENAI_API_KEY: "x", OPENAI_BASE_URL: "https://api.example.com/v1" });
    expect(p).toEqual({
      kind: "openai-compatible",
      model: "gpt-4.1-mini",
      baseUrl: "https://api.example.com/v1",
      apiKeyEnv: "OPENAI_API_KEY",
    });
  });

  it("returns undefined when no key is present", () => {
    expect(resolveProvider(undefined, {})).toBeUndefined();
  });
});

describe("config file persistence", () => {
  it("writes and loads provider settings from a local config file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opsforge-config-"));
    const configPath = join(dir, "config.json");

    try {
      await writeConfigFile(configPath, {
        provider: {
          kind: "openai-compatible",
          model: "gpt-4.1-mini",
          baseUrl: "https://llm.example.com/v1",
          apiKeyEnv: "OPENAI_API_KEY",
        },
        riskMax: "L3",
        allowShell: false,
        dbPath: "~/.opsforge/opsforge.db",
        artifactsDir: "~/.opsforge/artifacts",
      });

      const loaded = await loadConfigFile(configPath, { env: { OPENAI_API_KEY: "secret" } });

      expect(loaded.provider).toEqual({
        kind: "openai-compatible",
        model: "gpt-4.1-mini",
        baseUrl: "https://llm.example.com/v1",
        apiKeyEnv: "OPENAI_API_KEY",
      });
      expect(loaded.riskMax).toBe("L3");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
