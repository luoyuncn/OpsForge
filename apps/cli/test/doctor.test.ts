import { describe, it, expect } from "vitest";
import { buildDoctorReport, formatDoctorReport } from "../src/commands/doctor";

describe("buildDoctorReport", () => {
  it("reports detected OS, package managers, and the env-resolved provider", () => {
    const r = buildDoctorReport({
      platform: "linux",
      which: (c) => c === "apt" || c === "dnf",
      env: { ANTHROPIC_API_KEY: "x", OPSFORGE_MODEL: "claude-opus-4-8" },
    });
    expect(r.os).toBe("linux");
    expect(r.packageManagers).toEqual(["apt", "dnf"]);
    expect(r.provider).toContain("anthropic");
    expect(r.provider).toContain("claude-opus-4-8");
    expect(r.riskMax).toBe("L3");
  });

  it("shows '未配置' when no provider key is present", () => {
    const r = buildDoctorReport({ platform: "win32", which: () => false, env: {} });
    expect(r.os).toBe("windows");
    expect(r.provider).toBe("未配置");
  });
});

describe("formatDoctorReport", () => {
  it("renders a human-readable block", () => {
    const text = formatDoctorReport({
      os: "windows",
      arch: "x64",
      packageManagers: ["winget"],
      provider: "未配置",
      riskMax: "L3",
      allowShell: false,
    });
    expect(text).toContain("OpsForge doctor");
    expect(text).toContain("winget");
  });
});
