import { describe, expect, it } from "vitest";
import { createPlanJsonSchema, planJsonSchema } from "../src";

describe("Plan JSON Schema export", () => {
  it("exports a stable JSON Schema for provider/tooling consumers", () => {
    expect(planJsonSchema).toMatchObject({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://schemas.opsforge.local/plan.schema.json",
      title: "OpsForge Plan",
      type: "object",
    });
    expect(JSON.stringify(planJsonSchema)).toContain("package-install");
    expect(JSON.stringify(planJsonSchema)).toContain("smoke-test");
  });

  it("returns a fresh schema object so callers cannot mutate the exported singleton", () => {
    const first = createPlanJsonSchema();
    const second = createPlanJsonSchema();

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});
