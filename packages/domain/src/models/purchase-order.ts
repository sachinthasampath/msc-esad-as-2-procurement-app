import { DomainError } from "../errors";
import type { DeliveryCondition, PurchaseOrderStatus } from "./statuses";

export class POLine {
  constructor(
    public readonly poLineId: string,
    public readonly itemId: string,
    public readonly requisitionLineId: string,
    public readonly description: string,
    public quantityOrdered: number,
    public cumulativeAcceptedQty: number,
    public unitPrice: number,
  ) {}

  getRemainingBalance(): number {
    return this.quantityOrdered - this.cumulativeAcceptedQty;
  }

  updateCumulativeTotal(receivedQty: number): void {
    if (receivedQty <= 0) {
      throw new DomainError("Received quantity must be greater than zero");
    }
    if (receivedQty > this.getRemainingBalance()) {
      throw new DomainError(`${this.description} exceeds the remaining quantity on the purchase order`);
    }
    this.cumulativeAcceptedQty += receivedQty;
  }

  isFullyMet(): boolean {
    return this.cumulativeAcceptedQty >= this.quantityOrdered;
  }
}

export class DeliveryLine {
  constructor(
    public readonly deliveryLineId: string,
    public readonly poLineId: string,
    public quantityReceived: number,
    public condition: DeliveryCondition,
    public photoUrl: string | null,
    public remark: string,
  ) {}
}

export class DeliveryRecord {
  constructor(
    public readonly deliveryRecordId: string,
    public readonly poId: string,
    public readonly siteManagerId: string,
    public readonly depotId: string | null,
    public readonly timestamp: Date,
    public supplierDeliveryNoteRef: string,
    public note: string,
    public lines: DeliveryLine[],
  ) {}
}

export interface PurchaseOrderProps {
  poId: string;
  requisitionId: string;
  supplierId: string;
  depotId: string | null;
  status: PurchaseOrderStatus;
  deliveryAddress: string;
  paymentLocked: boolean;
  placedDate: Date;
  lines: POLine[];
}

export class PurchaseOrder {
  poId: string;
  requisitionId: string;
  supplierId: string;
  depotId: string | null;
  status: PurchaseOrderStatus;
  deliveryAddress: string;
  paymentLocked: boolean;
  placedDate: Date;
  lines: POLine[];

  constructor(props: PurchaseOrderProps) {
    this.poId = props.poId;
    this.requisitionId = props.requisitionId;
    this.supplierId = props.supplierId;
    this.depotId = props.depotId;
    this.status = props.status;
    this.deliveryAddress = props.deliveryAddress;
    this.paymentLocked = props.paymentLocked;
    this.placedDate = props.placedDate;
    this.lines = props.lines;
  }

  orderedQuantity(): number {
    return this.lines.reduce((sum, line) => sum + line.quantityOrdered, 0);
  }

  acceptedQuantity(): number {
    return this.lines.reduce((sum, line) => sum + line.cumulativeAcceptedQty, 0);
  }

  orderedAmount(): number {
    return this.lines.reduce((sum, line) => sum + line.quantityOrdered * line.unitPrice, 0);
  }

  acceptedAmount(): number {
    return this.lines.reduce((sum, line) => sum + line.cumulativeAcceptedQty * line.unitPrice, 0);
  }

  getRemainingBalance(itemId: string): number {
    const line = this.lines.find((entry) => entry.itemId === itemId);
    if (!line) throw new DomainError("That item is not on this purchase order");
    return line.getRemainingBalance();
  }

  updateFulfillmentStatus(): PurchaseOrderStatus {
    if (this.lines.length > 0 && this.lines.every((line) => line.isFullyMet())) {
      this.status = "FULLY_DELIVERED";
    } else if (this.lines.some((line) => line.cumulativeAcceptedQty > 0)) {
      this.status = "PARTIALLY_DELIVERED";
    }
    return this.status;
  }

  checkIfPaymentCanBeReleased(): boolean {
    return !this.paymentLocked && this.acceptedQuantity() > 0;
  }

  receive(record: DeliveryRecord): void {
    if (this.paymentLocked) {
      throw new DomainError("This purchase order is locked after payment");
    }
    if (this.status === "FULLY_DELIVERED") {
      throw new DomainError("Delivery cannot be recorded on a fully delivered purchase order");
    }
    if (this.status !== "PLACED" && this.status !== "PARTIALLY_DELIVERED") {
      throw new DomainError("Delivery cannot be recorded on this purchase order");
    }
    if (record.lines.length === 0) {
      throw new DomainError("Record at least one received line");
    }
    for (const deliveryLine of record.lines) {
      const poLine = this.lines.find((line) => line.poLineId === deliveryLine.poLineId);
      if (!poLine) throw new DomainError("A delivery line does not match this purchase order");
      if (deliveryLine.quantityReceived <= 0) {
        throw new DomainError("Received quantity must be greater than zero");
      }
      if (deliveryLine.condition === "DAMAGED" && !deliveryLine.photoUrl) {
        throw new DomainError("Damaged goods need a photo");
      }
      if (deliveryLine.condition === "ACCEPTED") {
        poLine.updateCumulativeTotal(deliveryLine.quantityReceived);
      }
    }
    this.updateFulfillmentStatus();
  }
}
