# OpsForge Plan 3 — Audit Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist OpsForge audit history to local SQLite and artifacts, then expose `opsforge audit ls` and `opsforge audit show <run_id>` for replayable local execution evidence.

**Architecture:** Keep `@opsforge/audit` as the storage boundary. Add a SQLite-backed recorder beside the existing memory recorder, plus artifact helpers for stdout/stderr dumps. Wire `opsforge apply` to persistent audit by default, while tests can still inject memory storage and fake paths.

**Tech Stack:** TypeScript, pnpm workspace, Turbo, tsup, vitest, zod, commander, Node 24 `node:sqlite`, Node fs/path.

**Spec Coverage:** `docs/superpowers/specs/2026-06-23-opsforge-local-ops-agent-design.md` §8.1 SQLite/artifacts, §8.2 append-only audit event model, §7.2 `opsforge audit ls/show`, §11 no-host-mutation tests.

**Branch:** `main` (explicit user instruction for this goal).

---

## File Structure

```text
packages/audit/
├─ package.json
├─ src/{index,events,memory,paths,sqlite,summary}.ts
└─ test/{audit,sqlite}.test.ts
apps/cli/
├─ src/commands/{apply,audit}.ts
├─ src/index.ts
└─ test/{apply,audit}.test.ts
docs/
└─ implementation-status.md
```

---

## Task 1: SQLite Audit Store

**Files:**
- Create: `packages/audit/src/paths.ts`, `packages/audit/src/sqlite.ts`, `packages/audit/src/summary.ts`
- Modify: `packages/audit/src/index.ts`, `packages/audit/src/events.ts`
- Test: `packages/audit/test/sqlite.test.ts`

- [ ] **Step 1: Write failing SQLite tests**

Create `packages/audit/test/sqlite.test.ts` with tests for:

```ts
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSqliteAuditStore } from "../src/index";

let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "opsforge-audit-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("createSqliteAuditStore", () => {
  it("persists plans, runs, step runs, and events", () => {
    const store = createSqliteAuditStore({ dbPath: join(dir, "opsforge.db"), artifactsDir: join(dir, "artifacts") });
    store.record({ type: "plan.created", at: "2026-06-23T00:00:00Z", payload: { planId: "p1", intent: "install", risk: "L1" } });
    store.record({ type: "job.dispatched", at: "2026-06-23T00:00:01Z", payload: { runId: "r1", planId: "p1" } });
    store.record({ type: "run.step.finished", at: "2026-06-23T00:00:02Z", payload: { runId: "r1", step: { type: "package-install", name: "nginx" }, exitCode: 0 } });

    expect(store.listRuns()).toEqual([{ runId: "r1", planId: "p1", risk: "L1", status: "running", startedAt: "2026-06-23T00:00:01Z", endedAt: undefined, stepCount: 1 }]);
    expect(store.showRun("r1")?.events.map((event) => event.type)).toEqual(["plan.created", "job.dispatched", "run.step.finished"]);
  });

  it("writes stdout and stderr artifacts for step results", async () => {
    const store = createSqliteAuditStore({ dbPath: join(dir, "opsforge.db"), artifactsDir: join(dir, "artifacts") });
    store.recordStepArtifacts("r1", 0, "hello", "warn");

    await expect(readFile(join(dir, "artifacts", "r1", "step-0-stdout.txt"), "utf8")).resolves.toBe("hello");
    await expect(readFile(join(dir, "artifacts", "r1", "step-0-stderr.txt"), "utf8")).resolves.toBe("warn");
  });
});
```

Run: `pnpm --filter @opsforge/audit test`
Expected: FAIL because `createSqliteAuditStore` does not exist.

- [ ] **Step 2: Implement SQLite schema and recorder**

Implement:
- `plans(plan_id TEXT PRIMARY KEY, intent TEXT, risk TEXT, created_at TEXT)`
- `runs(run_id TEXT PRIMARY KEY, plan_id TEXT, status TEXT, started_at TEXT, ended_at TEXT)`
- `step_runs(id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT, step_index INTEGER, step_json TEXT, exit_code INTEGER, stdout_path TEXT, stderr_path TEXT)`
- `audit_events(id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT, plan_id TEXT, type TEXT, at TEXT, payload_json TEXT)`

Export:
- `createSqliteAuditStore({ dbPath, artifactsDir })`
- `AuditStore` extends `AuditRecorder` with `listRuns()`, `showRun(runId)`, `recordStepArtifacts(runId, stepIndex, stdout, stderr)`, `close()`.
- `resolveOpsForgePaths(config)` to expand leading `~` using `os.homedir()`.
- Use Node 24 `node:sqlite` `DatabaseSync`. The original spec mentions `better-sqlite3`; this plan keeps the SQLite storage semantics but avoids a native ClangCL toolchain requirement observed on the current Windows development host.

