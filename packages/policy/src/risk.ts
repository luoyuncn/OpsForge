import type { Plan, RiskLevel, Step } from "@opsforge/dsl";

const RISK_ORDER: Record<RiskLevel, number> = {
  L0: 0,
  L1: 1,
  L2: 2,
  L3: 3,
};

export interface ClassifiedRisk {
  risk: RiskLevel;
  reasons: string[];
}

export const riskExceeds = (risk: RiskLevel, max: RiskLevel): boolean => RISK_ORDER[risk] > RISK_ORDER[max];

export const maxRisk = (levels: RiskLevel[]): RiskLevel =>
  levels.reduce((highest, level) => (riskExceeds(level, highest) ? level : highest), "L0" as RiskLevel);

export const classifyStepRisk = (step: Step): ClassifiedRisk => {
  if (step.type === "service-status") return { risk: "L0", reasons: ["service status is read-only"] };
  if (step.type === "shell") return { risk: "L3", reasons: ["shell escape hatch requires strongest gate"] };
  if (step.type === "file-write" || step.type === "file-template") {
    return { risk: "L2", reasons: [`${step.type} changes local files`] };
  }
  return { risk: "L1", reasons: [`${step.type} changes ordinary local state`] };
};

export const classifyPlanRisk = (plan: Plan): ClassifiedRisk => {
  const stepClassifications = plan.steps.map(classifyStepRisk);
  const stepRisk = maxRisk(stepClassifications.map((item) => item.risk));
  const risk = maxRisk([plan.risk, stepRisk]);
  return {
    risk,
    reasons: stepClassifications.flatMap((item) => item.reasons),
  };
};
