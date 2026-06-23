import { describe, expect, it } from "vitest";
import {
  AnthropicProviderError,
  buildPlanFromPrompt,
  createAnthropicPlanProvider,
  createGooglePlanProvider,
  createMockPlanProvider,
  createOpenAICompatiblePlanProvider,
  findSkillTemplateForPrompt,
  GoogleProviderError,
  OpenAICompatibleProviderError,
  PlannerValidationError,
} from "../src/index";

describe("skill templates", () => {
  it("matches deterministic install templates from prompts", () => {
    expect(findSkillTemplateForPrompt("install docker")).toMatchObject({ id: "install-docker" });
    expect(findSkillTemplateForPrompt("please install nodejs locally")).toMatchObject({ id: "install-nodejs" });
    expect(findSkillTemplateForPrompt("install nginx")).toMatchObject({ id: "install-nginx" });
    expect(findSkillTemplateForPrompt("install htop")).toBeUndefined();
  });

  it("uses a matching deterministic template in the mock provider", async () => {
    const plan = await buildPlanFromPrompt({
      prompt: "install docker",
      provider: createMockPlanProvider(),
      now: () => "2026-06-23T00:00:00Z",
      planId: () => "plan_skill_1",
    });

    expect(plan.title).toBe("Install Docker");
    expect(plan.packageSpec).toEqual({ name: "docker" });
    expect(plan.steps).toEqual([
      { type: "package-update-cache" },
      { type: "package-install", name: "docker" },
      { type: "service-enable", name: "docker" },
      { type: "service-start", name: "docker" },
    ]);
    expect(plan.verifications).toEqual([
      { type: "package-version", name: "docker" },
      { type: "service-status", name: "docker", expect: "active" },
      { type: "process-alive", name: "docker" },
    ]);
    expect(plan.rollback).toEqual([
      { type: "service-stop", name: "docker" },
      { type: "package-remove", name: "docker" },
    ]);
    expect(plan.explanation.join("\n")).toContain("install-docker");
  });

  it("falls back to a generic package install when no skill template matches", async () => {
    const plan = await buildPlanFromPrompt({
      prompt: "install htop",
      provider: createMockPlanProvider(),
      now: () => "2026-06-23T00:00:00Z",
      planId: () => "plan_generic_1",
    });

    expect(plan.title).toBe("Install htop");
    expect(plan.steps).toEqual([{ type: "package-install", name: "htop" }]);
    expect(plan.rollback).toEqual([{ type: "package-remove", name: "htop" }]);
  });
});

describe("buildPlanFromPrompt", () => {
  it("returns a schema-valid generic install plan from the mock provider", async () => {
    const plan = await buildPlanFromPrompt({
      prompt: "install redis",
      provider: createMockPlanProvider(),
      now: () => "2026-06-23T00:00:00Z",
      planId: () => "plan_mock_1",
    });

    expect(plan).toMatchObject({
      id: "plan_mock_1",
      title: "Install redis",
      intent: "install",
      risk: "L1",
      createdAt: "2026-06-23T00:00:00Z",
    });
    expect(plan.steps.map((step) => step.type)).toEqual(["package-install"]);
    expect(plan.verifications[0]).toEqual({ type: "smoke-test", cmd: "redis --version", expectExit: 0 });
    expect(plan.rollback[0]).toEqual({ type: "package-remove", name: "redis" });
  });

  it("rejects provider output that does not match the DSL schema", async () => {
    await expect(
      buildPlanFromPrompt({
        prompt: "bad plan",
        provider: {
          name: "bad",
          buildPlan: async () => ({ id: "bad", title: "Bad", intent: "install", steps: [{ type: "unknown" }] }),
        },
        now: () => "2026-06-23T00:00:00Z",
        planId: () => "plan_bad",
      }),
    ).rejects.toBeInstanceOf(PlannerValidationError);
  });
});

