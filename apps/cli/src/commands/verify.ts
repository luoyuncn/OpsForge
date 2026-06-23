import { Command } from "commander";
import { createSqliteAuditStore, resolveOpsForgePaths, type AuditStore } from "@opsforge/audit";
import { loadConfig, type OpsForgeConfig } from "@opsforge/config";
import { verifyStoredPlan, type VerifyStoredPlanInput, type VerifyStoredPlanResult } from "@opsforge/core";
import { createDefaultVerifyDeps } from "./apply";

export interface BuildVerifyCommandDeps {
  auditStore?: AuditStore;
  config?: OpsForgeConfig;
  verifyDeps?: VerifyStoredPlanInput["verifyDeps"];
  write?: (text: string) => void;
}

const createStore = (deps: BuildVerifyCommandDeps): { store: AuditStore; shouldClose: boolean } => {
  if (deps.auditStore) return { store: deps.auditStore, shouldClose: false };
  return {
    store: createSqliteAuditStore(resolveOpsForgePaths(deps.config ?? loadConfig())),
    shouldClose: true,
  };
};

export const formatVerifyResult = (result: VerifyStoredPlanResult): string => [
  "OpsForge verify",
  `  Original run:       ${result.originalRunId}`,
  `  Verifications:      ${result.verificationResults.length}`,
  ...result.verificationResults.map((verification, index) =>
    `    ${index + 1}. ${verification.ok ? "ok" : "failed"} ${verification.message}`,
  ),
].join("\n");

export const buildVerifyCommand = (deps: BuildVerifyCommandDeps = {}): Command => {
  const write = deps.write ?? ((text: string) => console.log(text));
  const command = new Command("verify");

  command
    .description("重跑一次已审计 run 的验证步骤")
    .argument("<runId>", "Run ID to verify")
    .option("--json", "输出 JSON", false)
    .action(async (runId: string, options: { json: boolean }) => {
      const { store, shouldClose } = createStore(deps);
      try {
        const detail = store.showRun(runId);
        if (!detail?.plan) {
          write(
            options.json
              ? JSON.stringify({ error: `Verification plan not found for run: ${runId}` }, null, 2)
              : `Verification plan not found for run: ${runId}`,
          );
          process.exitCode = 1;
          return;
        }

        const result = await verifyStoredPlan({
          originalRunId: runId,
          plan: detail.plan,
          audit: store,
          verifyDeps: deps.verifyDeps ?? createDefaultVerifyDeps(),
        });
        write(options.json ? JSON.stringify(result, null, 2) : formatVerifyResult(result));
        if (result.verificationResults.some((verification) => !verification.ok)) process.exitCode = 1;
      } finally {
        if (shouldClose) store.close();
      }
    });

  return command;
};
