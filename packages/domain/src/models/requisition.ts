import { selectApprovalStrategy, type ApprovalPolicy } from "../approval/approval-strategy";
import type { RequisitionStatus } from "./statuses";
import { RequisitionLine } from "./requisition-line";

export interface RequisitionProps {
  requisitionId: string;
  siteId: string;
  accountId: string;
  createdBy: string;
  status: RequisitionStatus;
  requiredDate: Date;
  submittedDate: Date | null;
  comments: string;
  reviewComment: string;
  allocatedBudget: number;
  lines: RequisitionLine[];
}

export class Requisition {
  requisitionId: string;
  siteId: string;
  accountId: string;
  createdBy: string;
  status: RequisitionStatus;
  requiredDate: Date;
  submittedDate: Date | null;
  comments: string;
  reviewComment: string;
  allocatedBudget: number;
  lines: RequisitionLine[];

  constructor(props: RequisitionProps) {
    this.requisitionId = props.requisitionId;
    this.siteId = props.siteId;
    this.accountId = props.accountId;
    this.createdBy = props.createdBy;
    this.status = props.status;
    this.requiredDate = props.requiredDate;
    this.submittedDate = props.submittedDate;
    this.comments = props.comments;
    this.reviewComment = props.reviewComment;
    this.allocatedBudget = props.allocatedBudget;
    this.lines = props.lines;
  }

  calculateTotalValue(): number {
    return this.lines.reduce((sum, line) => sum + line.lineValue(), 0);
  }

  hasUnpriced(): boolean {
    return this.lines.some((line) => !line.isPriceValid);
  }

  spansMultipleSuppliers(): boolean {
    return new Set(this.lines.map((line) => line.supplierId)).size > 1;
  }

  validateBudget(): boolean {
    return this.calculateTotalValue() <= this.allocatedBudget;
  }

  assessApprovalPath(policy: ApprovalPolicy) {
    return selectApprovalStrategy(this.calculateTotalValue(), policy);
  }
}
