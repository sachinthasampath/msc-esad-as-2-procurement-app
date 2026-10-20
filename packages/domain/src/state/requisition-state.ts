import type { ApprovalPolicy } from "../approval/approval-strategy";
import { DomainError } from "../errors";
import type { Requisition } from "../models/requisition";
import type { RequisitionStatus } from "../models/statuses";
import type { ManagementLevel } from "../models/user";
import { domainEvents } from "../observer/domain-events";
import { routePriced } from "./route-priced";

export interface RequisitionState {
  readonly status: RequisitionStatus;
  canMoveTo(next: RequisitionStatus): boolean;
  submit(requisition: Requisition, policy: ApprovalPolicy): void;
  resolveHold(requisition: Requisition, policy: ApprovalPolicy): void;
  cancel(requisition: Requisition): void;
  edit(requisition: Requisition): void;
  approve(requisition: Requisition, actor: ManagementLevel, policy: ApprovalPolicy): void;
  partialApprove(requisition: Requisition, actor: ManagementLevel, lineIds: string[], policy: ApprovalPolicy): void;
  decline(requisition: Requisition, actor: ManagementLevel, comment: string): void;
  returnToOriginator(requisition: Requisition, actor: ManagementLevel, comment: string): void;
  refer(requisition: Requisition, actor: ManagementLevel, comment: string): void;
}

export function moveRequisition(requisition: Requisition, next: RequisitionStatus): void {
  const state = requisitionStateFor(requisition.status);
  if (!state.canMoveTo(next)) {
    throw new DomainError(`Cannot move a requisition from ${requisition.status} to ${next}`);
  }
  requisition.status = next;
}

abstract class BaseRequisitionState implements RequisitionState {
  abstract readonly status: RequisitionStatus;
  protected abstract readonly next: RequisitionStatus[];

  canMoveTo(next: RequisitionStatus): boolean {
    return this.next.includes(next);
  }

  submit(_requisition: Requisition, _policy: ApprovalPolicy): void {
    throw new DomainError(`Cannot submit a requisition that is ${this.status}`);
  }

  resolveHold(_requisition: Requisition, _policy: ApprovalPolicy): void {
    throw new DomainError("Only a held requisition can be released by pricing");
  }

  cancel(requisition: Requisition): void {
    moveRequisition(requisition, "CANCELLED");
  }

  edit(_requisition: Requisition): void {
    throw new DomainError("Only a draft or a returned requisition can be edited");
  }

  approve(requisition: Requisition, _actor: ManagementLevel, _policy: ApprovalPolicy): void {
    throw new DomainError(`Cannot decide a requisition that is ${requisition.status}`);
  }

  partialApprove(requisition: Requisition, _actor: ManagementLevel, _lineIds: string[], _policy: ApprovalPolicy): void {
    throw new DomainError(`Cannot decide a requisition that is ${requisition.status}`);
  }

  decline(requisition: Requisition, _actor: ManagementLevel, _comment: string): void {
    throw new DomainError(`Cannot decide a requisition that is ${requisition.status}`);
  }

  returnToOriginator(requisition: Requisition, _actor: ManagementLevel, _comment: string): void {
    throw new DomainError(`Cannot decide a requisition that is ${requisition.status}`);
  }

  refer(_requisition: Requisition, _actor: ManagementLevel, _comment: string): void {
    throw new DomainError("Only a waiting requisition can be referred");
  }
}

abstract class SubmittableState extends BaseRequisitionState {
  submit(requisition: Requisition, policy: ApprovalPolicy): void {
    requisition.submittedDate = new Date();
    routePriced(requisition, policy);
  }
}

class DraftState extends SubmittableState {
  readonly status = "DRAFT" as const;
  protected readonly next: RequisitionStatus[] = ["ON_HOLD", "WAITING_APPROVAL", "REFERRED", "APPROVED", "CANCELLED"];

  edit(_requisition: Requisition): void {}
}

