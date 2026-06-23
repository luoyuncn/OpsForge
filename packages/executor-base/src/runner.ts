import { truncateOutput } from "@opsforge/shared";
import type { CommandRunner, CompiledCommand, RunCompiledCommandOptions, StepResult } from "./types";
import type { Step } from "@opsforge/dsl";

const splitTruncatedOutput = (stdout: string, stderr: string, maxBytes: number) => {
  const combined = `${stdout}${stderr}`;
  const truncated = truncateOutput(combined, maxBytes);
  if (!truncated.truncated) {
    return { stdout, stderr, truncated: false };
  }

  const stdoutLimit = Math.min(Buffer.byteLength(stdout, "utf8"), maxBytes);
  const nextStdout = truncateOutput(stdout, stdoutLimit).text;
  const remaining = Math.max(0, maxBytes - Buffer.byteLength(nextStdout, "utf8"));
  const nextStderr = truncateOutput(stderr, remaining).text;
  return { stdout: nextStdout, stderr: nextStderr, truncated: true };
};

export const runCompiledCommand = async (
  step: Step,
  command: CompiledCommand,
  runner: CommandRunner,
  opts: RunCompiledCommandOptions = {},
): Promise<StepResult> => {
  const startedAt = new Date().toISOString();
  const raw = await runner(command);
  const endedAt = new Date().toISOString();
  const output = splitTruncatedOutput(raw.stdout, raw.stderr, opts.maxOutputBytes ?? 64_000);

  return {
    step,
    command,
    stdout: output.stdout,
    stderr: output.stderr,
    exitCode: raw.exitCode,
    startedAt,
    endedAt,
    truncated: output.truncated,
  };
};
