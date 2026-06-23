import { Command } from "commander";
import {
  createSqliteAuditStore,
  resolveOpsForgePaths,
  type AuditStore,
} from "@opsforge/audit";
import { loadConfig, type OpsForgeConfig } from "@opsforge/config";
import {
  executeRollbackPlan,
  parseRiskMax,
  type ApplyOptions,
  type ApplyResult,
  type ExecutePlanDeps,
} from "./apply";

export interface BuildRollbackCommandDeps extends ExecutePlanDeps {
  auditStore?: AuditStore;
  config?: OpsForgeConfig;
  write?: (text: string) => void;
}

const commandToText = (argv: string[] | string): string => (Array.isArray(argv) ? argv.join(" ") : argv);

const createStore = (deps: BuildRollbackCommandDeps): { store: AuditStore; shouldClose: boolean } => {
  if (deps.auditStore) return { store: deps.auditStore, shouldClose: false };
  return {
    store: createSqliteAuditStore(resolveOpsForgePaths(deps.config ?? loadConfig())),
    shouldClose: true,
  };
};

export const formatRollbackResult = (originalRunId: string, result: ApplyResult): string => [
  "OpsForge rollback",
  `  Original run:       ${originalRunId}`,
  `  Rollback run ID:    ${result.runId}`,
  `  Risk:               ${result.risk}`,
  `  Gate:               ${result.gate.allowed ? "allowed" : "denied"} (${result.gate.reason})`,
  `  Dry run: ${result.dryRun}`,
  `  Compiled commands:  ${result.commands.length}`,
  ...result.commands.map((command, index) => `    ${index + 1}. [${command.shell}] ${commandToText(command.argv)} — ${command.describe}`),
  `  Step results:       ${result.stepResults.length}`,
].join("\n");

export const buildRollbackCommand = (deps: BuildRollbackCommandDeps = {}): Command => {
  const write = deps.write ?? ((text: string) => console.log(text));
  const command = new Command("rollback");

  command
    .description("回滚一次已审计的 run")
    .argument("<runId>", "Run ID to roll back")
    .option("--dry-run", "只生成、编译和检查回滚步骤，不执行", false)
    .option("-y, --yes", "批准 L2/L3 风险门禁", false)
    .option("--json", "输出 JSON", false)
    .option("--risk-max <level>", "允许的最高风险等级", "L3")
    .option("--allow-shell", "允许 shell 逃生舱步骤", false)
    .action(async (runId: string, options: { dryRun: boolean; yes: boolean; json: boolean; riskMax: string; allowShell: boolean }) => {
      const { store, shouldClose } = createStore(deps);
      try {
        const detail = store.showRun(runId);
        if (!detail?.plan) {
          write(options.json ? JSON.stringify({ error: `Rollback plan not found for run: ${runId}` }, null, 2) : `Rollback plan not found for run: ${runId}`);
          process.exitCode = 1;
          return;
        }

        const applyOptions: ApplyOptions = {
          dryRun: options.dryRun,
          yes: options.yes,
          json: options.json,
          riskMax: parseRiskMax(options.riskMax),
          allowShell: options.allowShell,
        };
        const result = await executeRollbackPlan(detail.plan, runId, applyOptions, { ...deps, auditStore: store });
        const payload = { originalRunId: runId, result };
        write(options.json ? JSON.stringify(payload, null, 2) : formatRollbackResult(runId, result));
        if (!result.gate.allowed) process.exitCode = 1;
      } finally {
        if (shouldClose) store.close();
      }
    });

  return command;
};
