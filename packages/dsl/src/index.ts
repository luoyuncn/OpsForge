import type { z } from "zod";
import {
  PlanSchema,
  StepSchema,
  PrecheckSchema,
  VerificationSchema,
  RiskLevelSchema,
  OsFamilySchema,
  IntentSchema,
  PackageSpecSchema,
} from "./schema";

export * from "./schema";
export * from "./json-schema";

export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type OsFamily = z.infer<typeof OsFamilySchema>;
export type Intent = z.infer<typeof IntentSchema>;
export type Step = z.infer<typeof StepSchema>;
export type Precheck = z.infer<typeof PrecheckSchema>;
export type Verification = z.infer<typeof VerificationSchema>;
export type PackageSpec = z.infer<typeof PackageSpecSchema>;
export type Plan = z.infer<typeof PlanSchema>;

export function parsePlan(input: unknown): Plan {
  return PlanSchema.parse(input);
}

export function safeParsePlan(input: unknown) {
  return PlanSchema.safeParse(input);
}
