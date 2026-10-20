export type RequisitionStatus =
  | "DRAFT"
  | "ON_HOLD"
  | "WAITING_APPROVAL"
  | "REFERRED"
  | "APPROVED"
  | "PARTIALLY_APPROVED"
  | "DECLINED"
  | "RETURNED"
  | "CANCELLED";

export type PurchaseOrderStatus = "PLACED" | "PARTIALLY_DELIVERED" | "FULLY_DELIVERED";

export type InvoiceStatus = "PENDING" | "APPROVED" | "ON_HOLD" | "REJECTED" | "PAID";

export type PaymentStatus = "PENDING" | "PAID";

export type DeliveryCondition = "ACCEPTED" | "DAMAGED";

export type PoListBadge = "APPROVED" | "PENDING" | "HOLD" | "PAID";

export function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
