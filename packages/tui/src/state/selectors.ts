import type { TuiState } from "../state";

export type StatusViewLevel = "ready" | "busy" | "warn" | "error";

export interface StatusViewModel {
  level: StatusViewLevel;
  title: string;
  summary: string;
  details: readonly string[];
  suggestedAction?: string;
}

const providerConfigured = (provider: string): boolean =>
  provider !== "未配置" && provider.toLowerCase() !== "unconfigured";

const truncate = (value: string, limit = 118): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 3)}...` : normalized;
};

export const selectStatusViewModel = (state: TuiState): StatusViewModel => {
  const error = state.status.error;
  if (error) {
    return {
      level: "error",
      title: `${error.phase[0]?.toUpperCase()}${error.phase.slice(1)} error: ${error.type}`,
      summary: truncate(error.summary),
      details: error.details ?? [],
      suggestedAction: error.suggestedAction,
    };
  }

  if (state.status.thinkingText) {
    return {
      level: "busy",
      title: "Thinking",
      summary: truncate(state.status.thinkingText),
      details: [],
    };
  }

  if (!providerConfigured(state.status.provider)) {
    return {
      level: "warn",
      title: "Provider required",
      summary: "Ready: configure a provider before running live tasks.",
      details: [],
      suggestedAction: "Run `opsforge config provider ...` in another shell, then restart the TUI.",
    };
  }

  if (state.status.planCard || state.status.timeline) {
    return {
      level: "ready",
      title: "Ready",
      summary: "Ready: review the current run state below.",
      details: [],
    };
  }

  return {
    level: "ready",
    title: "Ready",
    summary: "Ready: type a local operations task below.",
    details: [],
  };
};
