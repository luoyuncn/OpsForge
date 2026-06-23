export const createRunId = (planId: string, now = new Date()): string =>
  `run_${planId}_${now.getTime().toString(36)}`;
