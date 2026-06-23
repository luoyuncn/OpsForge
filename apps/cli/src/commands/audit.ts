import { Command } from "commander";
import {
  createSqliteAuditStore,
  resolveOpsForgePaths,
  type AuditRunDetail,
  type AuditRunSummary,
  type AuditStore,
} from "@opsforge/audit";
import { loadConfig, type OpsForgeConfig } from "@opsforge/config";

export interface BuildAuditDeps {
  auditStore?: AuditStore;
  config?: OpsForgeConfig;
  write?: (text: string) => void;
}

const createStore = (deps: BuildAuditDeps): { store: AuditStore; shouldClose: boolean } => {
  if (deps.auditStore) return { store: deps.auditStore, shouldClose: false };
  return {
    store: createSqliteAuditStore(resolveOpsForgePaths(deps.config ?? loadConfig())),
    shouldClose: true,
  };
};

const closeIfNeeded = (store: AuditStore, shouldClose: boolean): void => {
  if (shouldClose) store.close();
};

export const formatAuditList = (runs: AuditRunSummary[]): string => {
  if (runs.length === 0) return "No audit runs found";

  return [
    "Audit runs",
    ...runs.map((run) => {
      const ended = run.endedAt ? `  ended=${run.endedAt}` : "";
      return `${run.runId}  plan=${run.planId}  risk=${run.risk}  status=${run.status}  steps=${run.stepCount}  started=${run.startedAt}${ended}`;
    }),
  ].join("\n");
};

export const formatAuditShow = (run: AuditRunDetail | undefined): string => {
  if (!run) return "Audit run not found";

  const lines = [
    `Audit run ${run.runId}`,
    `  Plan:    ${run.planId}`,
    `  Risk:    ${run.risk}`,
    `  Status:  ${run.status}`,
    `  Started: ${run.startedAt}`,
    `  Ended:   ${run.endedAt ?? "-"}`,
    `  Steps:   ${run.stepCount}`,
    "Events",
    ...run.events.map((event, index) => `${index + 1}. ${event.at}  ${event.type}`),
  ];

  if (run.steps.length > 0) {
    lines.push("Artifacts");
    for (const step of run.steps) {
      lines.push(`  Step ${step.stepIndex}: exit=${step.exitCode ?? "-"}`);
      if (step.stdoutPath) lines.push(`    stdout: ${step.stdoutPath}`);
      if (step.stderrPath) lines.push(`    stderr: ${step.stderrPath}`);
    }
  }

  return lines.join("\n");
};

export const buildAuditCommand = (deps: BuildAuditDeps = {}): Command => {
  const write = deps.write ?? ((text: string) => console.log(text));
  const command = new Command("audit").description("查看本机审计历史");

  command
    .command("ls")
    .description("列出审计 run")
    .option("--json", "输出 JSON", false)
    .action((options: { json: boolean }) => {
      const { store, shouldClose } = createStore(deps);
      try {
        const runs = store.listRuns();
        write(options.json ? JSON.stringify(runs, null, 2) : formatAuditList(runs));
      } finally {
        closeIfNeeded(store, shouldClose);
      }
    });

  command
    .command("show")
    .argument("<runId>", "Run ID")
    .description("显示一个审计 run 的事件和 artifacts")
    .option("--json", "输出 JSON", false)
    .action((runId: string, options: { json: boolean }) => {
      const { store, shouldClose } = createStore(deps);
      try {
        const run = store.showRun(runId);
        write(options.json ? JSON.stringify(run ?? null, null, 2) : formatAuditShow(run));
        if (!run) process.exitCode = 1;
      } finally {
        closeIfNeeded(store, shouldClose);
      }
    });

  return command;
};
