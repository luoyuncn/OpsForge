import { describe, it, expect } from "vitest";
import { loadConfig, resolveProvider } from "../src/index";

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
    expect(p).toEqual({ kind: "openai-compatible", model: undefined, baseUrl: "https://api.example.com/v1" });
  });

  it("returns undefined when no key is present", () => {
    expect(resolveProvider(undefined, {})).toBeUndefined();
  });
});
