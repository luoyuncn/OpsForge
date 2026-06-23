import { runCompiledCommand, type CommandRunner, type Executor, type HostFacts, type RunCompiledCommandOptions } from "@opsforge/executor-base";
import type { Step } from "@opsforge/dsl";
import { compileLinuxStep } from "./compile";

export const createLinuxExecutor = (): Executor => ({
  osFamily: "linux",
  detect: async (): Promise<HostFacts> => ({
    osFamily: "linux",
    arch: process.arch,
    isElevated: typeof process.getuid === "function" ? process.getuid() === 0 : false,
    packageManagers: [],
  }),
  compile: compileLinuxStep,
  run: (step: Step, command, runner: CommandRunner, opts?: RunCompiledCommandOptions) =>
    runCompiledCommand(step, command, runner, opts),
});
