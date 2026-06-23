# OpsForge Plan 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭起 OpsForge 的 pnpm+turbo TypeScript monorepo 骨架，落地 `shared` / `config` / `dsl` 三个基础包和一个能跑的 `opsforge doctor` CLI。

**Architecture:** pnpm workspace + Turbo 编排；每个包用 tsup 打 ESM + d.ts，vitest 跑单测。`dsl` 用 zod 作为单一事实源导出 schema 与类型；`config` 做配置加载与 provider 解析；`cli` 用 commander 暴露 `opsforge`/`ops` 两个 bin，先实现 `doctor` 子命令（检测 OS / 包管理器 / provider）。本计划不涉及 LLM、执行器、TUI（分别在 Plan 2/3/4）。

**Tech Stack:** TypeScript 5.6, Node ≥20 (本机为 v24), pnpm 9 (corepack), Turbo 2, tsup 8, vitest 2, zod 3, pino 9, commander 12。

**Spec:** `docs/superpowers/specs/2026-06-23-opsforge-local-ops-agent-design.md`（§3 DSL、§7.2 CLI、§9 包拆分、§10 技术栈）。
**Branch:** `feat/opsforge-mvp`。

---

## 前置条件

- Node ≥ 20（本机 `node -v` = v24.13.0）。
- pnpm 通过 corepack 启用（Task 1 第一步）。
- 所有命令在仓库根目录 `d:/dev/agent/OpsForge` 下，git bash 执行。

## File Structure（本计划创建的文件）

```text
opsforge/
├─ package.json                 # 根：私有，workspace 脚本，devDeps(turbo/typescript/tsup/vitest)
├─ pnpm-workspace.yaml          # workspace 范围：packages/* apps/*
├─ turbo.json                   # build/test/typecheck 任务图
├─ tsconfig.base.json           # 共享 TS 编译选项（ESNext + Bundler 解析）
├─ .gitignore                   # 忽略 node_modules/dist/.turbo/.opsforge/.claude/.omc
├─ packages/
│  ├─ shared/                   # @opsforge/shared：errors / logger / 输出截断
│  │  ├─ package.json  tsconfig.json
│  │  ├─ src/{index,errors,logger,output}.ts
│  │  └─ test/output.test.ts
│  ├─ dsl/                      # @opsforge/dsl：Plan/Step/Verify/Precheck zod schema + 类型
│  │  ├─ package.json  tsconfig.json
│  │  ├─ src/{index,schema}.ts
│  │  └─ test/schema.test.ts
│  └─ config/                   # @opsforge/config：配置 schema + 加载 + provider 解析
│     ├─ package.json  tsconfig.json
│     ├─ src/{index,schema,load}.ts
│     └─ test/config.test.ts
└─ apps/
   └─ cli/                      # @opsforge/cli：bin opsforge/ops + doctor 子命令
      ├─ package.json  tsconfig.json  tsup.config.ts
      ├─ src/{index,which,detect}.ts  src/commands/doctor.ts
      └─ test/{detect,doctor}.test.ts
```

每个包职责单一、可独立单测。`shared` 是 Plan 2 的基础（执行器/审计会用到 logger/errors/截断），本计划先把它和单测立稳。

---

## Task 1: 根 monorepo 骨架

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.gitignore`

- [ ] **Step 1: 启用 pnpm（corepack）**

Run:
```bash
corepack enable && corepack prepare pnpm@9.12.0 --activate && pnpm -v
```
Expected: 打印 `9.12.0`（或相近 9.x）。

- [ ] **Step 2: 创建 `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

- [ ] **Step 3: 创建根 `package.json`**

```json
{
  "name": "opsforge-monorepo",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "turbo": "^2.1.0",
    "typescript": "^5.6.0",
    "tsup": "^8.3.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 4: 创建 `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test": { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

