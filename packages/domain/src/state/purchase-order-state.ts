import { DomainError } from "../errors";
import type { PurchaseOrderStatus } from "../models/statuses";
import { domainEvents } from "../observer/domain-events";

export interface FulfillmentOrder {
  poId: string;
  status: PurchaseOrderStatus;
  lines: { isFullyMet(): boolean; cumulativeAcceptedQty: number }[];
}

export interface PurchaseOrderState {
  readonly status: PurchaseOrderStatus;
  assertCanReceive(): void;
  advance(order: FulfillmentOrder): void;
}

function advanceFulfillment(order: FulfillmentOrder): void {
  const previous = order.status;
  if (order.lines.length > 0 && order.lines.every((line) => line.isFullyMet())) {
    order.status = "FULLY_DELIVERED";
  } else if (order.lines.some((line) => line.cumulativeAcceptedQty > 0)) {
    order.status = "PARTIALLY_DELIVERED";
  }
  if (previous !== "FULLY_DELIVERED" && order.status === "FULLY_DELIVERED") {
    domainEvents.publish({ type: "PO_READY_FOR_INVOICE", poId: order.poId });
  }
}

class PlacedState implements PurchaseOrderState {
  readonly status = "PLACED" as const;

  assertCanReceive(): void {}

  advance(order: FulfillmentOrder): void {
    advanceFulfillment(order);
  }
}

class PartiallyDeliveredState implements PurchaseOrderState {
  readonly status = "PARTIALLY_DELIVERED" as const;

  assertCanReceive(): void {}

  advance(order: FulfillmentOrder): void {
    advanceFulfillment(order);
  }
}

class FullyDeliveredState implements PurchaseOrderState {
  readonly status = "FULLY_DELIVERED" as const;

  assertCanReceive(): void {
    throw new DomainError("Delivery cannot be recorded on a fully delivered purchase order");
  }

  advance(order: FulfillmentOrder): void {
    order.status = "FULLY_DELIVERED";
  }
}

const placed = new PlacedState();
const partiallyDelivered = new PartiallyDeliveredState();
const fullyDelivered = new FullyDeliveredState();

export function purchaseOrderStateFor(status: PurchaseOrderStatus): PurchaseOrderState {
  if (status === "PLACED") return placed;
  if (status === "PARTIALLY_DELIVERED") return partiallyDelivered;
  if (status === "FULLY_DELIVERED") return fullyDelivered;
  throw new DomainError("Delivery cannot be recorded on this purchase order");
}
