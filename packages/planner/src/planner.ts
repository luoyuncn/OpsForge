import { PlanSchema, type Plan } from "@opsforge/dsl";
import { OpsForgeError } from "@opsforge/shared";
import { extractPlanCandidate } from "./plan-extract";
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
  maxRepairAttempts?: number;
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
  const id = input.planId?.() ?? `plan_${Date.now().toString(36)}`;
  const createdAt = input.now?.() ?? new Date().toISOString();
  const maxRepairAttempts = input.maxRepairAttempts ?? 1;
  let prompt = input.prompt;

  for (let attempt = 0; attempt <= maxRepairAttempts; attempt += 1) {
    const generated = await input.provider.buildPlan({ prompt });
    const extracted = extractPlanCandidate(generated);
    const candidate = withDefaults(extracted.candidate, id, createdAt);
    const parsed = PlanSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;

    const message = parsed.error.issues.map((issue) => issue.message).join("; ");
    if (attempt >= maxRepairAttempts) throw new PlannerValidationError(message);

    prompt = [
      "Repair the previous OpsForge Plan DSL output.",
      "Return only a JSON object matching the OpsForge Plan DSL. Do not execute commands.",
      `Original user request: ${input.prompt}`,
      `Validation errors: ${message}`,
      `Previous output: ${JSON.stringify(candidate)}`,
    ].join("\n");
  }

  throw new PlannerValidationError("planner repair loop ended without a valid plan");
};
