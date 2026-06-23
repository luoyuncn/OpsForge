import { OpsForgeError } from "@opsforge/shared";
import type { PlanProvider } from "./providers";
import { buildPlannerPrompt } from "./skill-templates";

export class GoogleProviderError extends OpsForgeError {
  constructor(message: string) {
    super(message, "GOOGLE_PROVIDER_FAILED");
    this.name = "GoogleProviderError";
  }
}

export interface GoogleProviderOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}

interface GoogleGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

export const createGooglePlanProvider = (options: GoogleProviderOptions): PlanProvider => {
  const baseUrl = trimTrailingSlash(options.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta");
  const fetchImpl = options.fetch ?? fetch;

  return {
    name: "google",
    buildPlan: async ({ prompt }) => {
      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}/models/${options.model}:generateContent?key=${options.apiKey}`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            generationConfig: {
              temperature: 0,
            },
            systemInstruction: {
              parts: [
                {
                  text: "You are OpsForge planner. Return only a JSON object matching the OpsForge Plan DSL. Do not execute commands.",
                },
              ],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: buildPlannerPrompt(prompt) }],
              },
            ],
          }),
        });
      } catch (error) {
        throw new GoogleProviderError(`Google provider request failed: ${error instanceof Error ? error.message : String(error)}`);
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new GoogleProviderError(`Google provider returned HTTP ${response.status}${text ? `: ${text}` : ""}`);
      }

      const payload = (await response.json().catch((error) => {
        throw new GoogleProviderError(
          `Google provider returned invalid response JSON: ${error instanceof Error ? error.message : String(error)}`,
        );
      })) as GoogleGenerateContentResponse;
      const content = payload.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
      if (!content) {
        throw new GoogleProviderError("Google provider response did not include text content");
      }

      return content;
    },
  };
};
