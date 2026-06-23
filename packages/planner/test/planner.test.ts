import { describe, expect, it } from "vitest";
import { buildPlanFromPrompt, createMockPlanProvider, PlannerValidationError } from "../src/index";

describe("buildPlanFromPrompt", () => {
  it("returns a schema-valid install plan from the mock provider", async () => {
    const plan = await buildPlanFromPrompt({
      prompt: "install nginx",
      provider: createMockPlanProvider(),
      now: () => "2026-06-23T00:00:00Z",
      planId: () => "plan_mock_1",
    });

    expect(plan).toMatchObject({
      id: "plan_mock_1",
      title: "Install nginx",
      intent: "install",
      risk: "L1",
      createdAt: "2026-06-23T00:00:00Z",
    });
    expect(plan.steps.map((step) => step.type)).toEqual(["package-install"]);
    expect(plan.verifications[0]).toEqual({ type: "smoke-test", cmd: "nginx --version", expectExit: 0 });
    expect(plan.rollback[0]).toEqual({ type: "package-remove", name: "nginx" });
  });

  it("rejects provider output that does not match the DSL schema", async () => {
    await expect(
      buildPlanFromPrompt({
        prompt: "bad plan",
        provider: {
          name: "bad",
          buildPlan: async () => ({ id: "bad", title: "Bad", intent: "install", steps: [{ type: "unknown" }] }),
        },
        now: () => "2026-06-23T00:00:00Z",
        planId: () => "plan_bad",
      }),
    ).rejects.toBeInstanceOf(PlannerValidationError);
  });
});
