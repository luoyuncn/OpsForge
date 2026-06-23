import { describe, expect, it } from "vitest";
import { createLinuxExecutor } from "../src/index";
import type { HostFacts } from "@opsforge/executor-base";

const facts: HostFacts = {
  osFamily: "linux",
  arch: "x64",
  isElevated: false,
  packageManagers: ["apt", "dnf"],
};

describe("linux compile", () => {
  it("compiles apt package install", () => {
    const cmd = createLinuxExecutor().compile({ type: "package-install", name: "nginx" }, facts);
    expect(cmd).toEqual({
      shell: "bash",
      argv: ["apt-get", "install", "-y", "nginx"],
      needsElevation: true,
      describe: "Install package nginx with apt",
    });
  });

  it("compiles systemd service start", () => {
    const cmd = createLinuxExecutor().compile({ type: "service-start", name: "nginx" }, facts);
    expect(cmd.argv).toEqual(["systemctl", "start", "nginx"]);
    expect(cmd.needsElevation).toBe(true);
  });
});
