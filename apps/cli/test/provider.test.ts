import { describe, expect, it } from "vitest";
import { resolvePlanProvider } from "../src/provider";

describe("resolvePlanProvider", () => {
  it("creates configured Anthropic and Google providers when keys are present", async () => {
    const anthropic = await resolvePlanProvider({
      provider: "configured",
      config: { provider: { kind: "anthropic", model: "claude-3-5-sonnet-latest", apiKeyEnv: "ANTHROPIC_API_KEY" }, riskMax: "L3", allowShell: false, dbPath: "db", artifactsDir: "artifacts" },
      env: { ANTHROPIC_API_KEY: "x" },
    });
    const google = await resolvePlanProvider({
      provider: "configured",
      config: { provider: { kind: "google", model: "gemini-1.5-flash", apiKeyEnv: "GEMINI_API_KEY" }, riskMax: "L3", allowShell: false, dbPath: "db", artifactsDir: "artifacts" },
      env: { GEMINI_API_KEY: "x" },
    });

    expect(anthropic.name).toBe("anthropic");
    expect(google.name).toBe("google");
  });

  it("reports missing provider keys by provider-specific env var", async () => {
    await expect(resolvePlanProvider({
      provider: "configured",
      config: { provider: { kind: "google", model: "gemini-1.5-flash", apiKeyEnv: "GEMINI_API_KEY" }, riskMax: "L3", allowShell: false, dbPath: "db", artifactsDir: "artifacts" },
      env: {},
    })).rejects.toMatchObject({ code: "PROVIDER_API_KEY_MISSING" });
  });
});
