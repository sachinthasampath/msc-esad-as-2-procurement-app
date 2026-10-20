import { describe, expect, it } from "vitest";
import {
  CreditNote,
  DEFAULT_APPROVAL_POLICY,
  DeliveryLine,
  DeliveryRecord,
  DomainError,
  Invoice,
  POLine,
  PurchaseOrder,
  PurchaseOrderFactory,
  Requisition,
  RequisitionLine,
  RequisitionWorkflow,
  selectApprovalStrategy,
} from "../src/index";

const policy = DEFAULT_APPROVAL_POLICY;

function line(
  id: string,
  supplierId: string,
  quantity: number,
  price: number,
  priced = true,
): RequisitionLine {
  return new RequisitionLine(id, `item-${id}`, supplierId, null, id, quantity, price, priced);
}

function requisition(lines: RequisitionLine[], budget = 5_000_000): Requisition {
  return new Requisition({
    requisitionId: "REQ-2026-0001",
    siteId: "site-a",
    accountId: "acc",
    createdBy: "sm",
    status: "DRAFT",
    requiredDate: new Date("2026-10-30"),
    submittedDate: null,
    comments: "",
    reviewComment: "",
    allocatedBudget: budget,
    lines,
  });
}

describe("approval strategy", () => {
  it("selects auto, manager, and senior bands", () => {
    expect(selectApprovalStrategy(10_000, policy).name).toBe("AutoApprove");
    expect(selectApprovalStrategy(10_001, policy).name).toBe("ManagerApproval");
    expect(selectApprovalStrategy(100_000, policy).name).toBe("ManagerApproval");
    expect(selectApprovalStrategy(100_001, policy).outcome).toBe("REFERRED");
  });

  it("follows a different policy without changing the strategies", () => {
    const other = { autoApproveLimit: 50_000, managerLimit: 200_000 };
    expect(selectApprovalStrategy(40_000, other).outcome).toBe("AUTO_APPROVED");
    expect(selectApprovalStrategy(80_000, other).outcome).toBe("WAITING_APPROVAL");
  });
});

describe("requisition workflow", () => {
  it("holds a requisition that still has an unpriced line", () => {
    const req = requisition([line("cement", "s1", 2, 1250), line("timber", "s1", 1, 0, false)]);
    RequisitionWorkflow.submit(req, policy, true);
    expect(req.status).toBe("ON_HOLD");
  });

  it("refuses to submit while offline", () => {
    const req = requisition([line("cement", "s1", 1, 500)]);
    expect(() => RequisitionWorkflow.submit(req, policy, false)).toThrow(DomainError);
  });

  it("auto-approves a small priced requisition", () => {
    const req = requisition([line("pvc", "s1", 2, 850)]);
    RequisitionWorkflow.submit(req, policy, true);
    expect(req.status).toBe("APPROVED");
    expect(req.lines.every((entry) => entry.approved)).toBe(true);
  });

  it("sends the middle band to a manager and the top band to senior management", () => {
    const waiting = requisition([line("steel", "s1", 10, 3400)]);
    RequisitionWorkflow.submit(waiting, policy, true);
    expect(waiting.status).toBe("WAITING_APPROVAL");

    const referred = requisition([line("steel", "s1", 40, 3400)]);
    RequisitionWorkflow.submit(referred, policy, true);
    expect(referred.status).toBe("REFERRED");
  });

  it("refers instead of approving when an operational manager faces a senior-band total", () => {
    const loose = { autoApproveLimit: 10_000, managerLimit: 200_000 };
    const req = requisition([line("steel", "s1", 40, 3400)]);
    RequisitionWorkflow.submit(req, loose, true);
    expect(req.status).toBe("WAITING_APPROVAL");
    RequisitionWorkflow.approve(req, "OPERATIONAL", policy);
    expect(req.status).toBe("REFERRED");
  });

  it("blocks approval when the account cannot cover the total", () => {
    const req = requisition([line("steel", "s1", 10, 3400)], 1000);
    RequisitionWorkflow.submit(req, policy, true);
    expect(() => RequisitionWorkflow.approve(req, "OPERATIONAL", policy)).toThrow(/funding account/);
  });

  it("partially approves only the selected lines", () => {
    const req = requisition([line("a", "s1", 10, 2000), line("b", "s2", 10, 2000)]);
    RequisitionWorkflow.submit(req, policy, true);
    RequisitionWorkflow.partialApprove(req, "OPERATIONAL", ["a"], policy);
    expect(req.status).toBe("PARTIALLY_APPROVED");
    expect(req.lines.find((entry) => entry.lineId === "a")?.approved).toBe(true);
    expect(req.lines.find((entry) => entry.lineId === "b")?.approved).toBe(false);
  });
});

