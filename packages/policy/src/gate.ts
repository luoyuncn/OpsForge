import type { RiskLevel } from "@opsforge/dsl";
import { riskExceeds } from "./risk";

export interface GateInput {
  risk: RiskLevel;
  riskMax: RiskLevel;
  yes: boolean;
  reason?: string;
}

export interface GateDecision {
  allowed: boolean;
  reason: string;
}

export const evaluateGate = (input: GateInput): GateDecision => {
  if (riskExceeds(input.risk, input.riskMax)) {
    return { allowed: false, reason: `risk ${input.risk} exceeds configured maximum ${input.riskMax}` };
  }

  if ((input.risk === "L2" || input.risk === "L3") && !input.yes) {
    return { allowed: false, reason: `risk ${input.risk} requires explicit --yes approval` };
  }

  return { allowed: true, reason: input.risk === "L3" ? input.reason ?? "explicit L3 approval" : "risk gate passed" };
};
