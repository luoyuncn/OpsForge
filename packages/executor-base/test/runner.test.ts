import { describe, expect, it } from "vitest";
import { runCompiledCommand } from "../src/index";

describe("runCompiledCommand", () => {
  it("wraps runner output in a StepResult", async () => {
    const result = await runCompiledCommand(
      { type: "service-status", name: "nginx" },
      { shell: "bash", argv: ["systemctl", "status", "nginx"], needsElevation: false, describe: "Check nginx" },
      async () => ({ stdout: "active", stderr: "", exitCode: 0 }),
      { maxOutputBytes: 100 },
    );

    expect(result.stdout).toBe("active");
    expect(result.exitCode).toBe(0);
    expect(result.truncated).toBe(false);
    expect(result.startedAt).toBeTruthy();
    expect(result.endedAt).toBeTruthy();
  });

  it("truncates stdout and stderr together", async () => {
    const result = await runCompiledCommand(
      { type: "shell", cmd: "echo long" },
      { shell: "bash", argv: "echo long", needsElevation: false, describe: "Echo long" },
      async () => ({ stdout: "abcdef", stderr: "ghijkl", exitCode: 0 }),
      { maxOutputBytes: 5 },
    );

    expect(result.truncated).toBe(true);
    expect(Buffer.byteLength(result.stdout + result.stderr, "utf8")).toBeLessThanOrEqual(5);
  });
});
