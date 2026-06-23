import { z } from "zod";

export const RiskLevelSchema = z.enum(["L0", "L1", "L2", "L3"]);
export const OsFamilySchema = z.enum(["linux", "windows"]);
export const IntentSchema = z.enum([
  "install",
  "upgrade",
  "configure",
  "diagnose",
  "verify",
  "rollback",
]);

export const StepSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("package-update-cache") }),
  z.object({
    type: z.literal("package-install"),
    name: z.string(),
    version: z.string().optional(),
    source: z.string().optional(),
  }),
  z.object({ type: z.literal("package-remove"), name: z.string() }),
  z.object({ type: z.literal("service-enable"), name: z.string() }),
  z.object({ type: z.literal("service-start"), name: z.string() }),
  z.object({ type: z.literal("service-stop"), name: z.string() }),
  z.object({ type: z.literal("service-status"), name: z.string() }),
  z.object({ type: z.literal("file-write"), path: z.string(), content: z.string(), mode: z.string().optional() }),
  z.object({ type: z.literal("file-template"), path: z.string(), template: z.string(), vars: z.record(z.string()) }),
  z.object({ type: z.literal("shell"), cmd: z.string(), shell: z.enum(["bash", "powershell"]).optional() }),
]);

export const PrecheckSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("os-detect") }),
  z.object({ type: z.literal("privilege-check"), requireElevated: z.boolean().optional() }),
  z.object({ type: z.literal("disk-check"), minFreeMB: z.number() }),
  z.object({ type: z.literal("command-exists"), name: z.string() }),
]);

export const VerificationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("package-version"), name: z.string(), expect: z.string().optional() }),
  z.object({ type: z.literal("service-status"), name: z.string(), expect: z.enum(["active", "running", "stopped"]) }),
  z.object({ type: z.literal("port-open"), port: z.number() }),
  z.object({ type: z.literal("process-alive"), name: z.string() }),
  z.object({ type: z.literal("file-checksum"), path: z.string(), sha256: z.string() }),
  z.object({ type: z.literal("smoke-test"), cmd: z.string(), expectExit: z.number().optional() }),
]);

export const PackageSpecSchema = z.object({
  name: z.string(),
  source: z.string().optional(),
  version: z.string().optional(),
});

export const PlanSchema = z.object({
  id: z.string(),
  title: z.string(),
  intent: IntentSchema,
  osFamily: OsFamilySchema.optional(),
  packageSpec: PackageSpecSchema.optional(),
  prechecks: z.array(PrecheckSchema).default([]),
  steps: z.array(StepSchema),
  verifications: z.array(VerificationSchema).default([]),
  rollback: z.array(StepSchema).default([]),
  risk: RiskLevelSchema,
  explanation: z.array(z.string()).default([]),
  createdAt: z.string(),
});
