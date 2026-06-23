export interface PlanProviderRequest {
  prompt: string;
}

export interface PlanProvider {
  name: string;
  buildPlan(request: PlanProviderRequest): Promise<unknown>;
}
