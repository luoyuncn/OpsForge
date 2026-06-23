import { OpsForgeError } from "@opsforge/shared";
import type { PlanProvider } from "./providers";
import { buildPlannerPrompt } from "./skill-templates";

export class AnthropicProviderError extends OpsForgeError {
  constructor(message: string) {
    super(message, "ANTHROPIC_PROVIDER_FAILED");
    this.name = "AnthropicProviderError";
  }
}

export interface AnthropicProviderOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}

interface AnthropicMessagesResponse {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
}

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

export const createAnthropicPlanProvider = (options: AnthropicProviderOptions): PlanProvider => {
  const baseUrl = trimTrailingSlash(options.baseUrl ?? "https://api.anthropic.com");
  const fetchImpl = options.fetch ?? fetch;

  return {
    name: "anthropic",
    buildPlan: async ({ prompt }) => {
      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}/v1/messages`, {
          method: "POST",
          headers: {
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
            "x-api-key": options.apiKey,
          },
          body: JSON.stringify({
            model: options.model,
            max_tokens: 4096,
            temperature: 0,
            system: "You are OpsForge planner. Return only a JSON object matching the OpsForge Plan DSL. Do not execute commands.",
            messages: [
              {
                role: "user",
                content: buildPlannerPrompt(prompt),
              },
            ],
          }),
        });
      } catch (error) {
        throw new AnthropicProviderError(
          `Anthropic provider request failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new AnthropicProviderError(`Anthropic provider returned HTTP ${response.status}${text ? `: ${text}` : ""}`);
      }

      const payload = (await response.json().catch((error) => {
        throw new AnthropicProviderError(
          `Anthropic provider returned invalid response JSON: ${error instanceof Error ? error.message : String(error)}`,
        );
      })) as AnthropicMessagesResponse;
      const content = payload.content?.find((item) => item.type === "text" && item.text)?.text;
      if (!content) {
        throw new AnthropicProviderError("Anthropic provider response did not include text content");
      }

      return content;
    },
  };
};
