# OpsForge Plan 4 — Planner Provider Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first natural-language planning path: a provider-independent planner package with a deterministic mock provider, plus `opsforge plan "<goal>"` that emits schema-valid Plan JSON without executing host commands.

**Architecture:** Introduce `@opsforge/planner` as the boundary between natural language/provider output and the DSL. The planner accepts a provider interface, validates returned JSON with `@opsforge/dsl`, normalizes missing operational defaults, and leaves real LLM/Pi integration for a later plan. Wire the CLI plan command to this package with injected dependencies for tests.

**Tech Stack:** TypeScript, pnpm workspace, Turbo, tsup, vitest, zod via `@opsforge/dsl`, commander, Node fs/path.

**Spec Coverage:** `docs/superpowers/specs/2026-06-23-opsforge-local-ops-agent-design.md` §6.1 multi-provider model layer, §6.2 planner as build_plan schema + validation, §7.2 `opsforge plan "<NL>"`, §11 no-host-mutation tests.

**Branch:** `main` (explicit user instruction for this goal).

---

## File Structure

```text
packages/planner/
├─ package.json
├─ tsconfig.json
├─ src/{index,planner,providers,mock}.ts
└─ test/planner.test.ts
apps/cli/
├─ src/commands/plan.ts
├─ src/index.ts
└─ test/plan.test.ts
docs/
├─ implementation-status.md
└─ README.md
```

---

## Task 1: Planner Package Skeleton and Mock Provider

**Files:**
- Create: `packages/planner/package.json`, `packages/planner/tsconfig.json`
- Create: `packages/planner/src/index.ts`, `packages/planner/src/planner.ts`, `packages/planner/src/providers.ts`, `packages/planner/src/mock.ts`
- Create: `packages/planner/test/planner.test.ts`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Write failing planner tests**

Create `packages/planner/test/planner.test.ts` with tests for:

```ts
import { describe, expect, it } from "vitest";
import { buildPlanFromPrompt, createMockPlanProvider, PlannerValidationError } from "../src/index";

describe("buildPlanFromPrompt", () => {
  it("returns a schema-valid install plan from the mock provider", async () => {
    const plan = await buildPlanFromPrompt({
      prompt: "install nginx",
      provider: createMockPlanProvider(),
      now: () => "2026-06-23T00:00:00Z",
      planId: () => "plan_mock_1",
    });

    expect(plan).toMatchObject({
      id: "plan_mock_1",
      title: "Install nginx",
      intent: "install",
      risk: "L1",
      createdAt: "2026-06-23T00:00:00Z",
    });
    expect(plan.steps.map((step) => step.type)).toEqual(["package-install"]);
    expect(plan.verifications[0]).toEqual({ type: "smoke-test", cmd: "nginx --version", expectExit: 0 });
    expect(plan.rollback[0]).toEqual({ type: "package-remove", name: "nginx" });
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
```

Run: `pnpm --filter @opsforge/planner test`
Expected: FAIL because `@opsforge/planner` does not exist yet.

- [ ] **Step 2: Add workspace package files**

Create `packages/planner/package.json`:

```json
{
  "name": "@opsforge/planner",
  "version": "0.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --clean",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@opsforge/dsl": "workspace:*",
    "@opsforge/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.7.0",
    "tsup": "^8.3.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

Create `packages/planner/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src", "test"]
}
```

Run: `pnpm install`
Expected: lockfile updates and `@opsforge/planner` appears in workspace resolution.

- [ ] **Step 3: Implement provider interfaces and planner validation**

Create `packages/planner/src/providers.ts`:

```ts
export interface PlanProviderRequest {
  prompt: string;
}

export interface PlanProvider {
  name: string;
  buildPlan(request: PlanProviderRequest): Promise<unknown>;
}
```

Create `packages/planner/src/planner.ts`:

```ts
import { PlanSchema, type Plan } from "@opsforge/dsl";
import { OpsForgeError } from "@opsforge/shared";
import type { PlanProvider } from "./providers";

export class PlannerValidationError extends OpsForgeError {
  constructor(message: string) {
    super("PLANNER_VALIDATION_FAILED", message);
  }
}

export interface BuildPlanInput {
  prompt: string;
  provider: PlanProvider;
  now?: () => string;
  planId?: () => string;
}

const withDefaults = (input: unknown, id: string, createdAt: string): unknown => {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return input;
  const candidate = input as Record<string, unknown>;
  return {
    prechecks: [],
    verifications: [],
    rollback: [],
    explanation: [],
    ...candidate,
    id: typeof candidate.id === "string" ? candidate.id : id,
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : createdAt,
  };
};

