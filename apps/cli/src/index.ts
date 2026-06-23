import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { Command } from "commander";
import { defaultConfigPath } from "@opsforge/config";
import { createTuiStatus, formatTuiSnapshot, runTui as launchTui, type TuiActionHandler, type TuiStatus } from "@opsforge/tui";
import { buildAuditCommand } from "./commands/audit";
import { buildApplyCommand, formatApplyResult, parseRiskMax } from "./commands/apply";
import { buildConfigCommand } from "./commands/config";
import { buildDoctorReportAsync, formatDoctorReport } from "./commands/doctor";
import { buildPlanCommand } from "./commands/plan";
import { buildRollbackCommand } from "./commands/rollback";
import { buildRunCommand } from "./commands/run";
import { buildVerifyCommand } from "./commands/verify";
import { createTuiRuntimeActionHandler } from "./tui-runtime";
import { systemWhich } from "./which";
import type { DoctorReport } from "./commands/doctor";

const readOptionalConfigFile = (): string | null => {
  try {
    return readFileSync(defaultConfigPath(), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};

export const shouldLaunchTui = (args: string[], stdinIsTty: boolean | undefined, stdoutIsTty: boolean | undefined): boolean =>
  args.length === 0 && stdinIsTty === true && stdoutIsTty === true;

export const formatNoTtyFallback = (snapshot: string): string => [
  "OpsForge TUI requires an interactive terminal.",
  "Use `opsforge --help` for CLI commands in scripts or CI.",
  "",
  snapshot,
].join("\n");

export const buildProgram = (): Command => {
  const program = new Command();

  program.name("opsforge").description("OpsForge — 本机优先的安全运维 Agent").version("0.0.0");

  program
    .command("doctor")
    .description("自检：OS、包管理器、provider 配置")
    .action(async () => {
      const report = await buildDoctorReportAsync({
        platform: process.platform,
        which: systemWhich,
        env: process.env,
        fileContents: readOptionalConfigFile(),
      });
      console.log(formatDoctorReport(report));
    });

  program
    .command("apply")
    .argument("<planJson>", "Path to a JSON plan file")
    .description("执行一个已生成的 Plan JSON")
    .option("--dry-run", "只编译和检查，不执行", false)
    .option("-y, --yes", "批准 L2/L3 风险门禁", false)
    .option("--json", "输出 JSON", false)
    .option("--risk-max <level>", "允许的最高风险等级", "L3")
    .option("--allow-shell", "允许 shell 逃生舱步骤", false)
    .option("--auto-rollback", "验证或执行失败后自动回滚", false)
    .action(async (planJson: string, options: { dryRun: boolean; yes: boolean; json: boolean; riskMax: string; allowShell: boolean; autoRollback: boolean }) => {
      const apply = buildApplyCommand();
      const result = await apply(planJson, {
        dryRun: options.dryRun,
        yes: options.yes,
        json: options.json,
        riskMax: parseRiskMax(options.riskMax),
        allowShell: options.allowShell,
        autoRollback: options.autoRollback,
      });
      console.log(options.json ? JSON.stringify(result, null, 2) : formatApplyResult(result));
      if (!result.gate.allowed) process.exitCode = 1;
    });

  program.addCommand(buildAuditCommand());
  program.addCommand(buildConfigCommand());
  program.addCommand(buildPlanCommand());
  program.addCommand(buildRollbackCommand());
  program.addCommand(buildRunCommand());
  program.addCommand(buildVerifyCommand());

  return program;
};

export interface MainDeps {
  stdinIsTty?: boolean;
  stdoutIsTty?: boolean;
  buildDoctorReport?: () => Promise<DoctorReport>;
  runTui?: (status: TuiStatus, options?: { onAction?: TuiActionHandler }) => void;
  createActionHandler?: (status: TuiStatus, report: DoctorReport) => Promise<TuiActionHandler>;
  write?: (text: string) => void;
}

const buildDefaultDoctorReport = async (): Promise<DoctorReport> =>
  buildDoctorReportAsync({
    platform: process.platform,
    which: systemWhich,
    env: process.env,
    fileContents: readOptionalConfigFile(),
  });

export const main = async (argv = process.argv, deps: MainDeps = {}): Promise<void> => {
  const args = argv.slice(2);
  const write = deps.write ?? ((text: string) => console.log(text));

  if (args.length === 0) {
    const report = await (deps.buildDoctorReport ?? buildDefaultDoctorReport)();
    const status = createTuiStatus({
      facts: report.facts,
      provider: report.provider,
      sessionLabel: "local",
      auditLabel: "default",
    });

    if (shouldLaunchTui(args, deps.stdinIsTty ?? process.stdin.isTTY, deps.stdoutIsTty ?? process.stdout.isTTY)) {
      const onAction = await (deps.createActionHandler ?? (async () => createTuiRuntimeActionHandler({
        facts: report.facts,
        env: process.env,
        configPath: defaultConfigPath(),
      })))(status, report);
      (deps.runTui ?? launchTui)(status, { onAction });
      return;
    }

    write(formatNoTtyFallback(formatTuiSnapshot(status)));
    return;
  }

  await buildProgram().parseAsync(argv);
};

const isDirectRun = process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false;

if (isDirectRun) {
  await main();
}
