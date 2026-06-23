import { describe, expect, it } from "vitest";
import { buildApplyCommand, formatApplyResult } from "../src/commands/apply";
import type { HostFacts } from "@opsforge/executor-base";

const facts: HostFacts = {
  osFamily: "linux",
  arch: "x64",
  isElevated: false,
  packageManagers: ["apt"],
};

const installPlan = {
  id: "plan_1",
  title: "Install nginx",
  intent: "install",
  steps: [{ type: "package-install", name: "nginx" }],
  risk: "L1",
  createdAt: "2026-06-23T00:00:00Z",
};

describe("buildApplyCommand", () => {
  it("dry-runs a JSON plan and does not execute the runner", async () => {
    let runnerCalls = 0;
    const apply = buildApplyCommand({
      readFile: async () => JSON.stringify(installPlan),
      platform: "linux",
      facts,
      runner: async () => {
        runnerCalls += 1;
        return { stdout: "", stderr: "", exitCode: 0 };
      },
    });

    const result = await apply("plan.json", { dryRun: true, yes: false, json: false, riskMax: "L3", allowShell: false });
    expect(runnerCalls).toBe(0);
    expect(result.commands[0].argv).toEqual(["apt-get", "install", "-y", "nginx"]);
    expect(formatApplyResult(result)).toContain("Dry run: true");
  });

  it("denies risky file writes without yes", async () => {
    const apply = buildApplyCommand({
      readFile: async () =>
        JSON.stringify({
          ...installPlan,
          steps: [{ type: "file-write", path: "/tmp/a", content: "x" }],
          risk: "L2",
        }),
      platform: "linux",
      facts,
      runner: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    });

    const result = await apply("plan.json", { dryRun: false, yes: false, json: false, riskMax: "L3", allowShell: false });
    expect(result.gate.allowed).toBe(false);
    expect(result.stepResults).toEqual([]);
  });
});
