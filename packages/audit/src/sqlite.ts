import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { Plan } from "@opsforge/dsl";
import type { AuditEvent, AuditRecorder } from "./events";
import type { AuditRunDetail, AuditRunSummary, AuditStepRun } from "./summary";

const require = createRequire(import.meta.url);

export interface CreateSqliteAuditStoreOptions {
  dbPath: string;
  artifactsDir: string;
}

export interface AuditStore extends AuditRecorder {
  listRuns(): AuditRunSummary[];
  showRun(runId: string): AuditRunDetail | undefined;
  recordStepArtifacts(runId: string, stepIndex: number, stdout: string, stderr: string): {
    stdoutPath: string;
    stderrPath: string;
  };
  close(): void;
}

interface RunRow {
  run_id: string;
  plan_id: string;
  risk: string | null;
  plan_json: string | null;
  status: string;
  started_at: string;
  ended_at: string | null;
  step_count: number;
}

interface EventRow {
  type: AuditEvent["type"];
  at: string;
  payload_json: string;
}

interface StepRow {
  step_index: number;
  step_json: string | null;
  exit_code: number | null;
  stdout_path: string | null;
  stderr_path: string | null;
}

interface SqliteStatement {
  run(...values: unknown[]): unknown;
  get(...values: unknown[]): unknown;
  all(...values: unknown[]): unknown[];
}

interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}

type DatabaseSyncConstructor = new (path: string) => SqliteDatabase;

const schema = `
CREATE TABLE IF NOT EXISTS plans (
  plan_id TEXT PRIMARY KEY,
  intent TEXT NOT NULL,
  risk TEXT NOT NULL,
  created_at TEXT NOT NULL,
  plan_json TEXT
);

CREATE TABLE IF NOT EXISTS runs (
  run_id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT
);

CREATE TABLE IF NOT EXISTS step_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  step_index INTEGER NOT NULL,
  step_json TEXT,
  exit_code INTEGER,
  stdout_path TEXT,
  stderr_path TEXT,
  UNIQUE(run_id, step_index)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT,
  plan_id TEXT,
  type TEXT NOT NULL,
  at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);
`;

const addPlanJsonMigration = "ALTER TABLE plans ADD COLUMN plan_json TEXT";

const eventPlanId = (event: AuditEvent): string | undefined => {
  if ("planId" in event.payload) return event.payload.planId;
  return undefined;
};

const eventRunId = (event: AuditEvent): string | undefined => {
  if ("runId" in event.payload) return event.payload.runId;
  return undefined;
};

const runStatusFromEvent = (event: AuditEvent): { status: string; endedAt?: string } | undefined => {
  if (event.type === "run.dry_run.finished") return { status: "dry_run", endedAt: event.at };
  if (event.type === "run.verified") return { status: "completed", endedAt: event.at };
  if (event.type === "run.rollback.started") return { status: "rolling_back" };
  if (event.type === "run.rollback.finished") return { status: "rolled_back", endedAt: event.at };
  return undefined;
};

const toRunSummary = (row: RunRow): AuditRunSummary => ({
  runId: row.run_id,
  planId: row.plan_id,
  risk: row.risk ?? "unknown",
  status: row.status,
  startedAt: row.started_at,
  endedAt: row.ended_at ?? undefined,
  stepCount: row.step_count,
});

const parseStoredPlan = (value: string | null): Plan | undefined => {
  if (value === null) return undefined;
  return JSON.parse(value) as Plan;
};

const toStepRun = (row: StepRow): AuditStepRun => ({
  stepIndex: row.step_index,
  step: row.step_json === null ? undefined : JSON.parse(row.step_json),
  exitCode: row.exit_code ?? undefined,
  stdoutPath: row.stdout_path ?? undefined,
  stderrPath: row.stderr_path ?? undefined,
});

