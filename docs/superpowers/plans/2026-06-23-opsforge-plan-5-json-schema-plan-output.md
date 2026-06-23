# OpsForge Plan 5 — JSON Schema and Plan File Output Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export the DSL Plan JSON Schema and let `opsforge plan "<NL>" --out <file>` persist a schema-valid plan that can be fed directly into `opsforge apply`.

**Architecture:** Keep zod as the single source of truth in `@opsforge/dsl`, add a small schema export module that converts `PlanSchema` to JSON Schema, and add a checked-in `schemas/plan.schema.json` artifact for provider/tooling consumers. Extend the CLI plan command with injected file writing so tests can verify persistence without touching user directories.

**Tech Stack:** TypeScript, pnpm workspace, Turbo, tsup, vitest, zod, zod-to-json-schema, commander, Node fs/path.

**Spec Coverage:** `docs/superpowers/specs/2026-06-23-opsforge-local-ops-agent-design.md` §3 JSON Schema export, §6.1/§6.2 schema-constrained planner output boundary, §7.2 `opsforge plan "<NL>"`, §9 `schemas/*.schema.json`, §11 no-host-mutation tests.

**Branch:** `main` (explicit user instruction for this goal).

---

## File Structure

```text
packages/dsl/
├─ package.json
├─ src/{index,json-schema}.ts
└─ test/json-schema.test.ts
schemas/
└─ plan.schema.json
apps/cli/
├─ src/commands/plan.ts
└─ test/plan.test.ts
docs/
├─ implementation-status.md
└─ README.md
```

---

## Task 1: DSL Plan JSON Schema Export

**Files:**
- Create: `packages/dsl/src/json-schema.ts`
- Create: `packages/dsl/test/json-schema.test.ts`
- Create: `schemas/plan.schema.json`
- Modify: `packages/dsl/src/index.ts`
- Modify: `packages/dsl/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Add schema conversion dependency**

Run:

```bash
pnpm --filter @opsforge/dsl add zod-to-json-schema
```

Expected: `packages/dsl/package.json` includes `zod-to-json-schema` and `pnpm-lock.yaml` updates.

- [ ] **Step 2: Write failing JSON Schema export test**

Create `packages/dsl/test/json-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createPlanJsonSchema, planJsonSchema } from "../src";

