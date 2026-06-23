import { describe, expect, it } from "vitest";
import { createWindowsExecutor } from "../src/index";
import type { HostFacts } from "@opsforge/executor-base";

const facts: HostFacts = {
  osFamily: "windows",
  arch: "x64",
  isElevated: false,
  packageManagers: ["winget", "choco"],
};

describe("windows compile", () => {
  it("compiles winget package install", () => {
    const cmd = createWindowsExecutor().compile({ type: "package-install", name: "nginx" }, facts);
    expect(cmd).toEqual({
      shell: "powershell",
      argv: ["winget", "install", "--id", "nginx", "--silent"],
      needsElevation: true,
      describe: "Install package nginx with winget",
    });
  });

  it("compiles service start", () => {
    const cmd = createWindowsExecutor().compile({ type: "service-start", name: "nginx" }, facts);
    expect(cmd.argv).toEqual(["Start-Service", "-Name", "nginx"]);
    expect(cmd.shell).toBe("powershell");
  });

  it("compiles file writes with content passed through stdin", () => {
    const cmd = createWindowsExecutor().compile({ type: "file-write", path: "C:\\Temp\\opsforge.conf", content: "hello" }, facts);

    expect(cmd.shell).toBe("powershell");
    expect(String(cmd.argv)).toContain("Set-Content");
    expect(String(cmd.argv)).toContain("C:\\Temp\\opsforge.conf");
    expect(cmd.stdin).toBe("hello");
    expect(String(cmd.argv)).not.toContain("hello");
  });

  it("renders file templates before passing content through stdin", () => {
    const cmd = createWindowsExecutor().compile({
      type: "file-template",
      path: "C:\\Temp\\opsforge.conf",
      template: "hello {{name}}",
      vars: { name: "Forge" },
    }, facts);

    expect(cmd.stdin).toBe("hello Forge");
  });
});
