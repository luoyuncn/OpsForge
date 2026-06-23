import type { AuditEvent, AuditRecorder } from "./events";

export const createMemoryAuditRecorder = (): AuditRecorder => {
  const recorded: AuditEvent[] = [];
  return {
    record: (event) => {
      recorded.push(event);
    },
    events: () => recorded.slice(),
  };
};