export const buildPlanFromPrompt = async (input: BuildPlanInput): Promise<Plan> => {
  const generated = await input.provider.buildPlan({ prompt: input.prompt });
  const candidate = withDefaults(
    generated,
    input.planId?.() ?? `plan_${Date.now().toString(36)}`,
    input.now?.() ?? new Date().toISOString(),
  );
  const parsed = PlanSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new PlannerValidationError(parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  return parsed.data;
};
```

Create `packages/planner/src/mock.ts`:

```ts
import type { PlanProvider } from "./providers";

const packageNameFromPrompt = (prompt: string): string => {
  const normalized = prompt.toLowerCase();
  const match = normalized.match(/\binstall\s+([a-z0-9._-]+)/);
  return match?.[1] ?? "nginx";
};

const titleForPackage = (name: string): string =>
  `Install ${name}`;

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
```

Create `packages/planner/src/index.ts`:

```ts
export * from "./providers";
export * from "./planner";
export * from "./mock";
```

- [ ] **Step 4: Verify and commit**

Run:

```bash
pnpm --filter @opsforge/planner test
pnpm --filter @opsforge/planner typecheck
pnpm --filter @opsforge/planner build
```

Commit:

```bash
git add packages/planner pnpm-lock.yaml
git commit -m "feat(planner): add schema-valid mock plan provider"
```

---

## Task 2: CLI `opsforge plan`

**Files:**
- Create: `apps/cli/src/commands/plan.ts`
- Modify: `apps/cli/src/index.ts`, `apps/cli/package.json`
- Create: `apps/cli/test/plan.test.ts`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Write failing CLI plan tests**

Create `apps/cli/test/plan.test.ts` with tests for:

```ts
import { describe, expect, it } from "vitest";
import { buildPlanCommand, formatPlanResult } from "../src/commands/plan";

describe("formatPlanResult", () => {
  it("prints a compact human summary", () => {
    const output = formatPlanResult({
      id: "plan_1",
      title: "Install nginx",
      intent: "install",
      risk: "L1",
      steps: [{ type: "package-install", name: "nginx" }],
      verifications: [{ type: "smoke-test", cmd: "nginx --version", expectExit: 0 }],
      rollback: [{ type: "package-remove", name: "nginx" }],
      explanation: ["Mock provider generated an install plan for nginx."],
      createdAt: "2026-06-23T00:00:00Z",
      prechecks: [],
    });

    expect(output).toContain("OpsForge plan");
    expect(output).toContain("Plan ID:            plan_1");
    expect(output).toContain("Steps:              1");
    expect(output).toContain("1. package-install nginx");
  });
});

describe("buildPlanCommand", () => {
  it("writes JSON plan output through the injected writer", async () => {
    const writes: string[] = [];
    const command = buildPlanCommand({
      write: (text) => writes.push(text),
      now: () => "2026-06-23T00:00:00Z",
      planId: () => "plan_cli_1",
    });

    await command.parseAsync(["node", "test", "install nginx", "--json"], { from: "user" });

    const parsed = JSON.parse(writes[0]);
    expect(parsed.id).toBe("plan_cli_1");
    expect(parsed.steps[0]).toEqual({ type: "package-install", name: "nginx" });
  });
});
```

Run: `pnpm --filter @opsforge/cli test`
Expected: FAIL because `apps/cli/src/commands/plan.ts` does not exist.

- [ ] **Step 2: Add planner dependency**

Run:

```bash
pnpm --filter @opsforge/cli add @opsforge/planner@workspace:*
```

Expected: `apps/cli/package.json` includes `@opsforge/planner` and lockfile updates.

- [ ] **Step 3: Implement plan command**

Create `apps/cli/src/commands/plan.ts`:

```ts
import { Command } from "commander";
import { buildPlanFromPrompt, createMockPlanProvider, type PlanProvider } from "@opsforge/planner";
import type { Plan } from "@opsforge/dsl";

export interface BuildPlanCommandDeps {
  provider?: PlanProvider;
  write?: (text: string) => void;
  now?: () => string;
  planId?: () => string;
}

const stepToText = (step: Plan["steps"][number]): string => {
  if ("name" in step && typeof step.name === "string") return `${step.type} ${step.name}`;
  if ("path" in step && typeof step.path === "string") return `${step.type} ${step.path}`;
  if ("cmd" in step && typeof step.cmd === "string") return `${step.type} ${step.cmd}`;
  return step.type;
};

export const formatPlanResult = (plan: Plan): string => [
  "OpsForge plan",
  `  Plan ID:            ${plan.id}`,
  `  Title:              ${plan.title}`,
  `  Intent:             ${plan.intent}`,
  `  Risk:               ${plan.risk}`,
  `  Steps:              ${plan.steps.length}`,
  ...plan.steps.map((step, index) => `    ${index + 1}. ${stepToText(step)}`),
  `  Verifications:      ${plan.verifications.length}`,
  `  Rollback steps:     ${plan.rollback.length}`,
].join("\n");

export const buildPlanCommand = (deps: BuildPlanCommandDeps = {}): Command => {
  const write = deps.write ?? ((text: string) => console.log(text));
  const command = new Command("plan");

  command
    .description("根据自然语言生成一个结构化 Plan（不执行）")
    .argument("<prompt>", "Natural language operation goal")
    .option("--json", "输出 JSON", false)
    .action(async (prompt: string, options: { json: boolean }) => {
      const plan = await buildPlanFromPrompt({
        prompt,
        provider: deps.provider ?? createMockPlanProvider(),
        now: deps.now,
        planId: deps.planId,
      });
      write(options.json ? JSON.stringify(plan, null, 2) : formatPlanResult(plan));
    });

  return command;
};
```

Modify `apps/cli/src/index.ts` to import and register the command:

```ts
import { buildPlanCommand } from "./commands/plan";

program.addCommand(buildPlanCommand());
```

- [ ] **Step 4: Verify and commit**

Run:

```bash
pnpm --filter @opsforge/cli test
pnpm --filter @opsforge/cli typecheck
pnpm --filter @opsforge/cli build
```

Commit:

```bash
git add apps/cli pnpm-lock.yaml
git commit -m "feat(cli): generate plans from natural language prompts"
```

---

## Task 3: Documentation, Alignment, Full Verification

**Files:**
- Modify: `README.md`, `docs/implementation-status.md`

- [ ] **Step 1: Update implementation status**

Update `docs/implementation-status.md`:

- Add Plan 4 to implemented plans.
- Add "Delivered In Plan 4" describing `@opsforge/planner`, mock provider, schema validation, and `opsforge plan`.
- Update §6/§7.2 alignment rows to say planner/provider scaffolding and `plan` exist, while real LLM providers and Pi runtime remain gaps.
- Keep gaps explicit: real OpenAI/Anthropic/Google/Pi adapters, JSON-mode retry, provider config command, TUI plan card rendering.

- [ ] **Step 2: Update README commands**

Add:

```bash
node apps/cli/dist/index.js plan "install nginx"
node apps/cli/dist/index.js plan "install nginx" --json
```

- [ ] **Step 3: Full verification**

Run:

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
node apps/cli/dist/index.js plan "install nginx"
node apps/cli/dist/index.js plan "install nginx" --json
node apps/cli/dist/index.js apply examples/plan-install-nginx.local.json --dry-run
node apps/cli/dist/index.js audit ls
```

Expected:
- all pnpm commands exit 0.
- `opsforge plan` human output includes `OpsForge plan` and `package-install nginx`.
- `opsforge plan --json` emits schema-valid JSON with `steps[0].type = "package-install"`.
- `apply --dry-run` still does not execute host mutation commands.
- `audit ls` still lists persisted runs.

- [ ] **Step 4: Commit and push**

```bash
git add README.md docs/implementation-status.md
git commit -m "docs: record Plan 4 planner scaffold status"
git push origin main
```

---

## Done Definition

- `@opsforge/planner` exists as a workspace package.
- Planner provider interface is provider-independent and returns unknown raw output.
- Planner validates provider output through `@opsforge/dsl` before returning a Plan.
- Invalid provider output fails with a stable planner validation error.
- Mock provider generates deterministic install plans for prompts like `install nginx`.
- `opsforge plan "<NL>"` emits a human-readable Plan summary.
- `opsforge plan "<NL>" --json` emits schema-valid Plan JSON.
- No host mutation occurs during plan generation.
- `pnpm build`, `pnpm test`, and `pnpm typecheck` pass.
- Docs state what Plan 4 implemented and what remains.

## Known Gaps After Plan 4

- No real LLM provider adapters yet.
- No Pi runtime/session integration yet.
- No JSON-mode retry or tool-call retry loop yet.
- No persisted plan registry separate from audit runs yet.
- TUI still does not consume planner output.