export const createSqliteAuditStore = (options: CreateSqliteAuditStoreOptions): AuditStore => {
  mkdirSync(dirname(options.dbPath), { recursive: true });
  mkdirSync(options.artifactsDir, { recursive: true });

  const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: DatabaseSyncConstructor };
  const db = new DatabaseSync(options.dbPath);
  db.exec(schema);
  try {
    db.exec(addPlanJsonMigration);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes("duplicate column")) throw error;
  }

  const insertEvent = db.prepare(
    "INSERT INTO audit_events (run_id, plan_id, type, at, payload_json) VALUES (?, ?, ?, ?, ?)",
  );
  const insertPlan = db.prepare(
    "INSERT OR REPLACE INTO plans (plan_id, intent, risk, created_at, plan_json) VALUES (?, ?, ?, ?, ?)",
  );
  const insertRun = db.prepare(
    "INSERT OR REPLACE INTO runs (run_id, plan_id, status, started_at, ended_at) VALUES (?, ?, ?, ?, ?)",
  );
  const updateRunStatus = db.prepare("UPDATE runs SET status = ?, ended_at = COALESCE(?, ended_at) WHERE run_id = ?");
  const assignPendingPlanEvents = db.prepare(
    `UPDATE audit_events
     SET run_id = ?
     WHERE plan_id = ?
       AND run_id IS NULL
       AND id > COALESCE(
         (SELECT MAX(id) FROM audit_events WHERE plan_id = ? AND type = 'job.dispatched' AND run_id <> ?),
         0
       )`,
  );
  const upsertStepRun = db.prepare(
    `INSERT INTO step_runs (run_id, step_index, step_json, exit_code, stdout_path, stderr_path)
     VALUES (?, ?, ?, ?, NULL, NULL)
     ON CONFLICT(run_id, step_index)
     DO UPDATE SET step_json = excluded.step_json, exit_code = excluded.exit_code`,
  );
  const updateArtifacts = db.prepare(
    `INSERT INTO step_runs (run_id, step_index, step_json, exit_code, stdout_path, stderr_path)
     VALUES (?, ?, NULL, NULL, ?, ?)
     ON CONFLICT(run_id, step_index)
     DO UPDATE SET stdout_path = excluded.stdout_path, stderr_path = excluded.stderr_path`,
  );

  let closed = false;
  const recorded: AuditEvent[] = [];

  const assertOpen = () => {
    if (closed) throw new Error("Audit store is closed");
  };

  const store: AuditStore = {
    record: (event) => {
      assertOpen();
      const planId = eventPlanId(event);
      const runId = eventRunId(event);

      insertEvent.run(runId ?? null, planId ?? null, event.type, event.at, JSON.stringify(event.payload));
      recorded.push(event);

      if (event.type === "plan.created") {
        insertPlan.run(
          event.payload.planId,
          event.payload.intent,
          event.payload.risk,
          event.at,
          event.payload.plan ? JSON.stringify(event.payload.plan) : null,
        );
      }

      if (event.type === "job.dispatched") {
        insertRun.run(event.payload.runId, event.payload.planId, "running", event.at, null);
        assignPendingPlanEvents.run(event.payload.runId, event.payload.planId, event.payload.planId, event.payload.runId);
      }

      if (event.type === "run.step.finished") {
        const stepIndex = db.prepare("SELECT COUNT(*) AS count FROM step_runs WHERE run_id = ?").get(event.payload.runId) as {
          count: number;
        };
        upsertStepRun.run(
          event.payload.runId,
          stepIndex.count,
          JSON.stringify(event.payload.step),
          event.payload.exitCode,
        );
      }

      const status = runStatusFromEvent(event);
      if (status && runId) {
        updateRunStatus.run(status.status, status.endedAt ?? null, runId);
      }
    },
    events: () => {
      assertOpen();
      return recorded.slice();
    },
    listRuns: () => {
      assertOpen();
      return (db.prepare(
        `SELECT runs.run_id, runs.plan_id, plans.risk, NULL AS plan_json, runs.status, runs.started_at, runs.ended_at,
                COUNT(step_runs.id) AS step_count
         FROM runs
         LEFT JOIN plans ON plans.plan_id = runs.plan_id
         LEFT JOIN step_runs ON step_runs.run_id = runs.run_id
         GROUP BY runs.run_id, runs.plan_id, plans.risk, runs.status, runs.started_at, runs.ended_at
         ORDER BY runs.started_at DESC`,
      ).all() as unknown as RunRow[]).map(toRunSummary);
    },
    showRun: (runId) => {
      assertOpen();
      const row = db.prepare(
        `SELECT runs.run_id, runs.plan_id, plans.risk, plans.plan_json, runs.status, runs.started_at, runs.ended_at,
                COUNT(step_runs.id) AS step_count
         FROM runs
         LEFT JOIN plans ON plans.plan_id = runs.plan_id
         LEFT JOIN step_runs ON step_runs.run_id = runs.run_id
         WHERE runs.run_id = ?
         GROUP BY runs.run_id, runs.plan_id, plans.risk, runs.status, runs.started_at, runs.ended_at`,
      ).get(runId) as RunRow | undefined;
      if (!row) return undefined;

      const events = (db.prepare(
        "SELECT type, at, payload_json FROM audit_events WHERE run_id = ? ORDER BY id",
      ).all(runId) as unknown as EventRow[]).map((eventRow) => ({
        type: eventRow.type,
        at: eventRow.at,
        payload: JSON.parse(eventRow.payload_json),
      })) as AuditEvent[];
      const steps = (db.prepare(
        `SELECT step_index, step_json, exit_code, stdout_path, stderr_path
         FROM step_runs
         WHERE run_id = ?
         ORDER BY step_index`,
      ).all(runId) as unknown as StepRow[]).map(toStepRun);

      return { ...toRunSummary(row), plan: parseStoredPlan(row.plan_json), events, steps };
    },
    recordStepArtifacts: (runId, stepIndex, stdout, stderr) => {
      assertOpen();
      const runDir = join(options.artifactsDir, runId);
      mkdirSync(runDir, { recursive: true });
      const stdoutPath = join(runDir, `step-${stepIndex}-stdout.txt`);
      const stderrPath = join(runDir, `step-${stepIndex}-stderr.txt`);
      writeFileSync(stdoutPath, stdout, "utf8");
      writeFileSync(stderrPath, stderr, "utf8");
      updateArtifacts.run(runId, stepIndex, stdoutPath, stderrPath);
      return { stdoutPath, stderrPath };
    },
    close: () => {
      if (!closed) {
        db.close();
        closed = true;
      }
    },
  };

  return store;
};