describe("createOpenAICompatiblePlanProvider", () => {
  it("requests a JSON plan from an OpenAI-compatible chat completions endpoint", async () => {
    const requests: Array<{ url: string; init: RequestInit & { headers: Record<string, string> } }> = [];
    const provider = createOpenAICompatiblePlanProvider({
      apiKey: "test-key",
      model: "gpt-4.1-mini",
      baseUrl: "https://llm.example.com/v1",
      fetch: async (url, init) => {
        requests.push({ url: String(url), init: init as RequestInit & { headers: Record<string, string> } });
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: "Install nginx",
                    intent: "install",
                    steps: [{ type: "package-install", name: "nginx" }],
                    risk: "L1",
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });

    const plan = await buildPlanFromPrompt({
      prompt: "install nginx",
      provider,
      planId: () => "plan_ai_1",
      now: () => "2026-06-23T00:00:00Z",
    });

    expect(plan.id).toBe("plan_ai_1");
    expect(plan.steps[0]).toEqual({ type: "package-install", name: "nginx" });
    expect(requests[0].url).toBe("https://llm.example.com/v1/chat/completions");
    expect(requests[0].init.method).toBe("POST");
    expect(requests[0].init.headers.authorization).toBe("Bearer test-key");
    const body = JSON.parse(String(requests[0].init.body));
    expect(body.model).toBe("gpt-4.1-mini");
    expect(body.temperature).toBe(0);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages.at(-1).content).toContain("install nginx");
    expect(body.messages.at(-1).content).toContain("install-nginx");
    expect(body.messages.at(-1).content).toContain("install-docker");
    expect(body.messages.at(-1).content).toContain("install-nodejs");
  });

  it("throws a typed error for non-2xx responses", async () => {
    const provider = createOpenAICompatiblePlanProvider({
      apiKey: "test-key",
      model: "gpt-4.1-mini",
      baseUrl: "https://llm.example.com/v1/",
      fetch: async () => new Response("bad gateway", { status: 502 }),
    });

    await expect(provider.buildPlan({ prompt: "install nginx" })).rejects.toBeInstanceOf(OpenAICompatibleProviderError);
  });
});

describe("createAnthropicPlanProvider", () => {
  it("requests a JSON plan from Anthropic messages", async () => {
    const requests: Array<{ url: string; init: RequestInit & { headers: Record<string, string> } }> = [];
    const provider = createAnthropicPlanProvider({
      apiKey: "test-key",
      model: "claude-3-5-sonnet-latest",
      fetch: async (url, init) => {
        requests.push({ url: String(url), init: init as RequestInit & { headers: Record<string, string> } });
        return new Response(JSON.stringify({
          content: [{ type: "text", text: JSON.stringify({ title: "Install nginx", intent: "install", steps: [{ type: "package-install", name: "nginx" }], risk: "L1" }) }],
        }), { status: 200, headers: { "content-type": "application/json" } });
      },
    });

    const plan = await buildPlanFromPrompt({
      prompt: "install nginx",
      provider,
      planId: () => "plan_anthropic_1",
      now: () => "2026-06-23T00:00:00Z",
    });

    expect(plan.id).toBe("plan_anthropic_1");
    expect(requests[0].url).toBe("https://api.anthropic.com/v1/messages");
    expect(requests[0].init.headers["x-api-key"]).toBe("test-key");
    const body = JSON.parse(String(requests[0].init.body));
    expect(body.model).toBe("claude-3-5-sonnet-latest");
    expect(body.messages[0].content).toContain("install nginx");
    expect(body.messages[0].content).toContain("install-nginx");
    expect(body.messages[0].content).toContain("install-docker");
    expect(body.messages[0].content).toContain("install-nodejs");
  });

  it("throws a typed error for Anthropic failures", async () => {
    const provider = createAnthropicPlanProvider({
      apiKey: "test-key",
      model: "claude-3-5-sonnet-latest",
      fetch: async () => new Response("bad", { status: 500 }),
    });

    await expect(provider.buildPlan({ prompt: "install nginx" })).rejects.toBeInstanceOf(AnthropicProviderError);
  });
});

describe("createGooglePlanProvider", () => {
  it("requests a JSON plan from Google generateContent", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const provider = createGooglePlanProvider({
      apiKey: "test-key",
      model: "gemini-1.5-flash",
      fetch: async (url, init) => {
        requests.push({ url: String(url), init: init as RequestInit });
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ title: "Install nginx", intent: "install", steps: [{ type: "package-install", name: "nginx" }], risk: "L1" }) }] } }],
        }), { status: 200, headers: { "content-type": "application/json" } });
      },
    });

    const plan = await buildPlanFromPrompt({
      prompt: "install nginx",
      provider,
      planId: () => "plan_google_1",
      now: () => "2026-06-23T00:00:00Z",
    });

    expect(plan.id).toBe("plan_google_1");
    expect(requests[0].url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=test-key");
    const body = JSON.parse(String(requests[0].init.body));
    expect(body.contents[0].parts[0].text).toContain("install nginx");
    expect(body.contents[0].parts[0].text).toContain("install-nginx");
    expect(body.contents[0].parts[0].text).toContain("install-docker");
    expect(body.contents[0].parts[0].text).toContain("install-nodejs");
  });

  it("throws a typed error for Google failures", async () => {
    const provider = createGooglePlanProvider({
      apiKey: "test-key",
      model: "gemini-1.5-flash",
      fetch: async () => new Response("bad", { status: 429 }),
    });

    await expect(provider.buildPlan({ prompt: "install nginx" })).rejects.toBeInstanceOf(GoogleProviderError);
  });
});
