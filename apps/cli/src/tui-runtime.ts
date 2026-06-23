import { createAuditRunReport, createSqliteAuditStore, resolveOpsForgePaths, type AuditStore } from "@opsforge/audit";
import { loadConfigFile, type OpsForgeConfig } from "@opsforge/config";
import type { Plan } from "@opsforge/dsl";
import type { HostFacts } from "@opsforge/executor-base";
import { createRuntimeActionController, type RuntimeEvent } from "@opsforge/pi-runtime";
import { buildPlanFromPrompt, type PlanProvider } from "@opsforge/planner";
import { runtimeEventToTuiEvent, type TuiActionHandler, type TuiEvent } from "@opsforge/tui";
import { executeParsedPlan, executeRollbackPlan, parseRiskMax, type ApplyResult, type ExecutePlanDeps } from "./commands/apply";
import { resolvePlanProvider, type PlanProviderResolver } from "./provider";

export interface CreateTuiRuntimeActionHandlerDeps extends ExecutePlanDeps {
  facts: HostFacts;
  provider?: PlanProvider;
  resolveProvider?: PlanProviderResolver;
  env?: Record<string, string | undefined>;
  configPath?: string;
  config?: OpsForgeConfig;
  now?: () => string;
  planId?: () => string;
  execute?: (plan: Plan) => Promise<ApplyResult>;
  rollback?: (runId: string) => Promise<ApplyResult>;
}

const runtimeEventsToTuiEvents = (events: readonly RuntimeEvent[]): TuiEvent[] =>
  events.flatMap((event) => {
    const tuiEvent = runtimeEventToTuiEvent(event);
    return tuiEvent ? [tuiEvent] : [];
  });

const errorToTuiEvent = (error: unknown): TuiEvent[] => [
  {
    type: "thinking.delta",
    text: `Runtime error: ${error instanceof Error ? error.message : String(error)}`,
  },
];

export const createTuiRuntimeActionHandler = async (
  deps: CreateTuiRuntimeActionHandlerDeps,
): Promise<TuiActionHandler> => {
  const env = deps.env ?? process.env;
  let config: OpsForgeConfig | undefined = deps.config;
  let provider: PlanProvider | undefined = deps.provider;

  const getConfig = async (): Promise<OpsForgeConfig> => {
    config ??= await loadConfigFile(deps.configPath, { env });
    return config;
  };

  const getProvider = async (): Promise<PlanProvider> => {
    provider ??= await (deps.resolveProvider ?? resolvePlanProvider)({
      provider: "configured",
      env,
      configPath: deps.configPath,
      config: await getConfig(),
    });
    return provider;
  };

  const getRollbackStore = async (): Promise<{ store: AuditStore; shouldClose: boolean }> => {
    if (deps.auditStore) return { store: deps.auditStore, shouldClose: false };
    const currentConfig = await getConfig();
    return { store: createSqliteAuditStore(resolveOpsForgePaths(currentConfig)), shouldClose: true };
  };

  const loadAuditHistory = async (): Promise<TuiEvent[]> => {
    const { store, shouldClose } = await getRollbackStore();
    try {
      return [{ type: "audit.history.loaded", history: { runs: store.listRuns() } }];
    } finally {
      if (shouldClose) store.close();
    }
  };

  const openAuditRun = async (runId: string): Promise<TuiEvent[]> => {
    const { store, shouldClose } = await getRollbackStore();
    try {
      const detail = store.showRun(runId);
      if (!detail) throw new Error(`Audit run not found: ${runId}`);
      return [{ type: "audit.run.loaded", report: createAuditRunReport(detail) }];
    } finally {
      if (shouldClose) store.close();
    }
  };

  const rollbackRun = async (runId: string): Promise<ApplyResult> => {
    if (deps.rollback) return deps.rollback(runId);
    const currentConfig = await getConfig();
    const { store, shouldClose } = await getRollbackStore();
    try {
      const detail = store.showRun(runId);
      if (!detail?.plan) throw new Error(`Rollback plan not found for run: ${runId}`);
      return executeRollbackPlan(
        detail.plan,
        runId,
        {
          dryRun: false,
          yes: true,
          json: false,
          riskMax: parseRiskMax(currentConfig.riskMax),
          allowShell: currentConfig.allowShell,
          autoRollback: false,
        },
        {
          ...deps,
          facts: deps.facts,
          config: currentConfig,
          auditStore: store,
        },
      );
    } finally {
      if (shouldClose) store.close();
    }
  };

  const controller = createRuntimeActionController({
    interactive: true,
    buildPlan: async (prompt) => buildPlanFromPrompt({
      prompt,
      provider: await getProvider(),
      now: deps.now,
      planId: deps.planId,
    }),
    executePlan: async (plan) => {
      if (deps.execute) return deps.execute(plan);
      const currentConfig = await getConfig();
      return executeParsedPlan(
        plan,
        {
          dryRun: false,
          yes: true,
          json: false,
          riskMax: parseRiskMax(currentConfig.riskMax),
          allowShell: currentConfig.allowShell,
          autoRollback: false,
        },
        {
          ...deps,
          facts: deps.facts,
          config: currentConfig,
        },
      );
    },
    rollbackRun,
  });

  return async (action) => {
    try {
      if (action.type === "audit.history.load") return loadAuditHistory();
      if (action.type === "audit.run.open") return openAuditRun(action.runId);
      return runtimeEventsToTuiEvents(await controller.handle(action));
    } catch (error) {
      return errorToTuiEvent(error);
    }
  };
};
