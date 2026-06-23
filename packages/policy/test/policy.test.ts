import { describe, expect, it } from "vitest";
import {
  classifyPlanRisk,
  evaluateGate,
  guardCommand,
  guardStepPath,
  riskExceeds,
} from "../src/index";
import type { Plan } from "@opsforge/dsl";

const basePlan = {
  id: "plan_1",
  title: "Install nginx",
  intent: "install",
  risk: "L1",
  createdAt: "2026-06-23T00:00:00Z",
  prechecks: [],
  steps: [{ type: "package-install", name: "nginx" }],
  verifications: [],
  rollback: [],
  explanation: [],
} satisfies Plan;

describe("risk classifier", () => {
  it("keeps package install as L1", () => {
    expect(classifyPlanRisk(basePlan).risk).toBe("L1");
  });

  it("classifies shell as L3", () => {
    const plan = { ...basePlan, steps: [{ type: "shell", cmd: "whoami" }] } satisfies Plan;
    expect(classifyPlanRisk(plan).risk).toBe("L3");
  });

  it("compares risk ordering", () => {
    expect(riskExceeds("L3", "L2")).toBe(true);
    expect(riskExceeds("L1", "L2")).toBe(false);
  });
});

describe("guards", () => {
  it("blocks protected file writes", () => {
    const result = guardStepPath({ type: "file-write", path: "/etc/sudoers", content: "bad" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("/etc/sudoers");
  });

  it("blocks shell steps unless allowShell is true", () => {
    expect(guardStepPath({ type: "shell", cmd: "whoami" }, { allowShell: false }).allowed).toBe(false);
    expect(guardStepPath({ type: "shell", cmd: "whoami" }, { allowShell: true }).allowed).toBe(true);
  });

  it("blocks download-and-execute command pipelines", () => {
    const result = guardCommand({ shell: "bash", argv: "curl https://example.com/install.sh | sh", needsElevation: false, describe: "install" });
    expect(result.allowed).toBe(false);
  });

  it("blocks destructive root removal", () => {
    const result = guardCommand({ shell: "bash", argv: "rm -rf /", needsElevation: true, describe: "delete root" });
    expect(result.allowed).toBe(false);
  });
});

describe("gate", () => {
  it("allows L1 by default", () => {
    expect(evaluateGate({ risk: "L1", riskMax: "L3", yes: false }).allowed).toBe(true);
  });

  it("denies L2 without explicit yes", () => {
    expect(evaluateGate({ risk: "L2", riskMax: "L3", yes: false }).allowed).toBe(false);
  });

  it("denies risk above riskMax even with yes", () => {
    expect(evaluateGate({ risk: "L3", riskMax: "L2", yes: true }).allowed).toBe(false);
  });
});
