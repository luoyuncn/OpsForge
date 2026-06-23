# Provider Config And OpenAI-Compatible Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent provider configuration and an OpenAI-compatible planner adapter so `opsforge plan/run` can use a configured real LLM endpoint instead of only the deterministic mock provider.

**Architecture:** Keep `@opsforge/config` responsible for reading, merging, and writing local JSON config. Keep `@opsforge/planner` provider-agnostic by adding a `createOpenAICompatiblePlanProvider()` factory behind the existing `PlanProvider` interface. Keep `@opsforge/cli` thin: `config provider` writes provider settings, while `plan/run --provider configured` resolves config into a provider.

**Tech Stack:** TypeScript, commander, zod, Node built-in `fetch`, vitest, existing pnpm/Turbo workspace.

---

## File Structure

- Modify `packages/config/src/schema.ts`
  - Add optional `apiKeyEnv` and default OpenAI-compatible base URL/model semantics.
- Modify `packages/config/src/load.ts`
  - Add config-file read/write helpers and preserve env override behavior.
- Modify `packages/config/src/index.ts`
  - Export the new config file helpers.
- Modify `packages/config/test/config.test.ts`
  - Cover config file write serialization, provider env-key indirection, and OpenAI defaults.
- Create `packages/planner/src/openai-compatible.ts`
  - Implement an HTTP `PlanProvider` using OpenAI-compatible chat completions.
- Modify `packages/planner/src/index.ts`
  - Export the OpenAI-compatible provider factory.
- Modify `packages/planner/test/planner.test.ts`
  - Cover request construction, JSON extraction, schema validation handoff, and HTTP/error handling.
- Create `apps/cli/src/provider.ts`
  - Resolve `mock`, `configured`, and `openai-compatible` provider choices for `plan` and `run`.
- Create `apps/cli/src/commands/config.ts`
  - Add `opsforge config provider ...` and `opsforge config show`.
- Modify `apps/cli/src/commands/plan.ts`
  - Add `--provider`, `--model`, and `--base-url`; default remains mock for current safe tests.
- Modify `apps/cli/src/commands/run.ts`
  - Add the same provider flags and pass resolved provider into plan generation.
- Modify `apps/cli/src/commands/doctor.ts`
  - Read local config file and display provider model/base URL when configured.
- Modify `apps/cli/src/index.ts`
  - Register `config` command.
- Add or modify CLI tests under `apps/cli/test/`
  - Cover config command behavior and provider resolution path.
- Modify `README.md` and `docs/implementation-status.md`
  - Record Plan 7 delivery and design alignment.

---

### Task 1: Persistent Config Helpers

**Files:**
- Modify: `packages/config/src/schema.ts`
- Modify: `packages/config/src/load.ts`
- Modify: `packages/config/src/index.ts`
- Test: `packages/config/test/config.test.ts`

- [ ] **Step 1: Write failing config tests**

Add tests that expect:

```ts
const configPath = join(tmpdir(), "opsforge-config-test.json");
await writeConfigFile(configPath, {
  provider: {
    kind: "openai-compatible",
    model: "gpt-4.1-mini",
    baseUrl: "https://llm.example.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
  },
});
const loaded = await loadConfigFile(configPath, { env: { OPENAI_API_KEY: "secret" } });
expect(loaded.provider).toEqual({
  kind: "openai-compatible",
  model: "gpt-4.1-mini",
  baseUrl: "https://llm.example.com/v1",
  apiKeyEnv: "OPENAI_API_KEY",
});
```

Also assert `resolveProvider(undefined, { OPENAI_API_KEY: "x" })` defaults to `model: "gpt-4.1-mini"` and `baseUrl: "https://api.openai.com/v1"`.

- [ ] **Step 2: Run config tests to verify RED**

Run: `pnpm --filter @opsforge/config test`

Expected: FAIL because `loadConfigFile` / `writeConfigFile` do not exist and provider defaults are not set.

- [ ] **Step 3: Implement minimal config helpers**

Add `apiKeyEnv?: string` to `ProviderConfigSchema`.

Implement:

```ts
export const defaultConfigPath = (): string => join(homedir(), ".opsforge", "config.json");
export const loadConfigFile = async (path = defaultConfigPath(), deps: LoadConfigDeps = {}): Promise<OpsForgeConfig> => {
  const fileContents = await readFile(path, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  return loadConfig({ ...deps, fileContents });
};
export const writeConfigFile = async (path: string, config: OpsForgeConfig): Promise<void> => {
  const parsed = ConfigSchema.parse(config);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
};
```

Update OpenAI env inference to include default model, default base URL, and `apiKeyEnv: "OPENAI_API_KEY"`.

- [ ] **Step 4: Run config tests to verify GREEN**

Run: `pnpm --filter @opsforge/config test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/config
git commit -m "feat(config): persist provider settings"
```

### Task 2: OpenAI-Compatible Planner Provider

**Files:**
- Create: `packages/planner/src/openai-compatible.ts`
- Modify: `packages/planner/src/index.ts`
- Test: `packages/planner/test/planner.test.ts`

- [ ] **Step 1: Write failing planner tests**

Add tests with an injected `fetch` function:

```ts
const provider = createOpenAICompatiblePlanProvider({
  apiKey: "test-key",
  model: "gpt-4.1-mini",
  baseUrl: "https://llm.example.com/v1",
  fetch: async (url, init) => {
    requests.push({ url: String(url), init });
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ title: "Install nginx", intent: "install", steps: [{ type: "package-install", name: "nginx" }], risk: "L1" }) } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  },
});
const plan = await buildPlanFromPrompt({ prompt: "install nginx", provider, planId: () => "plan_ai_1", now: () => "2026-06-23T00:00:00Z" });
expect(plan.id).toBe("plan_ai_1");
expect(requests[0].url).toBe("https://llm.example.com/v1/chat/completions");
expect(requests[0].init.headers.authorization).toBe("Bearer test-key");
```

