export type PlannerProviderKind = "openai-compatible" | "anthropic" | "google" | "pi";

export interface ProviderCapabilityInput {
  kind?: PlannerProviderKind;
}

export const describeProviderCapabilities = (provider?: ProviderCapabilityInput): string[] => {
  if (!provider?.kind) return ["none"];

  if (provider.kind === "anthropic") {
    return ["native structured prompting", "messages API JSON plan extraction", "DSL validation required"];
  }

  if (provider.kind === "google") {
    return ["native structured prompting", "generateContent JSON plan extraction", "DSL validation required"];
  }

  if (provider.kind === "openai-compatible") {
    return ["JSON-mode prompting when supported", "base URL override", "DSL validation required"];
  }

  return ["Pi native session planned", "raw shell disabled by OpsForge runtime boundary", "real SDK adapter pending"];
};