describe("purchase order factory", () => {
  it("splits one purchase order per supplier and never mixes them", () => {
    const req = requisition([
      line("cement", "buildright", 2, 200),
      line("steel", "lanka", 1, 300),
      line("tiles", "buildright", 2, 150),
    ]);
    RequisitionWorkflow.submit(req, policy, true);
    let n = 0;
    const orders = new PurchaseOrderFactory().split(req, {
      nextPoId: () => `PO-${++n}`,
      nextLineId: () => `L-${n}-${Math.random()}`,
      deliveryAddress: "Colombo Site A",
    });
    expect(orders).toHaveLength(2);
    const buildright = orders.find((order) => order.supplierId === "buildright");
    expect(buildright?.lines).toHaveLength(2);
    expect(orders.every((order) => new Set(order.lines.map(() => order.supplierId)).size === 1)).toBe(true);
  });
});

describe("delivery and three-way match", () => {
  function placedOrder(): PurchaseOrder {
    return new PurchaseOrder({
      poId: "PO-2026-0234",
      requisitionId: "REQ-2026-0045",
      supplierId: "galle",
      depotId: null,
      status: "PLACED",
      deliveryAddress: "Galle Coastal Wing",
      paymentLocked: false,
      placedDate: new Date("2026-10-16"),
      lines: [new POLine("pl-1", "hinges", "rl-1", "Door hinges", 10, 0, 100)],
    });
  }

  it("rejects an over-receipt and keeps damaged quantity out of the accepted total", () => {
    const po = placedOrder();
    expect(() =>
      po.receive(
        new DeliveryRecord("d1", po.poId, "sm", null, new Date(), "DN-1", "", [
          new DeliveryLine("dl", "pl-1", 11, "ACCEPTED", null, ""),
        ]),
      ),
    ).toThrow(/remaining/);

    po.receive(
      new DeliveryRecord("d2", po.poId, "sm", null, new Date(), "DN-2", "scratched", [
        new DeliveryLine("dl2", "pl-1", 2, "DAMAGED", "photo://frame", "returned"),
      ]),
    );
    expect(po.acceptedQuantity()).toBe(0);
    expect(po.status).toBe("PLACED");
  });

  it("moves to partially delivered, then fully delivered", () => {
    const po = placedOrder();
    po.receive(
      new DeliveryRecord("d1", po.poId, "sm", null, new Date(), "DN-1", "", [
        new DeliveryLine("dl", "pl-1", 4, "ACCEPTED", null, ""),
      ]),
    );
    expect(po.status).toBe("PARTIALLY_DELIVERED");
    po.receive(
      new DeliveryRecord("d2", po.poId, "sm", null, new Date(), "DN-2", "", [
        new DeliveryLine("dl2", "pl-1", 6, "ACCEPTED", null, ""),
      ]),
    );
    expect(po.status).toBe("FULLY_DELIVERED");
  });

  it("matches, holds a price mismatch, and refuses payment until approved", () => {
    const po = placedOrder();
    po.receive(
      new DeliveryRecord("d1", po.poId, "sm", null, new Date(), "DN-1", "", [
        new DeliveryLine("dl", "pl-1", 10, "ACCEPTED", null, ""),
      ]),
    );
    const invoice = new Invoice("INV-1", po.poId, "galle", "SUP-1", new Date(), 1000, 10, "Hinges", "", "PENDING", null);
    expect(invoice.performThreeWayMatch(po).outcome).toBe("FULL_MATCH");
    expect(() => invoice.releasePayment("acc", "Bank transfer", "REF", "PAY-1")).toThrow(/not yet approved/);
    invoice.approve(po, "FULL");
    const payment = invoice.releasePayment("acc", "Bank transfer", "REF", "PAY-1");
    expect(payment.status).toBe("PAID");
    expect(invoice.status).toBe("PAID");
  });

  it("allows a partial approval only for the accepted value", () => {
    const po = placedOrder();
    po.receive(
      new DeliveryRecord("d1", po.poId, "sm", null, new Date(), "DN-1", "", [
        new DeliveryLine("dl", "pl-1", 4, "ACCEPTED", null, ""),
      ]),
    );
    const invoice = new Invoice("INV-2", po.poId, "galle", "SUP-2", new Date(), 400, 4, "Hinges", "", "PENDING", null);
    expect(invoice.performThreeWayMatch(po).outcome).toBe("PARTIAL_DELIVERY");
    invoice.approve(po, "PARTIAL");
    expect(invoice.payableAmount).toBe(400);
  });

  it("applies a credit note and returns a held invoice to pending", () => {
    const po = placedOrder();
    po.lines[0].cumulativeAcceptedQty = 10;
    po.status = "FULLY_DELIVERED";
    const invoice = new Invoice("INV-3", po.poId, "galle", "SUP-3", new Date(), 1500, 10, "Hinges", "", "PENDING", null);
    expect(invoice.performThreeWayMatch(po).outcome).toBe("PRICE_MISMATCH");
    invoice.hold();
    const note = new CreditNote("CN-1", invoice.invoiceId, 500, "Price difference");
    note.apply(invoice);
    expect(invoice.totalAmount).toBe(1000);
    expect(invoice.status).toBe("PENDING");
    expect(invoice.performThreeWayMatch(po).outcome).toBe("FULL_MATCH");
  });
});