Add one test for non-2xx responses throwing `OpenAICompatibleProviderError`.

- [ ] **Step 2: Run planner tests to verify RED**

Run: `pnpm --filter @opsforge/planner test`

Expected: FAIL because `createOpenAICompatiblePlanProvider` is not implemented.

- [ ] **Step 3: Implement minimal provider**

The provider must:
- POST to `${baseUrl.replace(/\/$/, "")}/chat/completions`.
- Send `model`, `messages`, `temperature: 0`, and `response_format: { type: "json_object" }`.
- Include `Authorization: Bearer <apiKey>`.
- Parse `choices[0].message.content` as JSON and return the parsed object.
- Throw a typed provider error for missing content, invalid JSON, failed fetch, or non-2xx HTTP status.

- [ ] **Step 4: Run planner tests to verify GREEN**

Run: `pnpm --filter @opsforge/planner test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/planner
git commit -m "feat(planner): add OpenAI-compatible provider"
```

### Task 3: CLI Provider Resolution And Config Command

**Files:**
- Create: `apps/cli/src/provider.ts`
- Create: `apps/cli/src/commands/config.ts`
- Modify: `apps/cli/src/commands/plan.ts`
- Modify: `apps/cli/src/commands/run.ts`
- Modify: `apps/cli/src/commands/doctor.ts`
- Modify: `apps/cli/src/index.ts`
- Test: `apps/cli/test/plan.test.ts`
- Test: `apps/cli/test/run.test.ts`
- Create: `apps/cli/test/config.test.ts`

- [ ] **Step 1: Write failing CLI tests**

Add tests that expect:

```ts
const command = buildConfigCommand({
  configPath: "tmp/config.json",
  write: text => writes.push(text),
  load: async () => ({ riskMax: "L3", allowShell: false, dbPath: "~/.opsforge/opsforge.db", artifactsDir: "~/.opsforge/artifacts" }),
  save: async (_path, config) => saved.push(config),
});
await command.parseAsync(["node", "test", "provider", "openai-compatible", "--model", "gpt-4.1-mini", "--base-url", "https://llm.example.com/v1", "--api-key-env", "OPENAI_API_KEY"], { from: "user" });
expect(saved[0].provider).toEqual({ kind: "openai-compatible", model: "gpt-4.1-mini", baseUrl: "https://llm.example.com/v1", apiKeyEnv: "OPENAI_API_KEY" });
```

Add `plan --provider configured` test with an injected resolver returning a fake provider and assert the generated plan came from that provider.

- [ ] **Step 2: Run CLI tests to verify RED**

Run: `pnpm --filter @opsforge/cli test`

Expected: FAIL because config command and provider flags do not exist.

- [ ] **Step 3: Implement CLI provider resolution**

Create `resolvePlanProvider()`:
- `mock` returns `createMockPlanProvider()`.
- `configured` reads config and creates an OpenAI-compatible provider when `config.provider.kind === "openai-compatible"`.
- `openai-compatible` builds provider from CLI options/env directly.
- Missing API key throws a clear `OpsForgeError`.
- Anthropic/Google/Pi return a clear "not implemented yet" error for this plan.

Update `plan` and `run` to accept provider options and use the resolver unless tests inject `deps.provider`.

Create `config` command with:
- `opsforge config provider openai-compatible --model <id> --base-url <url> --api-key-env <env>`
- `opsforge config show [--json]`

- [ ] **Step 4: Run CLI tests to verify GREEN**

Run: `pnpm --filter @opsforge/cli test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/cli
git commit -m "feat(cli): add provider config command"
```

### Task 4: Docs, Alignment, And Full Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/implementation-status.md`

- [ ] **Step 1: Update README**

Add examples:

```bash
opsforge config provider openai-compatible --model gpt-4.1-mini --base-url https://api.openai.com/v1 --api-key-env OPENAI_API_KEY
opsforge config show
opsforge plan "install nginx" --provider configured --json
```

- [ ] **Step 2: Update implementation status**

Add Plan 7 to implemented plans and add Delivered In Plan 7. Update §6 and §7.2 rows to reflect provider config and OpenAI-compatible adapter. Remove provider config/OpenAI-compatible adapter from known gaps while keeping Anthropic/Google/Pi and retry loops as gaps.

- [ ] **Step 3: Run full verification**

Run:

```bash
pnpm build
pnpm test
pnpm typecheck
```

Expected: all commands exit 0. `node:sqlite` may print its existing experimental warning during audit tests.

- [ ] **Step 4: Commit and push**

```bash
git add README.md docs/implementation-status.md
git commit -m "docs: record Plan 7 provider adapter status"
git push origin main
```

---

## Self-Review

- Spec coverage: This plan advances §6.1 provider configuration and OpenAI-compatible model support, §7.2 `config` CLI, and §11 planner mock HTTP testing. It does not implement Anthropic, Google, Pi runtime, TUI, rollback, or JSON retry loops; those remain outside this slice.
- Placeholder scan: The plan contains concrete commands, files, expected failures, and implementation details for each task.
- Type consistency: Provider fields are consistently `kind`, `model`, `baseUrl`, and `apiKeyEnv`; CLI flags map to those names.
