import { describe, expect, it } from "vitest";
import { createMemoryAuditRecorder } from "../src/index";

describe("createMemoryAuditRecorder", () => {
  it("records events in order", () => {
    const audit = createMemoryAuditRecorder();
    audit.record({ type: "plan.created", at: "t1", payload: { planId: "p1", intent: "install", risk: "L1" } });
    audit.record({ type: "job.dispatched", at: "t2", payload: { runId: "r1", planId: "p1" } });

    expect(audit.events().map((event) => event.type)).toEqual(["plan.created", "job.dispatched"]);
  });

  it("returns immutable snapshots", () => {
    const audit = createMemoryAuditRecorder();
    audit.record({ type: "plan.classified", at: "t1", payload: { planId: "p1", risk: "L2" } });
    const snapshot = audit.events();
    snapshot.length = 0;

    expect(audit.events()).toHaveLength(1);
  });
});