- [ ] **Step 5: 创建 `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 6: 创建 `.gitignore`**

```gitignore
node_modules/
dist/
.turbo/
*.tsbuildinfo
.opsforge/
.claude/
.omc/
```

- [ ] **Step 7: 安装并验证 workspace**

Run:
```bash
pnpm install
```
Expected: 安装成功（此时无子包也应成功，生成 `pnpm-lock.yaml`）。

- [ ] **Step 8: 提交**

```bash
git add package.json pnpm-workspace.yaml turbo.json tsconfig.base.json .gitignore pnpm-lock.yaml
git commit -m "chore: scaffold pnpm+turbo monorepo skeleton"
```

---

## Task 2: `@opsforge/shared`

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`
- Create: `packages/shared/src/output.ts`, `packages/shared/src/errors.ts`, `packages/shared/src/logger.ts`, `packages/shared/src/index.ts`
- Test: `packages/shared/test/output.test.ts`

- [ ] **Step 1: 创建包清单 `packages/shared/package.json`**

```json
{
  "name": "@opsforge/shared",
  "version": "0.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } },
  "files": ["dist"],
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --clean",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": { "pino": "^9.4.0" },
  "devDependencies": {
    "@types/node": "^22.7.0",
    "tsup": "^8.3.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: 创建 `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist" },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: 安装依赖**

Run: `pnpm install`
Expected: 链接 `@opsforge/shared` 到 workspace，安装 pino 等。

- [ ] **Step 4: 写失败测试 `packages/shared/test/output.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { truncateOutput } from "../src/output";

describe("truncateOutput", () => {
  it("returns text unchanged when under the byte limit", () => {
    expect(truncateOutput("hello", 100)).toEqual({ text: "hello", truncated: false });
  });

  it("truncates and flags when over the byte limit", () => {
    const r = truncateOutput("abcdef", 3);
    expect(r.truncated).toBe(true);
    expect(Buffer.byteLength(r.text, "utf8")).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 5: 运行测试，确认失败**

Run: `pnpm --filter @opsforge/shared test`
Expected: FAIL，报错 `Cannot find module '../src/output'` 或 `truncateOutput is not a function`。

- [ ] **Step 6: 实现 `packages/shared/src/output.ts`**

```ts
export interface TruncateResult {
  text: string;
  truncated: boolean;
}

/** 按 UTF-8 字节上限截断，超出则标记 truncated=true。 */
export function truncateOutput(text: string, maxBytes: number): TruncateResult {
  const buf = Buffer.from(text, "utf8");
  if (buf.byteLength <= maxBytes) {
    return { text, truncated: false };
  }
  return { text: buf.subarray(0, maxBytes).toString("utf8"), truncated: true };
}
```

- [ ] **Step 7: 运行测试，确认通过**

Run: `pnpm --filter @opsforge/shared test`
Expected: PASS（2 passed）。

- [ ] **Step 8: 添加 `errors.ts` / `logger.ts` / `index.ts`**

`packages/shared/src/errors.ts`:
```ts
/** OpsForge 统一错误基类，带稳定的 code 便于审计与判别。 */
export class OpsForgeError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "OpsForgeError";
  }
}
```

`packages/shared/src/logger.ts`:
```ts
import pino, { type Logger } from "pino";

