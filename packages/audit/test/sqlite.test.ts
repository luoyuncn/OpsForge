import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSqliteAuditStore, resolveOpsForgePaths } from "../src/index";

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