describe("Plan JSON Schema export", () => {
  it("exports a stable JSON Schema for provider/tooling consumers", () => {
    expect(planJsonSchema).toMatchObject({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://schemas.opsforge.local/plan.schema.json",
      title: "OpsForge Plan",
      type: "object",
    });
    expect(JSON.stringify(planJsonSchema)).toContain("package-install");
    expect(JSON.stringify(planJsonSchema)).toContain("smoke-test");
  });

  it("returns a fresh schema object so callers cannot mutate the exported singleton", () => {
    const first = createPlanJsonSchema();
    const second = createPlanJsonSchema();

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});
```

Run:

```bash
pnpm --filter @opsforge/dsl test -- --run test/json-schema.test.ts
```

Expected: FAIL because `createPlanJsonSchema` and `planJsonSchema` are not exported yet.

- [ ] **Step 3: Implement JSON Schema export**

Create `packages/dsl/src/json-schema.ts`:

```ts
import { zodToJsonSchema } from "zod-to-json-schema";
import { PlanSchema } from "./schema";

export type JsonSchemaObject = Record<string, unknown>;

const PLAN_SCHEMA_ID = "https://schemas.opsforge.local/plan.schema.json";

export const createPlanJsonSchema = (): JsonSchemaObject => {
  const schema = zodToJsonSchema(PlanSchema, {
    name: "OpsForgePlan",
    $refStrategy: "none",
    target: "jsonSchema2020-12",
  }) as JsonSchemaObject;

  return {
    ...schema,
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: PLAN_SCHEMA_ID,
    title: "OpsForge Plan",
  };
};

export const planJsonSchema = createPlanJsonSchema();
```

Modify `packages/dsl/src/index.ts`:

```ts
export * from "./json-schema";
```

- [ ] **Step 4: Verify DSL schema export**

Run:

```bash
pnpm --filter @opsforge/dsl test -- --run test/json-schema.test.ts
pnpm --filter @opsforge/dsl typecheck
pnpm --filter @opsforge/dsl build
```

Expected: all commands exit 0.

- [ ] **Step 5: Add checked-in schema artifact**

Create `schemas/plan.schema.json` from `planJsonSchema` and keep keys in the generated order. The artifact must include:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.opsforge.local/plan.schema.json",
  "title": "OpsForge Plan"
}
```

Run:

```bash
node --input-type=module -e "import { planJsonSchema } from './packages/dsl/dist/index.js'; console.log(JSON.stringify(planJsonSchema, null, 2));"
```

Expected: output matches the checked-in schema artifact.

- [ ] **Step 6: Commit**

```bash
git add packages/dsl schemas/plan.schema.json pnpm-lock.yaml
git commit -m "feat(dsl): export plan json schema"
```

---

## Task 2: CLI Plan File Output

**Files:**
- Modify: `apps/cli/src/commands/plan.ts`
- Modify: `apps/cli/test/plan.test.ts`

- [ ] **Step 1: Write failing CLI output-file test**

Append to `apps/cli/test/plan.test.ts`:

```ts
it("writes a schema-valid JSON plan to --out without changing stdout mode", async () => {
  const writes: string[] = [];
  const files: Record<string, string> = {};
  const command = buildPlanCommand({
    write: (text) => writes.push(text),
    writeFile: async (path, text) => {
      files[path] = text;
    },
    now: () => "2026-06-23T00:00:00Z",
    planId: () => "plan_cli_out",
  });

  await command.parseAsync(["node", "test", "install nginx", "--out", "plans/nginx.json"], { from: "user" });

  expect(writes[0]).toContain("OpsForge plan");
  expect(writes[0]).toContain("Saved:              plans/nginx.json");
  const parsed = JSON.parse(files["plans/nginx.json"]);
  expect(parsed.id).toBe("plan_cli_out");
  expect(parsed.steps[0]).toEqual({ type: "package-install", name: "nginx" });
});
```

Run:

```bash
pnpm --filter @opsforge/cli test -- --run test/plan.test.ts
```

Expected: FAIL because `writeFile` dependency and `--out` option do not exist.

- [ ] **Step 2: Implement injected file writing**

Modify `apps/cli/src/commands/plan.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
```

Extend `BuildPlanCommandDeps`:

```ts
writeFile?: (path: string, text: string) => Promise<void>;
```

Add helper:

```ts
const writePlanFile = async (path: string, text: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, "utf8");
};
```

Update command options and action:

```ts
.option("--out <file>", "将 Plan JSON 写入文件")
.action(async (prompt: string, options: { json: boolean; out?: string }) => {
  const plan = await buildPlanFromPrompt(...);
  const json = JSON.stringify(plan, null, 2);
  if (options.out) await (deps.writeFile ?? writePlanFile)(options.out, `${json}\n`);
  const output = options.json ? json : formatPlanResult(plan, options.out);
  write(output);
});
```

Update `formatPlanResult` to accept `savedPath?: string` and append:

```ts
...(savedPath ? [`  Saved:              ${savedPath}`] : []),
```

- [ ] **Step 3: Verify CLI output file**

Run:

```bash
pnpm --filter @opsforge/cli test -- --run test/plan.test.ts
pnpm --filter @opsforge/cli typecheck
pnpm --filter @opsforge/cli build
```

Expected: all commands exit 0.

- [ ] **Step 4: Manual persistence smoke check**

Run:

```bash
node apps/cli/dist/index.js plan "install nginx" --out .opsforge-tmp/plan-nginx.json
node apps/cli/dist/index.js apply .opsforge-tmp/plan-nginx.json --dry-run
```

Expected:
- first command prints a human summary with `Saved:              .opsforge-tmp/plan-nginx.json`.
- second command parses the saved JSON and performs a dry-run without host mutation.

- [ ] **Step 5: Commit**

```bash
git add apps/cli
git commit -m "feat(cli): write generated plans to files"
```

---

## Task 3: Documentation, Alignment, Full Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/implementation-status.md`

- [ ] **Step 1: Update implementation status**

Update `docs/implementation-status.md`:

- Add Plan 5 to implemented plans.
- Add "Delivered In Plan 5" with DSL JSON Schema export, checked-in schema artifact, and `opsforge plan --out`.
- Update §3 DSL row from "JSON Schema export is still missing" to "Plan JSON Schema export exists; other schema artifacts remain".
- Update §7.2 CLI row to include plan file output.
- Remove "JSON Schema export from DSL is not implemented" from known gaps and replace it with narrower remaining schema gaps.

- [ ] **Step 2: Update README commands and structure**

Add:

```bash
node apps/cli/dist/index.js plan "install nginx" --out .opsforge-tmp/plan-nginx.json
node apps/cli/dist/index.js apply .opsforge-tmp/plan-nginx.json --dry-run
```

Mention `schemas/plan.schema.json` as the checked-in Plan schema artifact.

- [ ] **Step 3: Full verification**

Run:

```bash
pnpm build
pnpm test
pnpm typecheck
node apps/cli/dist/index.js plan "install nginx"
node apps/cli/dist/index.js plan "install nginx" --json
node apps/cli/dist/index.js plan "install nginx" --out .opsforge-tmp/plan-nginx.json
node apps/cli/dist/index.js apply .opsforge-tmp/plan-nginx.json --dry-run
node --input-type=module -e "import { planJsonSchema } from './packages/dsl/dist/index.js'; const fs = await import('node:fs/promises'); const checkedIn = JSON.parse(await fs.readFile('schemas/plan.schema.json', 'utf8')); if (JSON.stringify(planJsonSchema) !== JSON.stringify(checkedIn)) process.exit(1);"
```

Expected:
- all pnpm commands exit 0.
- plan human output includes `package-install nginx`.
- plan JSON output contains `steps[0].type = "package-install"`.
- saved plan can be dry-run applied.
- checked-in schema artifact matches exported runtime schema.

- [ ] **Step 4: Commit and push**

```bash
git add README.md docs/implementation-status.md
git commit -m "docs: record Plan 5 schema and plan output status"
git push origin main
```

---

## Done Definition

- `@opsforge/dsl` exports `createPlanJsonSchema()` and `planJsonSchema`.
- `schemas/plan.schema.json` is checked in and matches the runtime export.
- `opsforge plan "<NL>" --out <file>` writes schema-valid Plan JSON.
- `--out` does not execute host mutation commands.
- A saved plan can be consumed by `opsforge apply <file> --dry-run`.
- `pnpm build`, `pnpm test`, and `pnpm typecheck` pass.
- Docs state what Plan 5 implemented and keep remaining spec gaps explicit.

## Known Gaps After Plan 5

- Only the Plan schema artifact is exported; job, approval, inventory, and audit schema artifacts remain future work.
- Generated plans are persisted as files, not yet in a first-class plan registry.
- Real provider adapters, provider config, JSON retry loops, Pi runtime, TUI, run/verify/rollback/config commands, and rollback orchestration remain future work.
