import { Command } from "commander";
import { buildDoctorReport, formatDoctorReport } from "./commands/doctor";
import { systemWhich } from "./which";

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
    });
    console.log(formatDoctorReport(report));
  });

if (process.argv.slice(2).length === 0) {
  console.log(
    "OpsForge — 交互式 TUI 将在后续版本提供。\n" +
      "当前可用：`opsforge doctor`。运行 `opsforge --help` 查看全部子命令。",
  );
  process.exit(0);
}

program.parse(process.argv);
