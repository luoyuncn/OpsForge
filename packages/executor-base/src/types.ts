import type { OsFamily, Step } from "@opsforge/dsl";

export interface HostFacts {
  osFamily: OsFamily;
  distro?: string;
  version?: string;
  arch: string;
  isElevated: boolean;
  packageManagers: string[];
}

export interface CompiledCommand {
  argv: string[] | string;
  shell: "bash" | "powershell";
  needsElevation: boolean;
  describe: string;
}

export interface RawCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface StepResult {
  step: Step;
  command: CompiledCommand;
  stdout: string;
  stderr: string;
  exitCode: number;
  startedAt: string;
  endedAt: string;
  truncated: boolean;
}

export type CommandRunner = (command: CompiledCommand) => Promise<RawCommandResult>;

export interface RunCompiledCommandOptions {
  maxOutputBytes?: number;
}

export interface Executor {
  osFamily: OsFamily;
  detect(): Promise<HostFacts>;
  compile(step: Step, facts: HostFacts): CompiledCommand;
  run(step: Step, command: CompiledCommand, runner: CommandRunner, opts?: RunCompiledCommandOptions): Promise<StepResult>;
}
