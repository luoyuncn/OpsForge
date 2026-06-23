export type TuiErrorPhase =
  | "input"
  | "runtime"
  | "planning"
  | "parse"
  | "validate"
  | "repair"
  | "execution"
  | "verification"
  | "audit";

export interface TuiStructuredError {
  phase: TuiErrorPhase;
  type: string;
  summary: string;
  details?: readonly string[];
  retryable: boolean;
  suggestedAction: string;
}

export const createRuntimeError = (message: string, retryable = true): TuiStructuredError => ({
  phase: "runtime",
  type: "RUNTIME_ERROR",
  summary: message,
  retryable,
  suggestedAction: "Review the runtime error, adjust the task/provider, then retry.",
});

export const createUnknownCommandError = (command: string): TuiStructuredError => ({
  phase: "input",
  type: "UNKNOWN_COMMAND",
  summary: `Unknown command: ${command}. Available commands: /provider, /history, /audit <n>.`,
  retryable: true,
  suggestedAction: "Use /help for local commands, or enter a natural-language ops task.",
});
