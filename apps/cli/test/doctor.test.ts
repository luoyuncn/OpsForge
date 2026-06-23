import { describe, it, expect } from "vitest";
import { buildDoctorReport, buildDoctorReportAsync, formatDoctorReport } from "../src/commands/doctor";

describe("buildDoctorReport", () => {
  it("reports detected host facts and the env-resolved provider", () => {
    const r = buildDoctorReport({
      platform: "linux",
      arch: "x64",
      which: (c) => c === "apt" || c === "dnf",
      getUid: () => 0,
      linuxRelease: 'ID=ubuntu\nVERSION_ID="24.04"\n',
      env: { ANTHROPIC_API_KEY: "x", OPSFORGE_MODEL: "claude-opus-4-8" },
    });
    expect(r.facts).toEqual({
      osFamily: "linux",
      arch: "x64",
      distro: "ubuntu",
      version: "24.04",
      isElevated: true,
      packageManagers: ["apt", "dnf"],
    });
    expect(r.provider).toContain("anthropic");
    expect(r.provider).toContain("claude-opus-4-8");
    expect(r.providerCapabilities).toContain("native structured prompting");
    expect(r.riskMax).toBe("L3");
    expect(r.warnings).toEqual([]);
  });

  it("shows warnings when provider, package manager, and elevation are missing", () => {
    const r = buildDoctorReport({ platform: "win32", which: () => false, env: {} });
    expect(r.facts.osFamily).toBe("windows");
    expect(r.provider).toBe("未配置");
    expect(r.warnings).toEqual([
      "provider is not configured",
      "no supported package manager detected",
      "current process is not elevated",
    ]);
  });
});

describe("buildDoctorReportAsync", () => {
  it("uses the windows elevation probe when building doctor facts", async () => {
    const r = await buildDoctorReportAsync({
      platform: "win32",
      arch: "x64",
      which: (cmd) => cmd === "winget",
      env: { OPENAI_API_KEY: "x" },
      runCommand: async (cmd) => {
        expect(cmd).toBe("net session");
        return { stdout: "", stderr: "", exitCode: 0 };
      },
    });

    expect(r.facts).toEqual({
      osFamily: "windows",
      arch: "x64",
      isElevated: true,
      packageManagers: ["winget"],
    });
    expect(r.warnings).toEqual([]);
  });
});

describe("formatDoctorReport", () => {
  it("renders a human-readable block", () => {
    const text = formatDoctorReport({
      facts: {
        osFamily: "linux",
        arch: "x64",
        distro: "ubuntu",
        version: "24.04",
        isElevated: true,
        packageManagers: ["apt"],
      },
      provider: "未配置",
      riskMax: "L3",
      allowShell: false,
      providerCapabilities: ["none"],
      warnings: ["provider is not configured"],
    });
    expect(text).toContain("OpsForge doctor");
    expect(text).toContain("OS:               linux");
    expect(text).toContain("Distro:           ubuntu 24.04");
    expect(text).toContain("Elevated:         true");
    expect(text).toContain("Warnings:");
    expect(text).toContain("Provider capabilities:");
    expect(text).toContain("provider is not configured");
  });
});
