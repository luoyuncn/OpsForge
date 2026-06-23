import { describe, expect, it } from "vitest";
import { createTuiStatus, formatTuiSnapshot } from "../src/index";

describe("createTuiStatus", () => {
  it("keeps host facts and provider status for the TUI shell", () => {
    const status = createTuiStatus({
      facts: {
        osFamily: "linux",
        arch: "x64",
        distro: "ubuntu",
        version: "24.04",
        isElevated: true,
        packageManagers: ["apt"],
      },
      provider: "openai-compatible (gpt-4.1-mini)",
      model: "gpt-4.1-mini",
    });

    expect(status.facts.osFamily).toBe("linux");
    expect(status.provider).toBe("openai-compatible (gpt-4.1-mini)");
    expect(status.model).toBe("gpt-4.1-mini");
  });
});

describe("formatTuiSnapshot", () => {
  it("renders the TUI foundation shell as deterministic text", () => {
    const snapshot = formatTuiSnapshot(createTuiStatus({
      facts: {
        osFamily: "windows",
        arch: "x64",
        isElevated: false,
        packageManagers: ["winget"],
      },
      provider: "未配置",
    }));

    expect(snapshot).toContain("Forge");
    expect(snapshot).toContain("OS: windows x64");
    expect(snapshot).toContain("Elevated: false");
    expect(snapshot).toContain("Provider: 未配置");
    expect(snapshot).toContain("Package managers: winget");
    expect(snapshot).toContain("Ask Forge");
  });
});