- [ ] **Step 3: Verify and commit**

Run:
```bash
pnpm --filter @opsforge/audit test
pnpm --filter @opsforge/audit typecheck
pnpm --filter @opsforge/audit build
```

Commit:
```bash
git add packages/audit pnpm-lock.yaml
git commit -m "feat(audit): persist audit events to sqlite and artifacts"
```

---

## Task 2: Persist `apply` Runs

**Files:**
- Modify: `apps/cli/src/commands/apply.ts`
- Test: `apps/cli/test/apply.test.ts`

- [ ] **Step 1: Write failing apply persistence test**

Add a test that injects `auditStore` into `buildApplyCommand`, runs a dry-run plan, and asserts:
- `result.auditEvents.length > 0`
- the injected store receives events
- memory tests continue to avoid writing to user home.

Run: `pnpm --filter @opsforge/cli test`
Expected: FAIL because `buildApplyCommand` cannot accept an audit store.

- [ ] **Step 2: Implement audit store injection and default persistence**

Update `BuildApplyDeps`:

```ts
auditStore?: AuditStore;
config?: OpsForgeConfig;
```

Default behavior:
- `loadConfig()` provides `dbPath` and `artifactsDir`.
- `resolveOpsForgePaths(config)` expands paths.
- `createSqliteAuditStore(paths)` is used unless a test injects `auditStore`.
- After execution, write step stdout/stderr artifacts through `recordStepArtifacts`.
- Close the store when the command created it.

- [ ] **Step 3: Verify and commit**

Run:
```bash
pnpm --filter @opsforge/cli test
pnpm --filter @opsforge/cli typecheck
pnpm --filter @opsforge/cli build
```

Commit:
```bash
git add apps/cli pnpm-lock.yaml
git commit -m "feat(cli): persist apply audit history"
```

---

## Task 3: CLI `audit ls/show`

**Files:**
- Create: `apps/cli/src/commands/audit.ts`
- Modify: `apps/cli/src/index.ts`
- Test: `apps/cli/test/audit.test.ts`

- [ ] **Step 1: Write failing audit command tests**

Create tests for:

```ts
import { formatAuditList, formatAuditShow } from "../src/commands/audit";
```

Cases:
- empty run list prints `No audit runs found`.
- non-empty list includes `runId`, `planId`, `risk`, `status`, and step count.
- show output includes ordered event types and artifact paths when present.

Run: `pnpm --filter @opsforge/cli test`
Expected: FAIL because command module does not exist.

- [ ] **Step 2: Implement audit command**

Behavior:
- `opsforge audit ls`
- `opsforge audit show <runId>`
- flags: `--json`
- Default store uses config `dbPath`/`artifactsDir`.
- Human output is compact and stable for terminal use.

- [ ] **Step 3: Verify and commit**

Run:
```bash
pnpm --filter @opsforge/cli test
pnpm --filter @opsforge/cli typecheck
pnpm --filter @opsforge/cli build
```

Commit:
```bash
git add apps/cli pnpm-lock.yaml
git commit -m "feat(cli): add audit list and show commands"
```

---

## Task 4: Documentation, Alignment, Full Verification

**Files:**
- Modify: `docs/implementation-status.md`, `README.md`

- [ ] **Step 1: Update implementation status**

Mark §8 Audit as partially implemented with SQLite/artifacts now present. Keep gaps explicit:
- richer artifact reports
- rollback audit commands
- TUI timeline consumption
- retention/export

- [ ] **Step 2: Update README commands**

Add:
```bash
node apps/cli/dist/index.js audit ls
node apps/cli/dist/index.js audit show <run_id>
```

- [ ] **Step 3: Full verification**

Run:
```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
node apps/cli/dist/index.js apply examples/plan-install-nginx.local.json --dry-run
node apps/cli/dist/index.js audit ls
```

Expected: all commands pass; audit list shows the dry-run run.

- [ ] **Step 4: Commit and push**

```bash
git add README.md docs/implementation-status.md
git commit -m "docs: record Plan 3 audit persistence status"
git push origin main
```

---

## Done Definition

- `@opsforge/audit` persists append-only events in SQLite.
- stdout/stderr artifacts can be written under `artifacts/<run_id>/`.
- `opsforge apply` records audit history by default.
- `opsforge audit ls` lists persisted runs.
- `opsforge audit show <run_id>` shows persisted events.
- `pnpm build`, `pnpm test`, and `pnpm typecheck` pass.
- Docs state what Plan 3 implemented and what remains.

## Known Gaps After Plan 3

- SQLite tables are intentionally minimal and local-only.
- No retention/export command yet.
- No rollback command yet.
- TUI does not consume audit history yet.
