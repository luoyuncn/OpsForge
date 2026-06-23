import type { PlanProvider } from "./providers";

const packageNameFromPrompt = (prompt: string): string => {
  const normalized = prompt.toLowerCase();
  const match = normalized.match(/\binstall\s+([a-z0-9._-]+)/);
  return match?.[1] ?? "nginx";
};

const titleForPackage = (name: string): string => `Install ${name}`;

export const createMockPlanProvider = (): PlanProvider => ({
  name: "mock",
  buildPlan: async ({ prompt }) => {
    const name = packageNameFromPrompt(prompt);
    return {
      title: titleForPackage(name),
      intent: "install",
      steps: [{ type: "package-install", name }],
      verifications: [{ type: "smoke-test", cmd: `${name} --version`, expectExit: 0 }],
      rollback: [{ type: "package-remove", name }],
      risk: "L1",
      explanation: [`Mock provider generated an install plan for ${name}.`],
    };
  },
});
