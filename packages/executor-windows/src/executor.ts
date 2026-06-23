import { runCompiledCommand, type CommandRunner, type Executor, type HostFacts, type RunCompiledCommandOptions } from "@opsforge/executor-base";
import type { Step } from "@opsforge/dsl";
import { compileWindowsStep } from "./compile";

export const createWindowsExecutor = (): Executor => ({
  osFamily: "windows",
  detect: async (): Promise<HostFacts> => ({
    osFamily: "windows",
    arch: process.arch,
    isElevated: false,
    packageManagers: [],
  }),
  compile: compileWindowsStep,
  run: (step: Step, command, runner: CommandRunner, opts?: RunCompiledCommandOptions) =>
    runCompiledCommand(step, command, runner, opts),
});
