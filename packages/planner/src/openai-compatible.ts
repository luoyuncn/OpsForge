import { OpsForgeError } from "@opsforge/shared";
import type { PlanProvider } from "./providers";

export class OpenAICompatibleProviderError extends OpsForgeError {
  constructor(message: string) {
    super(message, "OPENAI_COMPATIBLE_PROVIDER_FAILED");
    this.name = "OpenAICompatibleProviderError";
  }
}

export interface OpenAICompatibleProviderOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const parseJsonObject = (content: string): unknown => {
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new OpenAICompatibleProviderError(
      `OpenAI-compatible provider returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

export const createOpenAICompatiblePlanProvider = (options: OpenAICompatibleProviderOptions): PlanProvider => {
  const baseUrl = trimTrailingSlash(options.baseUrl ?? "https://api.openai.com/v1");
  const fetchImpl = options.fetch ?? fetch;

  return {
    name: "openai-compatible",
    buildPlan: async ({ prompt }) => {
      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${options.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: options.model,
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  "You are OpsForge planner. Return only a JSON object matching the OpsForge Plan DSL. Do not execute commands.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
          }),
        });
      } catch (error) {
        throw new OpenAICompatibleProviderError(
          `OpenAI-compatible provider request failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new OpenAICompatibleProviderError(
          `OpenAI-compatible provider returned HTTP ${response.status}${text ? `: ${text}` : ""}`,
        );
      }

      const payload = (await response.json().catch((error) => {
        throw new OpenAICompatibleProviderError(
          `OpenAI-compatible provider returned invalid response JSON: ${error instanceof Error ? error.message : String(error)}`,
        );
      })) as ChatCompletionResponse;
      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        throw new OpenAICompatibleProviderError("OpenAI-compatible provider response did not include message content");
      }

      return parseJsonObject(content);
    },
  };
};