class OnHoldState extends SubmittableState {
  readonly status = "ON_HOLD" as const;
  protected readonly next: RequisitionStatus[] = ["WAITING_APPROVAL", "REFERRED", "APPROVED", "CANCELLED"];

  resolveHold(requisition: Requisition, policy: ApprovalPolicy): void {
    routePriced(requisition, policy);
  }
}

abstract class DecidingState extends BaseRequisitionState {
  protected assertDecider(actor: ManagementLevel): void {
    if (this.status === "REFERRED" && actor !== "SENIOR") {
      throw new DomainError("Only senior management can decide a referred requisition");
    }
  }

  approve(requisition: Requisition, actor: ManagementLevel, policy: ApprovalPolicy): void {
    this.assertDecider(actor);
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

  partialApprove(requisition: Requisition, actor: ManagementLevel, lineIds: string[], policy: ApprovalPolicy): void {
    this.assertDecider(actor);
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

  decline(requisition: Requisition, actor: ManagementLevel, comment: string): void {
    this.assertDecider(actor);
    requisition.reviewComment = comment;
    moveRequisition(requisition, "DECLINED");
  }

  returnToOriginator(requisition: Requisition, actor: ManagementLevel, comment: string): void {
    this.assertDecider(actor);
    if (!comment.trim()) {
      throw new DomainError("A returned requisition needs a comment for the site manager");
    }
    requisition.reviewComment = comment;
    moveRequisition(requisition, "RETURNED");
    domainEvents.publish({
      type: "REQUISITION_RETURNED",
      requisitionId: requisition.requisitionId,
      originatorId: requisition.createdBy,
      comment,
    });
  }
}

class WaitingApprovalState extends DecidingState {
  readonly status = "WAITING_APPROVAL" as const;
  protected readonly next: RequisitionStatus[] = ["APPROVED", "PARTIALLY_APPROVED", "DECLINED", "RETURNED", "REFERRED", "CANCELLED"];

  refer(requisition: Requisition, actor: ManagementLevel, comment: string): void {
    if (actor !== "OPERATIONAL" && actor !== "SENIOR") {
      throw new DomainError("Only management can refer a requisition");
    }
    requisition.reviewComment = comment;
    moveRequisition(requisition, "REFERRED");
  }
}

class ReferredState extends DecidingState {
  readonly status = "REFERRED" as const;
  protected readonly next: RequisitionStatus[] = ["APPROVED", "PARTIALLY_APPROVED", "DECLINED", "RETURNED"];
}

class ReturnedState extends BaseRequisitionState {
  readonly status = "RETURNED" as const;
  protected readonly next: RequisitionStatus[] = ["DRAFT"];

  edit(requisition: Requisition): void {
    moveRequisition(requisition, "DRAFT");
  }
}

class ApprovedState extends BaseRequisitionState {
  readonly status = "APPROVED" as const;
  protected readonly next: RequisitionStatus[] = [];
}

class PartiallyApprovedState extends BaseRequisitionState {
  readonly status = "PARTIALLY_APPROVED" as const;
  protected readonly next: RequisitionStatus[] = [];
}

class DeclinedState extends BaseRequisitionState {
  readonly status = "DECLINED" as const;
  protected readonly next: RequisitionStatus[] = [];
}

class CancelledState extends BaseRequisitionState {
  readonly status = "CANCELLED" as const;
  protected readonly next: RequisitionStatus[] = [];
}

const states: Record<RequisitionStatus, RequisitionState> = {
  DRAFT: new DraftState(),
  ON_HOLD: new OnHoldState(),
  WAITING_APPROVAL: new WaitingApprovalState(),
  REFERRED: new ReferredState(),
  RETURNED: new ReturnedState(),
  APPROVED: new ApprovedState(),
  PARTIALLY_APPROVED: new PartiallyApprovedState(),
  DECLINED: new DeclinedState(),
  CANCELLED: new CancelledState(),
};

export function requisitionStateFor(status: RequisitionStatus): RequisitionState {
  return states[status];
}