export function createLogger(name: string): Logger {
  return pino({ name, level: process.env.OPSFORGE_LOG_LEVEL ?? "info" });
}
```

`packages/shared/src/index.ts`:
```ts
export * from "./output";
export * from "./errors";
export * from "./logger";
```

- [ ] **Step 9: typecheck + build**

Run: `pnpm --filter @opsforge/shared typecheck && pnpm --filter @opsforge/shared build`
Expected: 无类型错误；`packages/shared/dist/index.js` 与 `index.d.ts` 生成。

- [ ] **Step 10: 提交**

```bash
git add packages/shared pnpm-lock.yaml
git commit -m "feat(shared): errors, logger, and truncateOutput util"
```

---

## Task 3: `@opsforge/dsl`

**Files:**
- Create: `packages/dsl/package.json`, `packages/dsl/tsconfig.json`
- Create: `packages/dsl/src/schema.ts`, `packages/dsl/src/index.ts`
- Test: `packages/dsl/test/schema.test.ts`

- [ ] **Step 1: 创建 `packages/dsl/package.json`**

```json
{
  "name": "@opsforge/dsl",
  "version": "0.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } },
  "files": ["dist"],
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --clean",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": { "zod": "^3.23.8" },
  "devDependencies": {
    "tsup": "^8.3.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: 创建 `packages/dsl/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist" },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: 安装依赖**

Run: `pnpm install`
Expected: 安装 zod，链接 `@opsforge/dsl`。

- [ ] **Step 4: 写失败测试 `packages/dsl/test/schema.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { parsePlan, safeParsePlan } from "../src/index";

const validPlan = {
  id: "plan_1",
  title: "Install nginx",
  intent: "install",
  steps: [{ type: "package-install", name: "nginx" }],
  risk: "L1",
  createdAt: "2026-06-23T00:00:00Z",
};

describe("PlanSchema", () => {
  it("parses a valid plan and applies array defaults", () => {
    const p = parsePlan(validPlan);
    expect(p.prechecks).toEqual([]);
    expect(p.verifications).toEqual([]);
    expect(p.rollback).toEqual([]);
    expect(p.explanation).toEqual([]);
    expect(p.steps[0]).toEqual({ type: "package-install", name: "nginx" });
  });

  it("rejects an unknown step type", () => {
    const bad = { ...validPlan, steps: [{ type: "format-disk" }] };
    expect(safeParsePlan(bad).success).toBe(false);
  });

  it("rejects an invalid risk level", () => {
    const bad = { ...validPlan, risk: "L9" };
    expect(safeParsePlan(bad).success).toBe(false);
  });
});
```

- [ ] **Step 5: 运行测试，确认失败**

Run: `pnpm --filter @opsforge/dsl test`
Expected: FAIL，`Cannot find module '../src/index'`。

- [ ] **Step 6: 实现 `packages/dsl/src/schema.ts`**

```ts
import { z } from "zod";

export const RiskLevelSchema = z.enum(["L0", "L1", "L2", "L3"]);
export const OsFamilySchema = z.enum(["linux", "windows"]);
export const IntentSchema = z.enum([
  "install", "upgrade", "configure", "diagnose", "verify", "rollback",
]);

export const StepSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("package-update-cache") }),
  z.object({ type: z.literal("package-install"), name: z.string(), version: z.string().optional(), source: z.string().optional() }),
  z.object({ type: z.literal("package-remove"), name: z.string() }),
  z.object({ type: z.literal("service-enable"), name: z.string() }),
  z.object({ type: z.literal("service-start"), name: z.string() }),
  z.object({ type: z.literal("service-stop"), name: z.string() }),
  z.object({ type: z.literal("service-status"), name: z.string() }),
  z.object({ type: z.literal("file-write"), path: z.string(), content: z.string(), mode: z.string().optional() }),
  z.object({ type: z.literal("file-template"), path: z.string(), template: z.string(), vars: z.record(z.string()) }),
  z.object({ type: z.literal("shell"), cmd: z.string(), shell: z.enum(["bash", "powershell"]).optional() }),
]);

export const PrecheckSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("os-detect") }),
  z.object({ type: z.literal("privilege-check"), requireElevated: z.boolean().optional() }),
  z.object({ type: z.literal("disk-check"), minFreeMB: z.number() }),
  z.object({ type: z.literal("command-exists"), name: z.string() }),
]);

export const VerificationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("package-version"), name: z.string(), expect: z.string().optional() }),
  z.object({ type: z.literal("service-status"), name: z.string(), expect: z.enum(["active", "running", "stopped"]) }),
  z.object({ type: z.literal("port-open"), port: z.number() }),
  z.object({ type: z.literal("process-alive"), name: z.string() }),
  z.object({ type: z.literal("file-checksum"), path: z.string(), sha256: z.string() }),
  z.object({ type: z.literal("smoke-test"), cmd: z.string(), expectExit: z.number().optional() }),
]);

export const PackageSpecSchema = z.object({
  name: z.string(),
  source: z.string().optional(),
  version: z.string().optional(),
});

export const PlanSchema = z.object({
  id: z.string(),
  title: z.string(),
  intent: IntentSchema,
  osFamily: OsFamilySchema.optional(),
  packageSpec: PackageSpecSchema.optional(),
  prechecks: z.array(PrecheckSchema).default([]),
  steps: z.array(StepSchema),
  verifications: z.array(VerificationSchema).default([]),
  rollback: z.array(StepSchema).default([]),
  risk: RiskLevelSchema,
  explanation: z.array(z.string()).default([]),
  createdAt: z.string(),
});
```

- [ ] **Step 7: 实现 `packages/dsl/src/index.ts`**

```ts
import type { z } from "zod";
import {
  PlanSchema, StepSchema, PrecheckSchema, VerificationSchema,
  RiskLevelSchema, OsFamilySchema, IntentSchema, PackageSpecSchema,
} from "./schema";

export * from "./schema";

export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type OsFamily = z.infer<typeof OsFamilySchema>;
export type Intent = z.infer<typeof IntentSchema>;
export type Step = z.infer<typeof StepSchema>;
export type Precheck = z.infer<typeof PrecheckSchema>;
export type Verification = z.infer<typeof VerificationSchema>;
export type PackageSpec = z.infer<typeof PackageSpecSchema>;
export type Plan = z.infer<typeof PlanSchema>;

export function parsePlan(input: unknown): Plan {
  return PlanSchema.parse(input);
}

export function safeParsePlan(input: unknown) {
  return PlanSchema.safeParse(input);
}
```

- [ ] **Step 8: 运行测试，确认通过**

Run: `pnpm --filter @opsforge/dsl test`
Expected: PASS（3 passed）。

- [ ] **Step 9: typecheck + build**

Run: `pnpm --filter @opsforge/dsl typecheck && pnpm --filter @opsforge/dsl build`
Expected: 无类型错误；生成 `packages/dsl/dist/`。

- [ ] **Step 10: 提交**

```bash
git add packages/dsl pnpm-lock.yaml
git commit -m "feat(dsl): zod Plan/Step/Verify/Precheck schema + inferred types"
```

---

## Task 4: `@opsforge/config`

**Files:**
- Create: `packages/config/package.json`, `packages/config/tsconfig.json`
- Create: `packages/config/src/schema.ts`, `packages/config/src/load.ts`, `packages/config/src/index.ts`
- Test: `packages/config/test/config.test.ts`

- [ ] **Step 1: 创建 `packages/config/package.json`**

```json
{
  "name": "@opsforge/config",
  "version": "0.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } },
  "files": ["dist"],
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --clean",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": { "zod": "^3.23.8" },
  "devDependencies": {
    "@types/node": "^22.7.0",
    "tsup": "^8.3.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: 创建 `packages/config/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist" },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: 安装依赖**

Run: `pnpm install`

- [ ] **Step 4: 写失败测试 `packages/config/test/config.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { loadConfig, resolveProvider } from "../src/index";

describe("loadConfig", () => {
  it("applies defaults with empty env and no file", () => {
    const c = loadConfig({ env: {}, fileContents: null });
    expect(c.riskMax).toBe("L3");
    expect(c.allowShell).toBe(false);
    expect(c.provider).toBeUndefined();
  });

  it("overrides riskMax and allowShell from env", () => {
    const c = loadConfig({ env: { OPSFORGE_RISK_MAX: "L1", OPSFORGE_ALLOW_SHELL: "1" }, fileContents: null });
    expect(c.riskMax).toBe("L1");
    expect(c.allowShell).toBe(true);
  });

  it("reads provider and riskMax from file", () => {
    const file = JSON.stringify({ riskMax: "L2", provider: { kind: "pi" } });
    const c = loadConfig({ env: {}, fileContents: file });
    expect(c.riskMax).toBe("L2");
    expect(c.provider?.kind).toBe("pi");
  });
});

describe("resolveProvider", () => {
  it("prefers anthropic when its key is present", () => {
    expect(resolveProvider(undefined, { ANTHROPIC_API_KEY: "x" })?.kind).toBe("anthropic");
  });

  it("uses openai-compatible with base url", () => {
    const p = resolveProvider(undefined, { OPENAI_API_KEY: "x", OPENAI_BASE_URL: "https://api.example.com/v1" });
    expect(p).toEqual({ kind: "openai-compatible", model: undefined, baseUrl: "https://api.example.com/v1" });
  });

  it("returns undefined when no key is present", () => {
    expect(resolveProvider(undefined, {})).toBeUndefined();
  });
});
```

- [ ] **Step 5: 运行测试，确认失败**

Run: `pnpm --filter @opsforge/config test`
Expected: FAIL，`Cannot find module '../src/index'`。

- [ ] **Step 6: 实现 `packages/config/src/schema.ts`**

```ts
import { z } from "zod";

export const ProviderKindSchema = z.enum(["openai-compatible", "anthropic", "google", "pi"]);

export const ProviderConfigSchema = z.object({
  kind: ProviderKindSchema,
  model: z.string().optional(),
  baseUrl: z.string().url().optional(),
});

export const ConfigSchema = z.object({
  provider: ProviderConfigSchema.optional(),
  riskMax: z.enum(["L0", "L1", "L2", "L3"]).default("L3"),
  allowShell: z.boolean().default(false),
  dbPath: z.string().default("~/.opsforge/opsforge.db"),
  artifactsDir: z.string().default("~/.opsforge/artifacts"),
});

export type ProviderKind = z.infer<typeof ProviderKindSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type OpsForgeConfig = z.infer<typeof ConfigSchema>;
```

- [ ] **Step 7: 实现 `packages/config/src/load.ts`**

```ts
import { ConfigSchema, type OpsForgeConfig, type ProviderConfig } from "./schema";

export interface LoadConfigDeps {
  /** 默认 process.env；测试可注入。 */
  env?: Record<string, string | undefined>;
  /** ~/.opsforge/config.json 的原始内容；不存在传 null。 */
  fileContents?: string | null;
}

/** 合并顺序：schema 默认值 ← 配置文件 ← 环境变量覆盖。 */
export function loadConfig(deps: LoadConfigDeps = {}): OpsForgeConfig {
  const env = deps.env ?? process.env;
  const fromFile: unknown = deps.fileContents ? JSON.parse(deps.fileContents) : {};
  const merged = ConfigSchema.parse(fromFile);

  if (env.OPSFORGE_RISK_MAX) {
    merged.riskMax = ConfigSchema.shape.riskMax.parse(env.OPSFORGE_RISK_MAX);
  }
  if (env.OPSFORGE_ALLOW_SHELL === "1" || env.OPSFORGE_ALLOW_SHELL === "true") {
    merged.allowShell = true;
  }

  const resolved = resolveProvider(merged.provider, env);
  if (resolved) merged.provider = resolved;
  return merged;
}

/** 已配置则原样返回；否则按环境变量推断 provider（anthropic > openai > google）。 */
export function resolveProvider(
  existing: ProviderConfig | undefined,
  env: Record<string, string | undefined>,
): ProviderConfig | undefined {
  if (existing) return existing;
  if (env.ANTHROPIC_API_KEY) return { kind: "anthropic", model: env.OPSFORGE_MODEL };
  if (env.OPENAI_API_KEY) return { kind: "openai-compatible", model: env.OPSFORGE_MODEL, baseUrl: env.OPENAI_BASE_URL };
  if (env.GEMINI_API_KEY) return { kind: "google", model: env.OPSFORGE_MODEL };
  return undefined;
}
```

- [ ] **Step 8: 实现 `packages/config/src/index.ts`**

```ts
export * from "./schema";
export * from "./load";
```

- [ ] **Step 9: 运行测试，确认通过**

Run: `pnpm --filter @opsforge/config test`
Expected: PASS（6 passed）。

- [ ] **Step 10: typecheck + build**

Run: `pnpm --filter @opsforge/config typecheck && pnpm --filter @opsforge/config build`
Expected: 无类型错误；生成 `packages/config/dist/`。

- [ ] **Step 11: 提交**

```bash
git add packages/config pnpm-lock.yaml
git commit -m "feat(config): config schema, env/file loader, provider resolution"
```

---

## Task 5: `@opsforge/cli` + `doctor`

**Files:**
- Create: `apps/cli/package.json`, `apps/cli/tsconfig.json`, `apps/cli/tsup.config.ts`
- Create: `apps/cli/src/detect.ts`, `apps/cli/src/which.ts`, `apps/cli/src/commands/doctor.ts`, `apps/cli/src/index.ts`
- Test: `apps/cli/test/detect.test.ts`, `apps/cli/test/doctor.test.ts`

- [ ] **Step 1: 创建 `apps/cli/package.json`**

```json
{
  "name": "@opsforge/cli",
  "version": "0.0.0",
  "type": "module",
  "bin": { "opsforge": "./dist/index.js", "ops": "./dist/index.js" },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@opsforge/config": "workspace:*",
    "@opsforge/dsl": "workspace:*",
    "commander": "^12.1.0"
  },
  "devDependencies": {
    "@types/node": "^22.7.0",
    "tsup": "^8.3.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: 创建 `apps/cli/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist" },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: 创建 `apps/cli/tsup.config.ts`**

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
});
```

- [ ] **Step 4: 安装依赖**

Run: `pnpm install`
Expected: 链接 `@opsforge/config` / `@opsforge/dsl` 到 cli，安装 commander。

- [ ] **Step 5: 写失败测试 `apps/cli/test/detect.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { detectOs, detectPackageManagers } from "../src/detect";

