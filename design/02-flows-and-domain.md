# Flows and domain

Behaviour is taken from the four sequence diagrams, the class diagram, and the twelve assumptions in ESAD-06. Screen layout is taken from the high-fidelity wireframes. Where those sources disagree, see [04-divergences.md](04-divergences.md).

## Document numbers

- Requisition `REQ-2026-####`
- Purchase order `PO-2026-####`
- Invoice `INV-2026-####`
- Payment `PAY-2026-####`
- Currency is Rs. throughout.

## Create requisition (site manager, online only)

1. Choose site, funding account, and lines. Each line has a catalogue item, supplier, optional depot, quantity, and the catalogue’s agreed price.
2. Save Draft stores the requisition without routing it.
3. Submit requires a network connection and at least one line.
4. If any line is unpriced, status becomes On hold and procurement is asked to set the price. Approval does not start.
5. When every line has a price, `Requisition.assessApprovalPath` selects a strategy from the saved policy:
   - total at or under the auto-approve limit (default Rs. 10,000): system approves and the factory splits purchase orders;
   - total above that and at or under the manager limit (default Rs. 100,000): Waiting for approval;
   - total above the manager limit: Referred to senior management. No purchase order exists yet.
6. The site manager may edit a draft or a returned requisition, and may cancel a draft or a waiting requisition. A placed purchase order is not edited on the phone.

## Approval (management)

From Waiting for approval or Referred:

- Approve, when the funding account can cover the total: status Approved, then one purchase order per supplier.
- Partial approve: only the ticked lines are approved. Those lines are split into purchase orders. Status Partially approved.
- Decline: Declined. No purchase order.
- Return to originator: Returned, with a comment. The site manager can edit and submit again.
- A requisition above the manager limit cannot be finally approved by operational management; it is referred.

`Requisition.validateBudget` fails the approval when the total is greater than the account balance.

## Purchase order split (factory)

Assumption 1 and 2: lines are grouped by supplier. Each group becomes one purchase order. Items from two suppliers are never mixed on one PO. The PO copies site delivery address, depot, prices, and quantities. Status starts as Placed. `paymentLocked` stays false until a payment is recorded.

## Delivery (site manager, against the PO)

Allowed only while the PO is Placed or Partially delivered.

For each line received now:

- Quantity must be greater than zero and must not exceed quantity ordered minus quantity already accepted.
- Accepted quantity is added to `POLine.cumulativeAcceptedQty`.
- Damaged quantity is stored on the delivery line and does not count as accepted. A photo URL may be attached.
- The delivery is its own `DeliveryRecord` (date, note reference, site manager). It does not overwrite earlier receipts.

When every line is fully accepted, PO status becomes Fully delivered and the order is ready to invoice. Otherwise it stays Partially delivered.

## Invoice and three-way match (procurement)

Procurement enters the supplier’s invoice against one PO: number, date, quantity, amount, description, notes.

`Invoice.performThreeWayMatch` compares:

- ordered quantity and value on the PO;
- accumulated accepted quantity on the delivery lines;
- invoice quantity and amount.

Outcomes:

- Nothing accepted yet: not delivered. No payment.
- Accepted quantity covers the order and the invoice amount matches the order value: full match. Approve for payment.
- Accepted quantity is short, and the invoice amount matches the value of what was accepted: partial. Staff may hold it, or approve only the received quantity.
- Invoice amount does not match the accepted value: price mismatch. Staff may hold it, or raise a credit note for the difference. Payment stays blocked while the invoice is on hold or rejected.
- Paying an invoice that is on hold, rejected, or not approved throws.

A successful payment writes a `Payment`, sets the invoice to Paid, and locks the purchase order.

## Class responsibilities to keep on the objects

These methods stay on the domain classes, not in React components:

- `SiteManager`: create requisition, log delivery, cancel a waiting requisition.
- `ProcurementStaff`: set catalogue price, resolve held lines, verify an invoice for payment.
- `ManagementStaff`: review requisition (approve, decline, partial, return, refer).
- `Requisition`: save as draft, calculate total, assess approval path, validate budget, split by supplier.
- `PurchaseOrder` / `POLine`: update fulfilment, remaining quantity, cumulative accepted total.
- `Invoice`: three-way match, release payment.
- `CreditNote`: validate against the invoice.
- `CatalogItem`: `isPriced`.

## Configurable policy

`ApprovalPolicy` is one row: `autoApproveLimit`, `managerLimit`. The strategy objects read it at decision time. Settings is the screen that changes it. The default row matches assumption 3.
