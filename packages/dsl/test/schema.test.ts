import { describe, it, expect } from "vitest";
import { parsePlan, safeParsePlan } from "../src/index";

const validPlan = {
  id: "plan_1",
  title: "Install nginx",
  intent: "install",
  steps: [{ type: "package-install", name: "nginx" }],
  risk: "L1",
  createdAt: "2026-06-23T00:00:00Z",
};

describe("PlanSchema", () => {
  it("parses a valid plan and applies array defaults", () => {
    const p = parsePlan(validPlan);
    expect(p.prechecks).toEqual([]);
    expect(p.verifications).toEqual([]);
    expect(p.rollback).toEqual([]);
    expect(p.explanation).toEqual([]);
    expect(p.steps[0]).toEqual({ type: "package-install", name: "nginx" });
  });

  it("rejects an unknown step type", () => {
    const bad = { ...validPlan, steps: [{ type: "format-disk" }] };
    expect(safeParsePlan(bad).success).toBe(false);
  });

  it("rejects an invalid risk level", () => {
    const bad = { ...validPlan, risk: "L9" };
    expect(safeParsePlan(bad).success).toBe(false);
  });
});
