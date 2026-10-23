# Accuracy of basic implementation (30)

Use this in the live walkthrough. The Good band for every row is the same shape: the given ESAD-06 design is what runs, and any change is named out loud and justified in [02-critical-reflection.md](02-critical-reflection.md). A change you do not mention drops that row into Average (5–7).

The given design is the class diagram ([design/wireframes/06-class-diagram.png](../../design/wireframes/06-class-diagram.png)), the four sequence diagrams (`07` create, `08` approval, `09` delivery, `10` invoice), and the high-fidelity wireframes (`15`–`25`). Behaviour is written up in [design/02-flows-and-domain.md](../../design/02-flows-and-domain.md).

Open the office app at http://localhost:3000 and the phone app at http://localhost:3001. Password for every demo account is `demo1234`.

| Email | Who | Use for |
| --- | --- | --- |
| sachintha@procurex.test | Site manager | Create requisition, log delivery |
| pasan@procurex.test | Procurement | Prices, invoices, payments |
| jayamadhuka@procurex.test | Operational manager | Manager-band decision |
| tharaka@procurex.test | Senior manager | Referred requisition |

One path covers all three rows. Create a priced requisition on the phone, decide it in the office, log a delivery on the phone, then match an invoice in the office. Stop at each sequence and open the file named below.

## 1. Class structure (10)

**Good (8–10).** The system follows the class diagram. Any class that is not on that diagram is discussed in the critical reflection.

**What to say.** The classes on the diagram are the classes in `packages/domain`. React pages do not own the rules. Prisma stores the same types; it does not decide them.

Open [design/wireframes/06-class-diagram.png](../../design/wireframes/06-class-diagram.png) beside [packages/domain/src/models/](../../packages/domain/src/models/).

| Diagram class | Code | What to point at |
| --- | --- | --- |
| `User`, `SiteManager`, `ProcurementStaff`, `ManagementStaff` | [packages/domain/src/models/user.ts](../../packages/domain/src/models/user.ts) | `User` is abstract (lines 6–15). Each subclass has a fixed `role`. `ManagementStaff` carries `OPERATIONAL` or `SENIOR` (lines 35–47). `assertRole` throws `ForbiddenError` (lines 49–53). |
| `Requisition`, `RequisitionLine` | [packages/domain/src/models/requisition.ts](../../packages/domain/src/models/requisition.ts), [requisition-line.ts](../../packages/domain/src/models/requisition-line.ts) | `calculateTotalValue` (line 46), `validateBudget` (line 58), `assessApprovalPath` (line 62). |
| `Account`, `ConstructionSite`, `CatalogItem` | [packages/domain/src/models/catalogue.ts](../../packages/domain/src/models/catalogue.ts) | `CatalogItem.isPriced`. `Account.currentBalance` is the balance the budget check uses. |
| `Supplier`, `Depot` | [packages/db/prisma/schema.prisma](../../packages/db/prisma/schema.prisma) | `Supplier` (line 62) and `Depot` (line 73). A supplier has many depots. |
| `PurchaseOrder`, `POLine` | [packages/domain/src/models/purchase-order.ts](../../packages/domain/src/models/purchase-order.ts) | `receive` (line 125) checks the payment lock, quantities, and a photo on damaged goods, then asks the state object to move. |
| `DeliveryRecord`, `DeliveryLine` | same file | Condition and photo live on the delivery line, as on the diagram. |
| `Invoice`, `CreditNote`, `Payment` | [packages/domain/src/models/invoice.ts](../../packages/domain/src/models/invoice.ts) | `performThreeWayMatch` (line 43) only builds the figures. `approve`, `hold`, `reject`, and `releasePayment` (line 93) stay on `Invoice`. |

The same names are the Prisma models in [packages/db/prisma/schema.prisma](../../packages/db/prisma/schema.prisma): `User`, `Account`, `ConstructionSite`, `Supplier`, `Depot`, `CatalogItem`, `Requisition`, `RequisitionLine`, `PurchaseOrder`, `POLine`, `DeliveryRecord`, `DeliveryLine`, `Invoice`, `CreditNote`, `Payment`.

**Say these extras in the same breath.** They are not on the class diagram. Leaving them unspoken is how this row falls to 5–7.

- `ApprovalPolicy` plus `AutoApproveStrategy`, `ManagerApprovalStrategy`, and `SeniorReferralStrategy` in [packages/domain/src/approval/approval-strategy.ts](../../packages/domain/src/approval/approval-strategy.ts). The diagram has no policy class. The thresholds are a row so another procurement context can change them.
- One state class per requisition status in [packages/domain/src/state/requisition-state.ts](../../packages/domain/src/state/requisition-state.ts), and `PlacedState`, `PartiallyDeliveredState`, `FullyDeliveredState` in [packages/domain/src/state/purchase-order-state.ts](../../packages/domain/src/state/purchase-order-state.ts).
- `PurchaseOrderFactory` in [packages/domain/src/factory/purchase-order-factory.ts](../../packages/domain/src/factory/purchase-order-factory.ts).
- `DomainObserver` and `domainEvents` in [packages/domain/src/observer/domain-events.ts](../../packages/domain/src/observer/domain-events.ts).
- The four match handlers in [packages/domain/src/matching/three-way-match.ts](../../packages/domain/src/matching/three-way-match.ts).

