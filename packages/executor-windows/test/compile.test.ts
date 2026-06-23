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
});
