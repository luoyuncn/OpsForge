import { readFileSync } from "node:fs";
import { Command } from "commander";
import { defaultConfigPath } from "@opsforge/config";
import { buildAuditCommand } from "./commands/audit";
import { buildApplyCommand, formatApplyResult, parseRiskMax } from "./commands/apply";
import { buildConfigCommand } from "./commands/config";
import { buildDoctorReport, formatDoctorReport } from "./commands/doctor";
import { buildPlanCommand } from "./commands/plan";
import { buildRollbackCommand } from "./commands/rollback";
import { buildRunCommand } from "./commands/run";
import { buildVerifyCommand } from "./commands/verify";
import { systemWhich } from "./which";

const readOptionalConfigFile = (): string | null => {
  try {
    return readFileSync(defaultConfigPath(), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};

const program = new Command();

program.name("opsforge").description("OpsForge — 本机优先的安全运维 Agent").version("0.0.0");

program
  .command("doctor")
  .description("自检：OS、包管理器、provider 配置")
  .action(() => {
    const report = buildDoctorReport({
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
  .action(async (planJson: string, options: { dryRun: boolean; yes: boolean; json: boolean; riskMax: string; allowShell: boolean }) => {
    const apply = buildApplyCommand();
    const result = await apply(planJson, {
      dryRun: options.dryRun,
      yes: options.yes,
      json: options.json,
      riskMax: parseRiskMax(options.riskMax),
      allowShell: options.allowShell,
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

if (process.argv.slice(2).length === 0) {
  console.log(
    "OpsForge — 交互式 TUI 将在后续版本提供。\n" +
      "当前可用：`opsforge doctor`。运行 `opsforge --help` 查看全部子命令。",
  );
  process.exit(0);
}

program.parse(process.argv);