describe("detectOs", () => {
  it("maps node platforms to OS family", () => {
    expect(detectOs("linux")).toBe("linux");
    expect(detectOs("win32")).toBe("windows");
    expect(detectOs("darwin")).toBe("other");
  });
});

describe("detectPackageManagers", () => {
  it("filters linux candidates by the which probe", () => {
    expect(detectPackageManagers("linux", (c) => c === "apt")).toEqual(["apt"]);
  });
  it("filters windows candidates", () => {
    expect(detectPackageManagers("windows", (c) => c === "winget")).toEqual(["winget"]);
  });
  it("returns empty for an unsupported OS", () => {
    expect(detectPackageManagers("other", () => true)).toEqual([]);
  });
});
```

- [ ] **Step 6: 运行测试，确认失败**

Run: `pnpm --filter @opsforge/cli test`
Expected: FAIL，`Cannot find module '../src/detect'`。

- [ ] **Step 7: 实现 `apps/cli/src/detect.ts`**

```ts
import type { OsFamily } from "@opsforge/dsl";

export type DetectedOs = OsFamily | "other";

export function detectOs(platform: NodeJS.Platform): DetectedOs {
  if (platform === "linux") return "linux";
  if (platform === "win32") return "windows";
  return "other";
}

export type WhichRunner = (cmd: string) => boolean;

