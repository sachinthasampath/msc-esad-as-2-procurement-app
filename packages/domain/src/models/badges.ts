import type { InvoiceStatus } from "./statuses";
import type { PurchaseOrder } from "./purchase-order";
import type { PoListBadge } from "./statuses";

export function derivePoListBadge(po: PurchaseOrder, invoiceStatus: InvoiceStatus | null): PoListBadge {
  if (invoiceStatus === "PAID") return "PAID";
  if (invoiceStatus === "ON_HOLD" || invoiceStatus === "REJECTED") return "HOLD";
  if (invoiceStatus === "PENDING") return "PENDING";
  if (po.status === "PARTIALLY_DELIVERED") return "PENDING";
  return "APPROVED";
}
