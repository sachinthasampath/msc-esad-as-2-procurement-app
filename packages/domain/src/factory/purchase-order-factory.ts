import type { Requisition } from "../models/requisition";
import { PurchaseOrder, POLine } from "../models/purchase-order";
import { DomainError } from "../errors";

export interface PurchaseOrderDraftContext {
  nextPoId: () => string;
  nextLineId: () => string;
  deliveryAddress: string;
  placedDate?: Date;
}

export class PurchaseOrderFactory {
  split(requisition: Requisition, context: PurchaseOrderDraftContext): PurchaseOrder[] {
    if (requisition.status !== "APPROVED" && requisition.status !== "PARTIALLY_APPROVED") {
      throw new DomainError("Purchase orders are created only after approval");
    }
    const approved = requisition.lines.filter((line) => line.approved && line.isPriceValid);
    if (approved.length === 0) {
      throw new DomainError("There are no approved lines to order");
    }

    const groups = new Map<string, typeof approved>();
    for (const line of approved) {
      const key = `${line.supplierId}\0${line.depotId ?? ""}`;
      const existing = groups.get(key) ?? [];
      existing.push(line);
      groups.set(key, existing);
    }

    return [...groups.values()].map((lines) => {
      const supplierId = lines[0].supplierId;
      const depotId = lines[0].depotId;
      return new PurchaseOrder({
        poId: context.nextPoId(),
        requisitionId: requisition.requisitionId,
        supplierId,
        depotId,
        status: "PLACED",
        deliveryAddress: context.deliveryAddress,
        paymentLocked: false,
        placedDate: context.placedDate ?? new Date(),
        lines: lines.map(
          (line) =>
            new POLine(
              context.nextLineId(),
              line.itemId,
              line.lineId,
              line.description,
              line.quantity,
              0,
              line.negotiatedPrice,
            ),
        ),
      });
    });
  }
}
