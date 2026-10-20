import type { ApprovalPolicy } from "../approval/approval-strategy";
import { DomainError } from "../errors";
import { Requisition } from "../models/requisition";
import type { RequisitionStatus } from "../models/statuses";
import type { ManagementLevel } from "../models/user";

const allowed: Record<RequisitionStatus, RequisitionStatus[]> = {
  DRAFT: ["ON_HOLD", "WAITING_APPROVAL", "REFERRED", "APPROVED", "CANCELLED"],
  ON_HOLD: ["WAITING_APPROVAL", "REFERRED", "APPROVED", "CANCELLED"],
  WAITING_APPROVAL: ["APPROVED", "PARTIALLY_APPROVED", "DECLINED", "RETURNED", "REFERRED", "CANCELLED"],
  REFERRED: ["APPROVED", "PARTIALLY_APPROVED", "DECLINED", "RETURNED"],
  RETURNED: ["DRAFT"],
  APPROVED: [],
  PARTIALLY_APPROVED: [],
  DECLINED: [],
  CANCELLED: [],
};

export function moveRequisition(requisition: Requisition, next: RequisitionStatus): void {
  if (!allowed[requisition.status].includes(next)) {
    throw new DomainError(`Cannot move a requisition from ${requisition.status} to ${next}`);
  }
  requisition.status = next;
}

function routePriced(requisition: Requisition, policy: ApprovalPolicy): void {
  if (requisition.lines.length === 0) {
    throw new DomainError("Add at least one line before submitting");
  }
  if (requisition.hasUnpriced()) {
    moveRequisition(requisition, "ON_HOLD");
    return;
  }
  const strategy = requisition.assessApprovalPath(policy);
  if (strategy.outcome === "AUTO_APPROVED") {
    requisition.lines.forEach((line) => {
      line.approved = true;
    });
    moveRequisition(requisition, "APPROVED");
    return;
  }
  if (strategy.outcome === "WAITING_APPROVAL") {
    moveRequisition(requisition, "WAITING_APPROVAL");
    return;
  }
  moveRequisition(requisition, "REFERRED");
}

export class RequisitionWorkflow {
  static submit(requisition: Requisition, policy: ApprovalPolicy, online: boolean): void {
    if (!online) {
      throw new DomainError("A requisition can only be submitted when the device is online");
    }
    if (requisition.status !== "DRAFT" && requisition.status !== "ON_HOLD") {
      throw new DomainError(`Cannot submit a requisition that is ${requisition.status}`);
    }
    requisition.submittedDate = new Date();
    routePriced(requisition, policy);
  }

  static resolveHold(requisition: Requisition, policy: ApprovalPolicy): void {
    if (requisition.status !== "ON_HOLD") {
      throw new DomainError("Only a held requisition can be released by pricing");
    }
    routePriced(requisition, policy);
  }

  static cancel(requisition: Requisition): void {
    moveRequisition(requisition, "CANCELLED");
  }

  static editReturned(requisition: Requisition): void {
    if (requisition.status === "RETURNED") {
      moveRequisition(requisition, "DRAFT");
    }
    if (requisition.status !== "DRAFT") {
      throw new DomainError("Only a draft or a returned requisition can be edited");
    }
  }

  static approve(requisition: Requisition, actor: ManagementLevel, policy: ApprovalPolicy): void {
    assertDecider(requisition, actor);
    if (requisition.calculateTotalValue() > policy.managerLimit && actor === "OPERATIONAL") {
      moveRequisition(requisition, "REFERRED");
      return;
    }
    if (!requisition.validateBudget()) {
      throw new DomainError("The funding account cannot cover this requisition");
    }
    requisition.lines.forEach((line) => {
      line.approved = line.isPriceValid;
    });
    moveRequisition(requisition, "APPROVED");
  }

  static partialApprove(
    requisition: Requisition,
    actor: ManagementLevel,
    lineIds: string[],
    policy: ApprovalPolicy,
  ): void {
    assertDecider(requisition, actor);
    if (requisition.calculateTotalValue() > policy.managerLimit && actor === "OPERATIONAL") {
      throw new DomainError("This requisition must be referred to senior management");
    }
    const chosen = new Set(lineIds);
    const approved = requisition.lines.filter((line) => chosen.has(line.lineId));
    if (approved.length === 0) {
      throw new DomainError("Select at least one line to approve");
    }
    if (!approved.every((line) => line.isPriceValid)) {
      throw new DomainError("Unpriced lines cannot be approved");
    }
    const approvedValue = approved.reduce((sum, line) => sum + line.lineValue(), 0);
    if (approvedValue > requisition.allocatedBudget) {
      throw new DomainError("The funding account cannot cover the approved lines");
    }
    requisition.lines.forEach((line) => {
      line.approved = chosen.has(line.lineId);
    });
    if (approved.length === requisition.lines.length) {
      moveRequisition(requisition, "APPROVED");
      return;
    }
    moveRequisition(requisition, "PARTIALLY_APPROVED");
  }

  static decline(requisition: Requisition, actor: ManagementLevel, comment: string): void {
    assertDecider(requisition, actor);
    requisition.reviewComment = comment;
    moveRequisition(requisition, "DECLINED");
  }

  static returnToOriginator(requisition: Requisition, actor: ManagementLevel, comment: string): void {
    assertDecider(requisition, actor);
    if (!comment.trim()) {
      throw new DomainError("A returned requisition needs a comment for the site manager");
    }
    requisition.reviewComment = comment;
    moveRequisition(requisition, "RETURNED");
  }

  static refer(requisition: Requisition, actor: ManagementLevel, comment: string): void {
    if (requisition.status !== "WAITING_APPROVAL") {
      throw new DomainError("Only a waiting requisition can be referred");
    }
    if (actor !== "OPERATIONAL" && actor !== "SENIOR") {
      throw new DomainError("Only management can refer a requisition");
    }
    requisition.reviewComment = comment;
    moveRequisition(requisition, "REFERRED");
  }
}

function assertDecider(requisition: Requisition, actor: ManagementLevel): void {
  if (requisition.status !== "WAITING_APPROVAL" && requisition.status !== "REFERRED") {
    throw new DomainError(`Cannot decide a requisition that is ${requisition.status}`);
  }
  if (requisition.status === "REFERRED" && actor !== "SENIOR") {
    throw new DomainError("Only senior management can decide a referred requisition");
  }
}
