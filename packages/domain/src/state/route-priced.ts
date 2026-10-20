import { selectApprovalStrategy, type ApprovalPolicy } from "../approval/approval-strategy";
import { DomainError } from "../errors";
import type { Requisition } from "../models/requisition";
import { moveRequisition } from "./requisition-state";

export function routePriced(requisition: Requisition, policy: ApprovalPolicy): void {
  if (requisition.lines.length === 0) {
    throw new DomainError("Add at least one line before submitting");
  }
  if (requisition.hasUnpriced()) {
    moveRequisition(requisition, "ON_HOLD");
    return;
  }
  selectApprovalStrategy(requisition.calculateTotalValue(), policy).apply(requisition);
}