The justification for each extra is in [02-critical-reflection.md](02-critical-reflection.md). The behaviour of requisition, purchase order, and invoice is still the diagram’s behaviour.

**Do not claim.** The use-case diagram’s actor inheritance is not the class structure. Procurement is not a subclass of Site Manager. There is no `Supplier` user class.

## 2. Functionality from the sequence diagrams (10)

**Good (8–10).** The basic functionality on the four sequence diagrams works, and any change in how the objects talk is discussed in the reflection.

Walk the four sequences in order. After each one, say the one interaction change: the caller does not switch on a band or an if/else. The object that owns the decision does.

### Create requisition — sequence `07`

Log in on the phone as `sachintha@procurex.test`. Open Orders and the New Purchase Order sheet.

Show, in this order:

1. Save draft. The requisition stays `DRAFT`. No approval starts.
2. A line with no agreed price. Submit. Status becomes On hold. Procurement must set the price before approval. That is [packages/domain/src/state/route-priced.ts](../../packages/domain/src/state/route-priced.ts) lines 10–12.
3. Every line priced, total at or under Rs. 10,000. Submit while online. Status becomes Approved and purchase orders appear.
4. A total above Rs. 10,000 and at or under Rs. 100,000 goes to Waiting for approval. Above Rs. 100,000 goes to Referred. No purchase order exists yet.

The call is line 14 of `route-priced.ts`: `selectApprovalStrategy(...).apply(requisition)`. There is no `if` on the outcome after the strategy is chosen.

Offline: the Submit button is disabled in [apps/pwa/components/orders.tsx](../../apps/pwa/components/orders.tsx) (line 280), and [packages/domain/src/state/requisition-workflow.ts](../../packages/domain/src/state/requisition-workflow.ts) lines 11–13 throw if `online` is false. The test is `domain.test.ts` lines 69–72.

A second supplier can be added on the same sheet. After approval, [packages/domain/src/factory/purchase-order-factory.ts](../../packages/domain/src/factory/purchase-order-factory.ts) `split` (lines 12–38) groups approved lines by supplier and depot and returns one `PLACED` order per group. `createOrdersFor` in [packages/db/src/services.ts](../../packages/db/src/services.ts) (lines 453–467) only allocates `PO-2026-####` numbers and saves those objects.

Demo two suppliers in the UI. The two-depot case is the test at `domain.test.ts` lines 142–163. Do not improvise a two-depot live demo: `createOrdersFor` counts supplier ids when it allocates numbers (services.ts line 455), so two depots of one supplier can fail to allocate a second PO id even though `split` itself returns two orders.

### Order approval — sequence `08`

Log in to the office as `jayamadhuka@procurex.test`. Open Requisitions. The buttons are Approve, Decline, Return, Partial, and Refer ([apps/web/app/(console)/requisitions/page.tsx](../../apps/web/app/(console)/requisitions/page.tsx) lines 122–125).

`RequisitionWorkflow` in [packages/domain/src/state/requisition-workflow.ts](../../packages/domain/src/state/requisition-workflow.ts) does not contain the rules. Each method loads `requisitionStateFor(status)` and calls that object (lines 29–46).

Show one of each if the seed data allows it, otherwise describe the test that locks it:

| Action | Result | Where |
| --- | --- | --- |
| Approve inside the manager band, balance covers the total | `APPROVED`, then one PO per supplier | `approve` in requisition-state.ts lines 106–118 |
| Partial, some lines ticked | Only those lines approved, status `PARTIALLY_APPROVED` | lines 121–145; test lines 106–113 |
| Decline | `DECLINED`, no PO | lines 148–151 |
| Return with a comment | `RETURNED`, site manager sees the notice on next load | lines 154–166 |
| Total above the manager limit, operational manager presses Approve | Status becomes `REFERRED`, not approved | lines 108–110; test lines 91–97 |
| Total above the account balance | Approval throws “funding account cannot cover” | lines 112–114; test lines 100–104 |
| Senior decision | `tharaka@procurex.test` on a `REFERRED` requisition. Operational staff cannot decide it | `assertDecider` lines 100–104 |

Cancel is allowed from draft, on hold, and waiting. It is refused after approval. Test: `domain.test.ts` lines 115–119.

### Review received order — sequence `09`

Back on the phone as the site manager. Open Deliveries. Tap a placed order and confirm a quantity smaller than the order. Status becomes Partially delivered. A second receipt that covers the rest becomes Fully delivered.

`PurchaseOrder.receive` ([purchase-order.ts](../../packages/domain/src/models/purchase-order.ts) lines 125–146) asks `assertCanReceive` before it accepts quantities. `FullyDeliveredState` refuses another receipt. Tests: partial then full at `domain.test.ts` lines 259–273; a further receipt throws at lines 215–221; an over-receipt throws at lines 240–248.

Damaged quantity does not move the order and does not count as accepted (`domain.test.ts` lines 250–256). A damaged line without a photo throws (purchase-order.ts lines 139–141).

