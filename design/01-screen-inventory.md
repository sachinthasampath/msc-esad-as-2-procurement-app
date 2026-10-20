# Screen inventory

Source: ESAD-06 high-fidelity wireframes (pages 15–25), with low-fidelity pages 11–14 used only where the high-fidelity set omits a required action. Product name in the admin chrome is **ProcureX**. The case study name for the whole system is **SiteFlow Procurement**.

Reference images live in [wireframes/](wireframes/).

## Who uses which app

| Actor | App | Can do |
| --- | --- | --- |
| Site Manager | PWA | Create and track requisitions. Log deliveries against purchase orders. |
| Procurement Staff | Admin | Maintain catalogue prices, suppliers, and depots. Release unpriced holds. Enter invoices. Record payments. |
| Management Staff (operational) | Admin | Approve, decline, partially approve, or return requisitions inside the manager band. |
| Management Staff (senior) | Admin | Decide requisitions referred above the senior threshold. |

There is no supplier login. Procurement staff type in the invoice a supplier would have sent.

## Mobile PWA

Bottom navigation: Home, Orders, Deliveries, Profile.

### Home — action list

Same card as the order list, filtered to items that need the site manager (drafts, on hold, waiting approval, overdue deliveries). Not a separate visual language.

### Orders — requisition and PO tracking

Source: `15-hifi-create-requisition.png` (right-hand phone).

- Tabs: All Orders, Drafts, On Hold, Waiting Approval.
- Search: requisition, PO, or supplier.
- Chips: All, Pending, Approved, Partial.
- Card: requisition number, PO number when one exists, site, item count, amount, required date, supplier, status pill, progress (ordered vs delivered), primary action.
- Waiting approval: View and Cancel.
- Fully delivered: Complete and Details.
- Create opens the New Purchase Order sheet (same image, left phone).

### New Purchase Order sheet

- Site (required), Supplier (required), Depot (optional).
- Item search against that supplier’s catalogue. Rows show the agreed price or **Unpriced**.
- A second supplier can be chosen to add more lines to the same requisition (assumption 1). The sheet stays the one from the wireframe.
- Submit, or Save Draft.
- Submit is blocked when the browser is offline (assumption 10).

### Deliveries

Source: `19`–`22` are one screen in four states, not four flows.

- Header site name, search, tabs Active and Reviewed.
- Card: supplier, site, PO number, requisition number, due date, status pill (Overdue, Placed, Partially delivered, Fully delivered), order value.
- Tapping an active PO opens Confirm items received today.
- Each line: name, received so far, quantity input.
- Delivery note (optional).
- Condition Accepted or Damaged, and a photo only when Damaged (class diagram and assumption 7; not drawn on the high-fidelity sheet).
- Save delivery, Cancel.

### Profile

Name, role, email, online/offline, sign out. Uses the same type and colours. No high-fidelity frame exists for this tab.

## Admin (ProcureX)

Shell from `16-hifi-order-lists.png`:

- Dark sidebar, wordmark ProcureX.
- Main: Dashboard, Requisitions, Purchase Orders, Deliveries.
- Finance: Invoices, Payments, Reports.
- Admin: Suppliers, Catalogue, Settings.
- Top bar: search, Export, primary action (New Requisition on order pages, Enter Invoice on invoices).

Pages without an inner high-fidelity layout reuse this shell, the data table, and the detail modal.

### Dashboard

Counts only: requisitions waiting, purchase orders open, invoices on hold, payments this month.

### Requisitions — approval queue

The high-fidelity “approval” art is a purchase-order list. The decision actions come from the approval sequence and `12-lofi-order-approval.png`, drawn with the ProcureX modal.

- Table: requisition, site, supplier summary, amount, status.
- Modal: site, suppliers, line items with include checkboxes, amount, comment from the site manager, comment back.
- Actions: Approve, Decline, Return, Partial approve. Refer is offered when the value is above the senior band, and senior staff can decide a referred requisition.

### Purchase Orders

Source: `16`, `17`, `18`.

- Filters: All, Pending, Approved, Delivered.
- Columns: PO ID, Supplier, Site, Amount, Delivered (qty and percent), Status, View.
- Detail modal: requisition, supplier, site, amount, order date, status, and the three match tiles (Purchase order, Goods receipt, Invoice).
- Pending payment: Cancel, Reject, Approve for Payment — only when an invoice is waiting and the match allows it.
- Approved: Close, Audit trail (delivery and invoice history).

### Deliveries

Read-only table of receipt records: PO, site, date, note reference, accepted and damaged quantities.

### Invoices

Source: `23`, `24`.

- Filters: All, Pending, Approved, Hold, Paid.
- Columns: invoice number, PO, supplier, amount, 3-way match, status, View.
- Enter Invoice: invoice number, date, PO (supplier and lines fill from the PO), quantity, amount, description, notes. Submit for 3-way match.
- Match review: three tiles plus a discrepancy banner.
  - Full match: Approve for Payment.
  - Partial delivery: Hold, or Approve partial for the received quantity.
  - Price mismatch: Hold, or Request credit note.
- Hold and pending modals match `24-hifi-match-and-holds.png`.

### Payments

Source: `25-hifi-paid-and-payments.png`.

- Stat cards: total paid, pending payment, overdue, adjustment rate.
- History: reference, supplier, amount, approved date, payment date, status.

### Reports

Two tables required by the brief: purchase orders by site manager, and purchase orders by supplier.

### Suppliers

Supplier plus its depots (assumption: multiple depots per supplier).

### Catalogue

Items, unit, agreed price or Unpriced, restricted flag. Procurement can set a price. Saving a price on a held requisition line re-runs approval routing when every line is priced.

### Settings

The two thresholds (auto-approve limit, manager limit). Defaults Rs. 10,000 and Rs. 100,000. Changing them is the “different procurement context” demonstration.

## Shared components

See [03-design-system.md](03-design-system.md).
