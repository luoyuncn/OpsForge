import type { RuntimeEvent } from "@opsforge/pi-runtime";
import type { TuiEvent } from "./state";

export const runtimeEventToTuiEvent = (event: RuntimeEvent): TuiEvent | undefined => {
  switch (event.type) {
    case "runtime.thinking.delta":
      return { type: "thinking.delta", text: event.text };
    case "runtime.plan.ready":
      return { type: "plan.ready", plan: event.plan };
    case "runtime.execution.finished":
      return { type: "execution.finished", result: event.result };
    case "runtime.approval.requested":
      return { type: "approval.requested", approval: event.approval };
    case "runtime.rollback.requested":
      return { type: "rollback.requested", rollbackPrompt: event.rollbackPrompt };
    case "runtime.error":
      return { type: "runtime.error", message: event.message };
    case "runtime.session.started":
      return undefined;
  }
};
