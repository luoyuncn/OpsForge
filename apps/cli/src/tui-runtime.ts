import { loadConfigFile, type OpsForgeConfig } from "@opsforge/config";
import type { Plan } from "@opsforge/dsl";
import type { HostFacts } from "@opsforge/executor-base";
import { createRuntimeActionController, type RuntimeEvent } from "@opsforge/pi-runtime";
import { buildPlanFromPrompt, type PlanProvider } from "@opsforge/planner";
import { runtimeEventToTuiEvent, type TuiActionHandler, type TuiEvent } from "@opsforge/tui";
import { executeParsedPlan, parseRiskMax, type ApplyResult, type ExecutePlanDeps } from "./commands/apply";
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
  });

  return async (action) => {
    try {
      return runtimeEventsToTuiEvents(await controller.handle(action));
    } catch (error) {
      return errorToTuiEvent(error);
    }
  };
};
