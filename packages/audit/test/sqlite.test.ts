import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Plan } from "@opsforge/dsl";
import { createSqliteAuditStore, resolveOpsForgePaths } from "../src/index";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (path: string) => {
  exec(sql: string): void;
  prepare(sql: string): { run(...values: unknown[]): unknown };
  close(): void;
} };

let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "opsforge-audit-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("createSqliteAuditStore", () => {
  it("persists the full plan for a run so rollback can load it later", () => {
    const store = createSqliteAuditStore({ dbPath: join(dir, "opsforge.db"), artifactsDir: join(dir, "artifacts") });
    const plan: Plan = {
      id: "p1",
      title: "Install nginx",
      intent: "install",
      risk: "L1",
      createdAt: "2026-06-23T00:00:00Z",
      prechecks: [],
      steps: [{ type: "package-install", name: "nginx" }],
      verifications: [],
      rollback: [{ type: "package-remove", name: "nginx" }],
      explanation: [],
    };

    try {
      store.record({
        type: "plan.created",
        at: "2026-06-23T00:00:00Z",
        payload: { planId: "p1", intent: "install", risk: "L1", plan },
      });
      store.record({ type: "job.dispatched", at: "2026-06-23T00:00:01Z", payload: { runId: "r1", planId: "p1" } });

      expect(store.showRun("r1")?.plan).toEqual(plan);
    } finally {
      store.close();
    }
  });

  it("persists plans, runs, step runs, and events", () => {
    const store = createSqliteAuditStore({ dbPath: join(dir, "opsforge.db"), artifactsDir: join(dir, "artifacts") });
    store.record({ type: "plan.created", at: "2026-06-23T00:00:00Z", payload: { planId: "p1", intent: "install", risk: "L1" } });
    store.record({ type: "job.dispatched", at: "2026-06-23T00:00:01Z", payload: { runId: "r1", planId: "p1" } });
    store.record({
      type: "run.step.finished",
      at: "2026-06-23T00:00:02Z",
      payload: { runId: "r1", step: { type: "package-install", name: "nginx" }, exitCode: 0 },
    });

    expect(store.listRuns()).toEqual([
      {
        runId: "r1",
        planId: "p1",
        risk: "L1",
        status: "running",
        startedAt: "2026-06-23T00:00:01Z",
        endedAt: undefined,
        stepCount: 1,
      },
    ]);
    expect(store.showRun("r1")?.events.map((event) => event.type)).toEqual([
      "plan.created",
      "job.dispatched",
      "run.step.finished",
    ]);

    store.close();
  });

  it("keeps repeated plan events scoped to the run that dispatched them", () => {
    const store = createSqliteAuditStore({ dbPath: join(dir, "opsforge.db"), artifactsDir: join(dir, "artifacts") });
    store.record({ type: "plan.created", at: "2026-06-23T00:00:00Z", payload: { planId: "p1", intent: "install", risk: "L1" } });
    store.record({ type: "job.dispatched", at: "2026-06-23T00:00:01Z", payload: { runId: "r1", planId: "p1" } });
    store.record({ type: "run.dry_run.finished", at: "2026-06-23T00:00:02Z", payload: { runId: "r1" } });

    store.record({ type: "plan.created", at: "2026-06-23T00:01:00Z", payload: { planId: "p1", intent: "install", risk: "L1" } });
    store.record({ type: "job.dispatched", at: "2026-06-23T00:01:01Z", payload: { runId: "r2", planId: "p1" } });
    store.record({ type: "run.dry_run.finished", at: "2026-06-23T00:01:02Z", payload: { runId: "r2" } });

    expect(store.showRun("r2")?.events.map((event) => event.at)).toEqual([
      "2026-06-23T00:01:00Z",
      "2026-06-23T00:01:01Z",
      "2026-06-23T00:01:02Z",
    ]);

    store.close();
  });

  it("does not attach legacy unscoped plan events to a later run", () => {
    const dbPath = join(dir, "opsforge.db");
    const artifactsDir = join(dir, "artifacts");
    const seedStore = createSqliteAuditStore({ dbPath, artifactsDir });
    seedStore.close();

    const db = new DatabaseSync(dbPath);
    db.prepare("INSERT INTO plans (plan_id, intent, risk, created_at) VALUES (?, ?, ?, ?)").run(
      "p1",
      "install",
      "L1",
      "2026-06-23T00:00:00Z",
    );
    db.prepare("INSERT INTO runs (run_id, plan_id, status, started_at, ended_at) VALUES (?, ?, ?, ?, ?)").run(
      "r1",
      "p1",
      "dry_run",
      "2026-06-23T00:00:01Z",
      "2026-06-23T00:00:02Z",
    );
    db.prepare("INSERT INTO audit_events (run_id, plan_id, type, at, payload_json) VALUES (?, ?, ?, ?, ?)").run(
      null,
      "p1",
      "plan.created",
      "2026-06-23T00:00:00Z",
      JSON.stringify({ planId: "p1", intent: "install", risk: "L1" }),
    );
    db.prepare("INSERT INTO audit_events (run_id, plan_id, type, at, payload_json) VALUES (?, ?, ?, ?, ?)").run(
      "r1",
      "p1",
      "job.dispatched",
      "2026-06-23T00:00:01Z",
      JSON.stringify({ runId: "r1", planId: "p1" }),
    );
    db.close();

    const store = createSqliteAuditStore({ dbPath, artifactsDir });
    store.record({ type: "plan.created", at: "2026-06-23T00:01:00Z", payload: { planId: "p1", intent: "install", risk: "L1" } });
    store.record({ type: "job.dispatched", at: "2026-06-23T00:01:01Z", payload: { runId: "r2", planId: "p1" } });
    store.record({ type: "run.dry_run.finished", at: "2026-06-23T00:01:02Z", payload: { runId: "r2" } });

    expect(store.showRun("r2")?.events.map((event) => event.at)).toEqual([
      "2026-06-23T00:01:00Z",
      "2026-06-23T00:01:01Z",
      "2026-06-23T00:01:02Z",
    ]);

    store.close();
  });

  it("returns only events recorded by the current store instance", () => {
    const dbPath = join(dir, "opsforge.db");
    const artifactsDir = join(dir, "artifacts");
    const firstStore = createSqliteAuditStore({ dbPath, artifactsDir });
    firstStore.record({ type: "plan.created", at: "2026-06-23T00:00:00Z", payload: { planId: "p1", intent: "install", risk: "L1" } });
    firstStore.record({ type: "job.dispatched", at: "2026-06-23T00:00:01Z", payload: { runId: "r1", planId: "p1" } });
    firstStore.close();

    const secondStore = createSqliteAuditStore({ dbPath, artifactsDir });
    secondStore.record({ type: "plan.created", at: "2026-06-23T00:01:00Z", payload: { planId: "p2", intent: "install", risk: "L1" } });

    expect(secondStore.events()).toEqual([
      { type: "plan.created", at: "2026-06-23T00:01:00Z", payload: { planId: "p2", intent: "install", risk: "L1" } },
    ]);
    expect(secondStore.listRuns().map((run) => run.runId)).toEqual(["r1"]);

    secondStore.close();
  });

  it("writes stdout and stderr artifacts for step results", async () => {
    const store = createSqliteAuditStore({ dbPath: join(dir, "opsforge.db"), artifactsDir: join(dir, "artifacts") });
    store.recordStepArtifacts("r1", 0, "hello", "warn");

    await expect(readFile(join(dir, "artifacts", "r1", "step-0-stdout.txt"), "utf8")).resolves.toBe("hello");
    await expect(readFile(join(dir, "artifacts", "r1", "step-0-stderr.txt"), "utf8")).resolves.toBe("warn");

    store.close();
  });
});

describe("resolveOpsForgePaths", () => {
  it("expands leading home directory markers", () => {
    const paths = resolveOpsForgePaths({ dbPath: "~/.opsforge/opsforge.db", artifactsDir: "~/.opsforge/artifacts" });

    expect(paths.dbPath).not.toContain("~");
    expect(paths.artifactsDir).not.toContain("~");
  });
});
