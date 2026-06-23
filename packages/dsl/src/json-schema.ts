import { zodToJsonSchema } from "zod-to-json-schema";
import { PlanSchema } from "./schema";

export type JsonSchemaObject = Record<string, unknown>;

const PLAN_SCHEMA_ID = "https://schemas.opsforge.local/plan.schema.json";

export const createPlanJsonSchema = (): JsonSchemaObject => {
  const schema = zodToJsonSchema(PlanSchema, {
    $refStrategy: "none",
  }) as JsonSchemaObject;

  return {
    ...schema,
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: PLAN_SCHEMA_ID,
    title: "OpsForge Plan",
  };
};

export const planJsonSchema = createPlanJsonSchema();
