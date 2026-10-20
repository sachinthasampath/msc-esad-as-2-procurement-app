# Divergences for the critical reflection

Each item is a deliberate change from ESAD-06. The implementation follows the high-fidelity screens for layout and the sequence diagrams plus assumptions for behaviour.

## 1. Actor inheritance on the use-case diagram is not copied

The use-case diagram draws Procurement Staff as a specialisation of Site Manager, and Manager as a specialisation of Procurement Staff. That would let a manager do every site-manager action and is the reverse of assumption 9.

The class diagram is the structure we implement: `User` is the parent, with `SiteManager`, `ProcurementStaff`, and `ManagementStaff` as the three roles. A user has one role. Routes check that role. This is the change to record against rubric item “changes to the class structure”.

## 2. High-fidelity “order approval” is purchase-order tracking

Pages 16–18 are titled Order approval, but the screens are a purchase-order table and a 3-way-match modal (Approve for Payment). The approval sequence, and the low-fidelity modal on page 12, are the requisition decision: approve, decline, return, partial.

We keep the purchase-order screens as drawn. Requisition decisions live on a Requisitions page that uses the same sidebar, table, and modal. The buttons match the sequence, not a new visual style.

## 3. Delivery pages 19–22 are one screen

Four high-fidelity phones repeat the same list and sheet for Overdue, Placed, Partially delivered, and Fully delivered. One Deliveries screen renders those states from the purchase-order status and the required date.

## 4. Identifiers and currency

The art mixes `PO-2026-0189` with `PO#230151`, and mixes `Rs.` with `₹`. We use `REQ-2026-####`, `PO-2026-####`, `INV-2026-####`, `PAY-2026-####`, and `Rs.` because the brief states amounts in rupees.

## 5. One supplier field, many suppliers on the requisition

The create sheet has a single Supplier field. Assumptions 1 and 2 say a requisition may span suppliers and must split into one PO per supplier after approval. The sheet can add lines from a second supplier without becoming a different screen. `PurchaseOrderFactory` performs the split. A purchase order never mixes suppliers.

## 6. Damaged condition and photo

Assumption 7 and `DeliveryLine` include condition and a photo. The high-fidelity delivery sheet shows only quantity and a note. We add a condition control on that sheet, and a photo field only when the line is Damaged. Accepted quantity is what fulfilment and the three-way match use. Damaged quantity stays on the receipt for the credit note.

## 7. No supplier application

The use-case diagram includes a Supplier actor who receives the order and sends the invoice. None of the wireframes show a supplier login. Procurement staff record the inbound invoice. “Forward to supplier” is stored as the placed purchase order, which is the document the supplier would receive.

## 8. Thresholds are data, not constants

Assumption 3 fixes Rs. 10,000 and Rs. 100,000. The brief also asks the simulator to be configurable for another procurement context. The numbers are the default `ApprovalPolicy` row, edited on Settings. `AutoApproveStrategy`, `ManagerApprovalStrategy`, and `SeniorReferralStrategy` read that row. The class diagram has no policy class; adding it is the structural change that makes the strategy pattern real.

## 9. Account balance check

`Requisition.validateBudget` and `Account.currentBalance` are on the class diagram and are not drawn in the wireframes. Approval fails with a clear message when the requisition total is above the selected account balance. Seeded accounts are funded so the happy path still matches the screens.

## 10. What we did not add

No payment gateway, no email or SMS provider, no offline draft sync beyond blocking submit while offline, no report builder, no multi-company tenancy. Notifications in the sequence diagrams are status changes the other role sees on their next load.