const LINUX_PMS = ["apt", "yum", "dnf"];
const WINDOWS_PMS = ["winget", "choco"];

export function detectPackageManagers(os: DetectedOs, which: WhichRunner): string[] {
  const candidates = os === "windows" ? WINDOWS_PMS : os === "linux" ? LINUX_PMS : [];
  return candidates.filter((c) => which(c));
}
```

- [ ] **Step 8: 运行测试，确认通过**

Run: `pnpm --filter @opsforge/cli test`
Expected: PASS（detect 的 4 个用例）。

- [ ] **Step 9: 写失败测试 `apps/cli/test/doctor.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { buildDoctorReport, formatDoctorReport } from "../src/commands/doctor";

describe("buildDoctorReport", () => {
  it("reports detected OS, package managers, and the env-resolved provider", () => {
    const r = buildDoctorReport({
      platform: "linux",
      which: (c) => c === "apt" || c === "dnf",
      env: { ANTHROPIC_API_KEY: "x", OPSFORGE_MODEL: "claude-opus-4-8" },
    });
    expect(r.os).toBe("linux");
    expect(r.packageManagers).toEqual(["apt", "dnf"]);
    expect(r.provider).toContain("anthropic");
    expect(r.provider).toContain("claude-opus-4-8");
    expect(r.riskMax).toBe("L3");
  });

  it("shows '未配置' when no provider key is present", () => {
    const r = buildDoctorReport({ platform: "win32", which: () => false, env: {} });
    expect(r.os).toBe("windows");
    expect(r.provider).toBe("未配置");
  });
});

