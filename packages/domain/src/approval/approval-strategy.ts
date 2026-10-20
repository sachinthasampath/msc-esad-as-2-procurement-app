import { DomainError } from "../errors";

export interface ApprovalPolicy {
  autoApproveLimit: number;
  managerLimit: number;
}

export const DEFAULT_APPROVAL_POLICY: ApprovalPolicy = {
  autoApproveLimit: 10_000,
  managerLimit: 100_000,
};

export type ApprovalOutcome = "AUTO_APPROVED" | "WAITING_APPROVAL" | "REFERRED";

export interface ApprovalStrategy {
  readonly name: string;
  readonly outcome: ApprovalOutcome;
  applies(totalValue: number, policy: ApprovalPolicy): boolean;
}

export class AutoApproveStrategy implements ApprovalStrategy {
  readonly name = "AutoApprove";
  readonly outcome = "AUTO_APPROVED" as const;

  applies(totalValue: number, policy: ApprovalPolicy): boolean {
    return totalValue <= policy.autoApproveLimit;
  }
}

export class ManagerApprovalStrategy implements ApprovalStrategy {
  readonly name = "ManagerApproval";
  readonly outcome = "WAITING_APPROVAL" as const;

  applies(totalValue: number, policy: ApprovalPolicy): boolean {
    return totalValue > policy.autoApproveLimit && totalValue <= policy.managerLimit;
  }
}

export class SeniorReferralStrategy implements ApprovalStrategy {
  readonly name = "SeniorReferral";
  readonly outcome = "REFERRED" as const;

  applies(totalValue: number, policy: ApprovalPolicy): boolean {
    return totalValue > policy.managerLimit;
  }
}

export const approvalStrategies: ApprovalStrategy[] = [
  new AutoApproveStrategy(),
  new ManagerApprovalStrategy(),
  new SeniorReferralStrategy(),
];

export function selectApprovalStrategy(totalValue: number, policy: ApprovalPolicy): ApprovalStrategy {
  const match = approvalStrategies.find((strategy) => strategy.applies(totalValue, policy));
  if (!match) {
    throw new DomainError("No approval strategy matches this requisition total");
  }
  return match;
}

export function assertValidPolicy(policy: ApprovalPolicy): void {
  if (policy.autoApproveLimit < 0 || policy.managerLimit < 0) {
    throw new DomainError("Approval limits cannot be negative");
  }
  if (policy.autoApproveLimit > policy.managerLimit) {
    throw new DomainError("The auto-approve limit cannot exceed the manager limit");
  }
}
