export interface GatePlan {
  code: boolean;
  provider: boolean;
}

export function planGates(changedFiles: string[]): GatePlan;
