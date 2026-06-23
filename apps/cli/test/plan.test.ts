import { describe, expect, it } from "vitest";
import { buildPlanCommand, formatPlanResult } from "../src/commands/plan";

describe("formatPlanResult", () => {
  it("prints a compact human summary", () => {
    const output = formatPlanResult({
      id: "plan_1",
      title: "Install nginx",
      intent: "install",
      risk: "L1",
      steps: [{ type: "package-install", name: "nginx" }],
      verifications: [{ type: "smoke-test", cmd: "nginx --version", expectExit: 0 }],
      rollback: [{ type: "package-remove", name: "nginx" }],
      explanation: ["Mock provider generated an install plan for nginx."],
      createdAt: "2026-06-23T00:00:00Z",
      prechecks: [],
    });

    expect(output).toContain("OpsForge plan");
    expect(output).toContain("Plan ID:            plan_1");
    expect(output).toContain("Steps:              1");
    expect(output).toContain("1. package-install nginx");
  });
});

describe("buildPlanCommand", () => {
  it("writes JSON plan output through the injected writer", async () => {
    const writes: string[] = [];
    const command = buildPlanCommand({
      write: (text) => writes.push(text),
      now: () => "2026-06-23T00:00:00Z",
      planId: () => "plan_cli_1",
    });

    await command.parseAsync(["node", "test", "install nginx", "--json"], { from: "user" });

    const parsed = JSON.parse(writes[0]);
    expect(parsed.id).toBe("plan_cli_1");
    expect(parsed.steps[0]).toEqual({ type: "package-install", name: "nginx" });
  });

  it("writes a schema-valid JSON plan to --out without changing stdout mode", async () => {
    const writes: string[] = [];
    const files: Record<string, string> = {};
    const command = buildPlanCommand({
      write: (text) => writes.push(text),
      writeFile: async (path, text) => {
        files[path] = text;
      },
      now: () => "2026-06-23T00:00:00Z",
      planId: () => "plan_cli_out",
    });

    await command.parseAsync(["node", "test", "install nginx", "--out", "plans/nginx.json"], { from: "user" });

    expect(writes[0]).toContain("OpsForge plan");
    expect(writes[0]).toContain("Saved:              plans/nginx.json");
    const parsed = JSON.parse(files["plans/nginx.json"]);
    expect(parsed.id).toBe("plan_cli_out");
    expect(parsed.steps[0]).toEqual({ type: "package-install", name: "nginx" });
  });
});
