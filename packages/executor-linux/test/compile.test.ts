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

  it("compiles file writes with content passed through stdin", () => {
    const cmd = createLinuxExecutor().compile({ type: "file-write", path: "/tmp/opsforge.conf", content: "hello", mode: "0600" }, facts);

    expect(cmd.argv).toEqual(["install", "-D", "-m", "0600", "/dev/stdin", "/tmp/opsforge.conf"]);
    expect(cmd.stdin).toBe("hello");
    expect(JSON.stringify(cmd.argv)).not.toContain("hello");
  });

  it("renders file templates before passing content through stdin", () => {
    const cmd = createLinuxExecutor().compile({
      type: "file-template",
      path: "/tmp/opsforge.conf",
      template: "hello {{name}}",
      vars: { name: "Forge" },
    }, facts);

    expect(cmd.argv).toEqual(["install", "-D", "-m", "0644", "/dev/stdin", "/tmp/opsforge.conf"]);
    expect(cmd.stdin).toBe("hello Forge");
  });
});
