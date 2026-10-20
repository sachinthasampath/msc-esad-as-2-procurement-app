import { DomainError } from "../errors";
import { runThreeWayMatch } from "../matching/three-way-match";
import type { PurchaseOrder } from "./purchase-order";
import type { InvoiceStatus, PaymentStatus } from "./statuses";

export type MatchOutcome =
  | "FULL_MATCH"
  | "PARTIAL_DELIVERY"
  | "PRICE_MISMATCH"
  | "NOT_DELIVERED"
  | "BLOCKED";

export interface MatchResult {
  outcome: MatchOutcome;
  orderedQty: number;
  acceptedQty: number;
  invoiceQty: number;
  orderedAmount: number;
  acceptedAmount: number;
  invoiceAmount: number;
  message: string;
}

export class Invoice {
  payableAmount: number;

  constructor(
    public readonly invoiceId: string,
    public readonly poId: string,
    public readonly supplierId: string,
    public invoiceNumber: string,
    public invoiceDate: Date,
    public totalAmount: number,
    public invoiceQuantity: number,
    public itemDescription: string,
    public notes: string,
    public status: InvoiceStatus,
    public processedBy: string | null,
  ) {
    this.payableAmount = totalAmount;
  }

  performThreeWayMatch(po: PurchaseOrder): MatchResult {
    const orderedQty = po.orderedQuantity();
    const acceptedQty = po.acceptedQuantity();
    const orderedAmount = roundMoney(po.orderedAmount());
    const acceptedAmount = roundMoney(po.acceptedAmount());
    const invoiceAmount = roundMoney(this.totalAmount);
    const base = {
      orderedQty,
      acceptedQty,
      invoiceQty: this.invoiceQuantity,
      orderedAmount,
      acceptedAmount,
      invoiceAmount,
    };

    return runThreeWayMatch(base);
  }

  approve(po: PurchaseOrder, mode: "FULL" | "PARTIAL"): MatchResult {
    if (this.status !== "PENDING" && this.status !== "ON_HOLD") {
      throw new DomainError("This invoice cannot be approved");
    }
    const previous = this.status;
    this.status = "PENDING";
    const result = this.performThreeWayMatch(po);
    if (mode === "FULL" && result.outcome !== "FULL_MATCH") {
      this.status = previous;
      throw new DomainError(result.message);
    }
    if (mode === "PARTIAL" && result.outcome !== "PARTIAL_DELIVERY" && result.outcome !== "FULL_MATCH") {
      this.status = previous;
      throw new DomainError(result.message);
    }
    this.payableAmount = mode === "PARTIAL" ? result.acceptedAmount : result.invoiceAmount;
    this.status = "APPROVED";
    return result;
  }

  hold(): void {
    if (this.status !== "PENDING" && this.status !== "ON_HOLD") {
      throw new DomainError("Only a pending invoice can be placed on hold");
    }
    this.status = "ON_HOLD";
  }

  reject(): void {
    if (this.status === "PAID") throw new DomainError("A paid invoice cannot be rejected");
    this.status = "REJECTED";
  }

  releasePayment(processedBy: string, method: string, reference: string, paymentId: string): Payment {
    if (this.status !== "APPROVED") {
      throw new DomainError("Payments cannot be made if the invoice is on hold, rejected, or not yet approved");
    }
    this.status = "PAID";
    this.processedBy = processedBy;
    return new Payment(
      paymentId,
      this.invoiceId,
      this.poId,
      this.payableAmount,
      new Date(),
      method,
      reference,
      processedBy,
      "PAID",
      "",
    );
  }
}

export class CreditNote {
  constructor(
    public readonly creditNoteId: string,
    public readonly invoiceId: string,
    public adjustmentAmount: number,
    public reason: string,
  ) {}

  validateAgainstInvoice(invoice: Invoice): boolean {
    if (invoice.status === "PAID") {
      throw new DomainError("A credit note cannot be raised against a paid invoice");
    }
    if (this.adjustmentAmount <= 0) {
      throw new DomainError("A credit note amount must be greater than zero");
    }
    if (this.adjustmentAmount > invoice.totalAmount) {
      throw new DomainError("A credit note cannot exceed the invoice amount");
    }
    return true;
  }

  apply(invoice: Invoice): void {
    this.validateAgainstInvoice(invoice);
    invoice.totalAmount = roundMoney(invoice.totalAmount - this.adjustmentAmount);
    invoice.payableAmount = invoice.totalAmount;
    if (invoice.status === "ON_HOLD" || invoice.status === "REJECTED") {
      invoice.status = "PENDING";
    }
  }
}

export class Payment {
  constructor(
    public readonly paymentId: string,
    public readonly invoiceId: string,
    public readonly poId: string,
    public paidAmount: number,
    public paymentDate: Date,
    public paymentMethod: string,
    public paymentReference: string,
    public processedBy: string,
    public status: PaymentStatus,
    public remarks: string,
  ) {}
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