describe("formatDoctorReport", () => {
  it("renders a human-readable block", () => {
    const text = formatDoctorReport({
      os: "windows", arch: "x64", packageManagers: ["winget"],
      provider: "未配置", riskMax: "L3", allowShell: false,
    });
    expect(text).toContain("OpsForge doctor");
    expect(text).toContain("winget");
  });
});
```

- [ ] **Step 10: 运行测试，确认失败**

Run: `pnpm --filter @opsforge/cli test`
Expected: FAIL，`Cannot find module '../src/commands/doctor'`。

- [ ] **Step 11: 实现 `apps/cli/src/commands/doctor.ts`**

```ts
import { loadConfig } from "@opsforge/config";
import { detectOs, detectPackageManagers, type WhichRunner } from "../detect";

export interface DoctorDeps {
  platform: NodeJS.Platform;
  which: WhichRunner;
  env: Record<string, string | undefined>;
}

export interface DoctorReport {
  os: string;
  arch: string;
  packageManagers: string[];
  provider: string;
  riskMax: string;
  allowShell: boolean;
}

export function buildDoctorReport(deps: DoctorDeps): DoctorReport {
  const os = detectOs(deps.platform);
  const config = loadConfig({ env: deps.env, fileContents: null });
  const p = config.provider;
  return {
    os,
    arch: process.arch,
    packageManagers: detectPackageManagers(os, deps.which),
    provider: p ? `${p.kind}${p.model ? ` (${p.model})` : ""}` : "未配置",
    riskMax: config.riskMax,
    allowShell: config.allowShell,
  };
}

