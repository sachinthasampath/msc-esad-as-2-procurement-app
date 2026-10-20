import type { ApprovalPolicy } from "../approval/approval-strategy";
import { DomainError } from "../errors";
import type { Requisition } from "../models/requisition";
import type { ManagementLevel } from "../models/user";
import { requisitionStateFor } from "./requisition-state";

export { moveRequisition } from "./requisition-state";

export class RequisitionWorkflow {
  static submit(requisition: Requisition, policy: ApprovalPolicy, online: boolean): void {
    if (!online) {
      throw new DomainError("A requisition can only be submitted when the device is online");
    }
    requisitionStateFor(requisition.status).submit(requisition, policy);
  }

  static resolveHold(requisition: Requisition, policy: ApprovalPolicy): void {
    requisitionStateFor(requisition.status).resolveHold(requisition, policy);
  }

  static cancel(requisition: Requisition): void {
    requisitionStateFor(requisition.status).cancel(requisition);
  }

  static editReturned(requisition: Requisition): void {
    requisitionStateFor(requisition.status).edit(requisition);
  }

  static approve(requisition: Requisition, actor: ManagementLevel, policy: ApprovalPolicy): void {
    requisitionStateFor(requisition.status).approve(requisition, actor, policy);
  }

  static partialApprove(requisition: Requisition, actor: ManagementLevel, lineIds: string[], policy: ApprovalPolicy): void {
    requisitionStateFor(requisition.status).partialApprove(requisition, actor, lineIds, policy);
  }

  static decline(requisition: Requisition, actor: ManagementLevel, comment: string): void {
    requisitionStateFor(requisition.status).decline(requisition, actor, comment);
  }

  static returnToOriginator(requisition: Requisition, actor: ManagementLevel, comment: string): void {
    requisitionStateFor(requisition.status).returnToOriginator(requisition, actor, comment);
  }

  static refer(requisition: Requisition, actor: ManagementLevel, comment: string): void {
    requisitionStateFor(requisition.status).refer(requisition, actor, comment);
  }
}
