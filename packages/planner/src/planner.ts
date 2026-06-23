import { PlanSchema, type Plan } from "@opsforge/dsl";
import { OpsForgeError } from "@opsforge/shared";
import type { PlanProvider } from "./providers";

export class PlannerValidationError extends OpsForgeError {
  constructor(message: string) {
    super(message, "PLANNER_VALIDATION_FAILED");
    this.name = "PlannerValidationError";
  }
}

export interface BuildPlanInput {
  prompt: string;
  provider: PlanProvider;
  now?: () => string;
  planId?: () => string;
}

const withDefaults = (input: unknown, id: string, createdAt: string): unknown => {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return input;
  const candidate = input as Record<string, unknown>;
  return {
    prechecks: [],
    verifications: [],
    rollback: [],
    explanation: [],
    ...candidate,
    id: typeof candidate.id === "string" ? candidate.id : id,
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : createdAt,
  };
};

export const buildPlanFromPrompt = async (input: BuildPlanInput): Promise<Plan> => {
  const generated = await input.provider.buildPlan({ prompt: input.prompt });
  const candidate = withDefaults(
    generated,
    input.planId?.() ?? `plan_${Date.now().toString(36)}`,
    input.now?.() ?? new Date().toISOString(),
  );
  const parsed = PlanSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new PlannerValidationError(parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  return parsed.data;
};
