import type { PackageSpec, Plan, Step, Verification } from "@opsforge/dsl";

export interface SkillTemplate {
  id: string;
  title: string;
  intent: Plan["intent"];
  aliases: string[];
  packageSpec?: PackageSpec;
  steps: Step[];
  verifications: Verification[];
  rollback: Step[];
  risk: Plan["risk"];
  explanation: string[];
}

export const skillTemplates: SkillTemplate[] = [
  {
    id: "install-nginx",
    title: "Install nginx",
    intent: "install",
    aliases: ["install nginx", "setup nginx", "nginx"],
    packageSpec: { name: "nginx" },
    steps: [
      { type: "package-update-cache" },
      { type: "package-install", name: "nginx" },
      { type: "service-enable", name: "nginx" },
      { type: "service-start", name: "nginx" },
    ],
    verifications: [
      { type: "package-version", name: "nginx" },
      { type: "service-status", name: "nginx", expect: "active" },
      { type: "process-alive", name: "nginx" },
    ],
    rollback: [
      { type: "service-stop", name: "nginx" },
      { type: "package-remove", name: "nginx" },
    ],
    risk: "L1",
    explanation: ["Matched deterministic skill template install-nginx."],
  },
  {
    id: "install-docker",
    title: "Install Docker",
    intent: "install",
    aliases: ["install docker", "setup docker", "docker"],
    packageSpec: { name: "docker" },
    steps: [
      { type: "package-update-cache" },
      { type: "package-install", name: "docker" },
      { type: "service-enable", name: "docker" },
      { type: "service-start", name: "docker" },
    ],
    verifications: [
      { type: "package-version", name: "docker" },
      { type: "service-status", name: "docker", expect: "active" },
      { type: "process-alive", name: "docker" },
    ],
    rollback: [
      { type: "service-stop", name: "docker" },
      { type: "package-remove", name: "docker" },
    ],
    risk: "L1",
    explanation: ["Matched deterministic skill template install-docker."],
  },
  {
    id: "install-nodejs",
    title: "Install Node.js",
    intent: "install",
    aliases: ["install nodejs", "install node.js", "install node", "setup nodejs", "nodejs", "node.js"],
    packageSpec: { name: "nodejs" },
    steps: [
      { type: "package-update-cache" },
      { type: "package-install", name: "nodejs" },
    ],
    verifications: [
      { type: "package-version", name: "nodejs" },
      { type: "smoke-test", cmd: "node --version", expectExit: 0 },
    ],
    rollback: [{ type: "package-remove", name: "nodejs" }],
    risk: "L1",
    explanation: ["Matched deterministic skill template install-nodejs."],
  },
];

const normalizePrompt = (prompt: string): string => prompt.toLowerCase().replaceAll(/[^a-z0-9. _-]/g, " ").replaceAll(/\s+/g, " ").trim();

export const findSkillTemplateForPrompt = (prompt: string): SkillTemplate | undefined => {
  const normalized = normalizePrompt(prompt);
  return skillTemplates.find((template) => template.aliases.some((alias) => normalized.includes(alias)));
};

export const buildPlanFromSkillTemplate = (template: SkillTemplate): Omit<Plan, "id" | "createdAt"> => ({
  title: template.title,
  intent: template.intent,
  packageSpec: template.packageSpec,
  prechecks: [{ type: "os-detect" }, { type: "privilege-check", requireElevated: true }],
  steps: template.steps,
  verifications: template.verifications,
  rollback: template.rollback,
  risk: template.risk,
  explanation: template.explanation,
});

export const buildSkillTemplatePromptContext = (): string =>
  skillTemplates
    .map((template) => {
      const steps = template.steps.map((step) => step.type).join(", ");
      const checks = template.verifications.map((verification) => verification.type).join(", ");
      return `${template.id}: title="${template.title}", risk=${template.risk}, steps=[${steps}], verifications=[${checks}]`;
    })
    .join("\n");

export const buildPlannerPrompt = (prompt: string): string =>
  [
    "User request:",
    prompt,
    "",
    "Deterministic OpsForge skill templates available as preferred DSL skeletons when the request matches:",
    buildSkillTemplatePromptContext(),
    "",
    "Return one JSON object matching the OpsForge Plan DSL. Do not execute commands.",
  ].join("\n");