A full delivery publishes `PO_READY_FOR_INVOICE`. A partial receipt publishes nothing (`domain.test.ts` lines 188–214).

### Invoicing and payment — sequence `10`

Office, `pasan@procurex.test`, Invoices. Enter Invoice, then Submit for 3-way match.

`Invoice.performThreeWayMatch` ([invoice.ts](../../packages/domain/src/models/invoice.ts) lines 43–58) builds ordered quantity, accepted quantity, and the three amounts, then calls `runThreeWayMatch`. The chain in [three-way-match.ts](../../packages/domain/src/matching/three-way-match.ts) lines 79–85 is fixed:

1. `NotDeliveredHandler` — accepted quantity is zero.
2. `FullMatchHandler` — accepted quantity covers the order and the invoice amount matches the order value.
3. `PartialDeliveryHandler` — the receipt is short and the amount matches.
4. `PriceMismatchHandler` — everything else.

Show the outcome the screen is in, and name the other three from the tests (`domain.test.ts` lines 275–321):

- Nothing accepted: `NOT_DELIVERED`. No payment.
- Full match: Approve for payment. `releasePayment` throws until the invoice is `APPROVED` (invoice.ts lines 93–96; test lines 289–293).
- Partial: Hold, or approve only the accepted value.
- Price mismatch: Hold, or a credit note. `CreditNote.apply` reduces the invoice and the next match can be a full match (test lines 309–320).

A payment writes a `Payment`, sets the invoice to Paid, and locks the purchase order.

**Say the interaction change.** The sequence still compares the purchase order, the goods receipt, and the invoice before payment. The if/else that used to live inside `performThreeWayMatch` is now four handlers. That sentence belongs in the reflection as well.

## 3. User interfaces from the wireframes (10)

**Good (8–10).** The high-fidelity wireframes are what the screens follow. Every visible difference is discussed in the reflection.

Walk [design/01-screen-inventory.md](../../design/01-screen-inventory.md) against the running apps. Put the wireframe image next to the screen.

| Wireframe | Screen to open | What matches |
| --- | --- | --- |
| `15-hifi-create-requisition.png` | Phone Orders: tabs All / Drafts / On hold / Waiting, chips, cards, New Purchase Order sheet with site, supplier, depot, item search, Submit and Save draft | [apps/pwa/components/orders.tsx](../../apps/pwa/components/orders.tsx) |
| `16`–`18` order lists, approved list, details | Office Purchase Orders: dark ProcureX sidebar, filters All / Pending / Approved / Delivered, detail modal with the three match tiles | [apps/web/app/(console)/purchase-orders/page.tsx](../../apps/web/app/(console)/purchase-orders/page.tsx) |
| `19`–`22` delivery phones | Phone Deliveries: one list, status pill from the PO, confirm-items sheet | [apps/pwa/app/(main)/deliveries/page.tsx](../../apps/pwa/app/(main)/deliveries/page.tsx) |
| `23`–`24` invoices, match, holds | Office Invoices: filters All / Pending / Approved / Hold / Paid, Enter Invoice, match review | [apps/web/app/(console)/invoices/page.tsx](../../apps/web/app/(console)/invoices/page.tsx) |
| `25` paid and payments | Office Payments: stat cards and the payment history table | [apps/web/app/(console)/payments/page.tsx](../../apps/web/app/(console)/payments/page.tsx) |

Pages that have no inner high-fidelity layout reuse that shell: Dashboard, Requisitions, Deliveries (office, read-only receipts), Reports, Suppliers, Catalogue, Settings.

**Say these differences out loud.** Each one is justified in [02-critical-reflection.md](02-critical-reflection.md). Unmentioned, this row is 5–7.

- Requisition decisions are a Requisitions page, not the high-fidelity “Order approval” art. Pages 16–18 are a purchase-order table and an Approve for Payment modal. The approve / decline / return / partial buttons come from sequence `08` and the low-fidelity modal on page 12, drawn in the same ProcureX modal.
- Delivery pages 19–22 are one screen. The four phones repeat the same list for Overdue, Placed, Partially delivered, and Fully delivered.
- The confirm sheet adds Accepted / Damaged, and a photo only when Damaged. The high-fidelity sheet shows quantity and a note. The class diagram and assumption 7 require condition and a photo.
- Identifiers are `REQ-2026-####`, `PO-2026-####`, `INV-2026-####`, `PAY-2026-####`. Amounts are `Rs.`. The art mixes those formats with `PO#230151` and `₹`.
- The create sheet can add a second supplier. Assumptions 1 and 2 require the split. The sheet does not become a second screen.
- There is no supplier login. No wireframe shows one. Procurement types the invoice the supplier would have sent.
- Profile on the phone has no high-fidelity frame. It shows name, role, email, online or offline, and sign out, in the same type and colours.
- Settings is the two thresholds. That is the “another procurement context” control, not a wireframe page.

**Do not claim.** No payment gateway, no email or SMS, no supplier app, no report builder. Reports are the two tables the brief asks for: purchase orders by site manager, and purchase orders by supplier.