export function formatDoctorReport(r: DoctorReport): string {
  return [
    "OpsForge doctor",
    `  OS:               ${r.os}`,
    `  Arch:             ${r.arch}`,
    `  Package managers: ${r.packageManagers.length ? r.packageManagers.join(", ") : "（未检测到）"}`,
    `  Provider:         ${r.provider}`,
    `  Risk max:         ${r.riskMax}`,
    `  Allow shell:      ${r.allowShell}`,
  ].join("\n");
}
```

- [ ] **Step 12: 运行测试，确认通过**

Run: `pnpm --filter @opsforge/cli test`
Expected: PASS（detect + doctor 共 7 个用例）。

- [ ] **Step 13: 实现 `apps/cli/src/which.ts`（真实 which 探针）**

```ts
import { execFileSync } from "node:child_process";

/** 用系统 which/where 探测命令是否存在；不存在返回 false（不抛）。 */
export function systemWhich(cmd: string): boolean {
  const probe = process.platform === "win32" ? "where" : "which";
  try {
    execFileSync(probe, [cmd], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 14: 实现 bin 入口 `apps/cli/src/index.ts`**

```ts
import { Command } from "commander";
import { buildDoctorReport, formatDoctorReport } from "./commands/doctor";
import { systemWhich } from "./which";

const program = new Command();

program
  .name("opsforge")
  .description("OpsForge — 本机优先的安全运维 Agent")
  .version("0.0.0");

program
  .command("doctor")
  .description("自检：OS、包管理器、provider 配置")
  .action(() => {
    const report = buildDoctorReport({
      platform: process.platform,
      which: systemWhich,
      env: process.env,
    });
    console.log(formatDoctorReport(report));
  });

// 裸命令（无子命令）：TUI 在 Plan 4 实现，目前给出提示而非报错。
if (process.argv.slice(2).length === 0) {
  console.log(
    "OpsForge — 交互式 TUI 将在后续版本提供。\n" +
      "当前可用：`opsforge doctor`。运行 `opsforge --help` 查看全部子命令。",
  );
  process.exit(0);
}

program.parse(process.argv);
```

- [ ] **Step 15: typecheck + build**

Run: `pnpm --filter @opsforge/cli typecheck && pnpm --filter @opsforge/cli build`
Expected: 无类型错误；生成 `apps/cli/dist/index.js`，首行为 `#!/usr/bin/env node`。

- [ ] **Step 16: 提交**

```bash
git add apps/cli pnpm-lock.yaml
git commit -m "feat(cli): opsforge/ops bin with doctor command"
```

---

## Task 6: 全量构建 + 端到端冒烟 + 收尾

**Files:** 无新增（验证整合）。

- [ ] **Step 1: 全量 install + build**

Run: `pnpm install && pnpm build`
Expected: turbo 按依赖顺序构建 shared/dsl/config/cli，全部成功，无错误。

- [ ] **Step 2: 全量测试**

Run: `pnpm test`
Expected: 四个包的 vitest 全绿（shared 2 + dsl 3 + config 6 + cli 7）。

- [ ] **Step 3: 全量 typecheck**

Run: `pnpm typecheck`
Expected: 无类型错误。

- [ ] **Step 4: 冒烟 `doctor`**

Run: `node apps/cli/dist/index.js doctor`
Expected: 打印形如：
```text
OpsForge doctor
  OS:               windows
  Arch:             x64
  Package managers: winget
  Provider:         未配置
  Risk max:         L3
  Allow shell:      false
```
（具体值取决于本机环境与是否设置了 provider key。）

- [ ] **Step 5: 冒烟裸命令**

Run: `node apps/cli/dist/index.js`
Expected: 打印 "交互式 TUI 将在后续版本提供..." 提示，退出码 0。

- [ ] **Step 6: 冒烟 `--help`**

Run: `node apps/cli/dist/index.js --help`
Expected: commander 输出，含 `doctor` 子命令。

- [ ] **Step 7: 最终提交**

```bash
git add -A
git commit -m "chore: verify full build/test/typecheck green for Plan 1 foundation"
```

---

## Done 定义（Plan 1）

- `pnpm build` / `pnpm test` / `pnpm typecheck` 全绿。
- `node apps/cli/dist/index.js doctor` 正确打印 OS / 包管理器 / provider / riskMax。
- 四个包（shared/dsl/config/cli）均有单测并通过。
- DSL 能 parse 合法 Plan、拒绝非法 step/risk —— 为 Plan 2（policy/executor/core 消费 Plan）打好类型与校验基础。

## 与后续 Plan 的衔接

- **Plan 2** 会新增 `policy` / `executor-base` / `executor-linux` / `executor-windows` / `verifier` / `audit` / `core`，并给 cli 加 `plan(从 JSON)` / `apply` / `run` 子命令，消费本计划的 `@opsforge/dsl` 与 `@opsforge/shared`，`HostFacts` 检测会复用并扩展本计划 cli 的 `detect.ts`。
- **Plan 3/4** 在此之上接入多 provider planner（`@opsforge/config` 的 provider 解析已就位）与 Ink TUI。
