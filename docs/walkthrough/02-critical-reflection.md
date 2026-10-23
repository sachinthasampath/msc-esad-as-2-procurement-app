# Critical reflection (30)

Use this for the written report and for any oral “why did you change that?”. The Good band wants a detailed account with a clear reason, not a list of differences. The source list is [design/04-divergences.md](../../design/04-divergences.md). This document turns each rubric row into what to write and which file proves it.

If a change is only listed here and never mentioned against the accuracy rows, the accuracy mark for that row falls to Average. Say the change in both places: once while demoing, once as the justification.

What did not change is part of the argument. The requisition still routes by price and threshold. Approval is still approve, decline, partial, return, or refer, then a purchase order per supplier. Delivery still logs partial receipts. An invoice is still matched to the order and the receipt before payment. The screens still use the ProcureX shell and the phone cards from the high-fidelity wireframes.

## 1. Changes to the class structure (10)

**Good (8–10).** A detailed discussion of the structural changes, with a clear and accurate justification.

Write three changes. Do not apologise for them. Each one keeps a rule the case study already stated.

### Roles follow the class diagram, not the use-case inheritance

The use-case diagram draws Procurement Staff as a specialisation of Site Manager, and Manager as a specialisation of Procurement Staff. That would let a manager do every site-manager action. Assumption 9 is the opposite: each actor has their own actions.

The class diagram is the structure in code. `User` is the parent. `SiteManager`, `ProcurementStaff`, and `ManagementStaff` are the three roles. A user has one role. `assertRole` in [packages/domain/src/models/user.ts](../../packages/domain/src/models/user.ts) lines 49–53 throws `ForbiddenError` when the actor is wrong. `toDomainUser` in [packages/db/src/services.ts](../../packages/db/src/services.ts) lines 106–109 constructs the matching subclass from the stored role.

**Sentence to use.** “We implemented the class diagram, not the use-case generalisation, because the generalisation would give every manager the site manager’s actions.”

### `ApprovalPolicy` is new

Assumption 3 fixes Rs. 10,000 and Rs. 100,000. The brief also asks the simulator to be configured for another procurement context. The class diagram has no policy class. Hard-coding the cut-offs inside the strategies would make that second context a code change.

`ApprovalPolicy` is `autoApproveLimit` and `managerLimit` ([packages/domain/src/approval/approval-strategy.ts](../../packages/domain/src/approval/approval-strategy.ts) lines 5–13). The default row is Rs. 10,000 and Rs. 100,000. Settings writes that row. `AutoApproveStrategy`, `ManagerApprovalStrategy`, and `SeniorReferralStrategy` read it in `applies`. They do not contain the numbers.

**Sentence to use.** “Adding `ApprovalPolicy` is what makes the strategy pattern real. The bands stay assumption 3 until Settings changes them.”

### Pattern classes sit beside the diagram’s classes

These types are not on the class diagram. The requisition, purchase order, and invoice behaviour stays on the diagram’s classes.

| Added type | Why it is there | Diagram class that still owns the rule |
| --- | --- | --- |
| `ApprovalStrategy` and the three strategies | The caller must not switch on the money band | `Requisition.assessApprovalPath` still returns the chosen strategy |
| `RequisitionState` and one class per status | The current status is the only object that allows the next action | `Requisition` still holds `status`, total, and budget |
| `PurchaseOrderState` | A fully delivered order cannot take another receipt | `PurchaseOrder.receive` still checks quantities, damage, and the payment lock |
| `PurchaseOrderFactory` | Grouping lines is not the database service’s job | `PurchaseOrder` is still what gets constructed, status `PLACED` |
| `DomainObserver` | A status change can notify another role without the domain importing Prisma | The status write is still the requisition or purchase-order state |
| `MatchHandler` chain | Four match outcomes are four objects, not one if/else | `Invoice.performThreeWayMatch` still builds the figures; `approve` and `releasePayment` stay on `Invoice` |

`Account`, `validateBudget`, `CreditNote`, and `CatalogItem.isPriced` are on the diagram. They are not changes. Mention them only to show the diagram was followed.

## 2. Changes in the interaction (10)

**Good (8–10).** A detailed account of the major sequence changes, with a reliable justification.

The four sequences still do the same work. What changed is which object makes the decision. Say that once, then give one paragraph per sequence.

### Create requisition (sequence `07`)

Unchanged story: save draft, refuse submit while offline, hold when a line is unpriced, otherwise route by the policy. At or under the auto-approve limit the requisition is approved and split. The middle band waits for a manager. Above the manager limit it is referred, and no purchase order exists yet.

Changed interaction: `routePriced` does not switch on `outcome`. Line 14 of [packages/domain/src/state/route-priced.ts](../../packages/domain/src/state/route-priced.ts) is `selectApprovalStrategy(...).apply(requisition)`. `AutoApproveStrategy.apply` marks every line approved and moves to `APPROVED`. `ManagerApprovalStrategy.apply` sets `WAITING_APPROVAL`. `SeniorReferralStrategy.apply` sets `REFERRED`. An unpriced line is not a money band, so it returns before a strategy is chosen (lines 10–12).

Offline is checked in `RequisitionWorkflow.submit` before the state object runs ([requisition-workflow.ts](../../packages/domain/src/state/requisition-workflow.ts) lines 11–13). The phone also disables Submit when `navigator.onLine` is false.

### Order approval (sequence `08`)

Unchanged story: from Waiting for approval or Referred, a manager can approve, partially approve, decline, or return. Operational management cannot finally approve a total above the manager limit. Approval checks the funding account. Approved lines become one purchase order per supplier.

Changed interaction: `RequisitionWorkflow` is a facade. `approve`, `partialApprove`, `decline`, `returnToOriginator`, and `refer` each call the current state ([requisition-workflow.ts](../../packages/domain/src/state/requisition-workflow.ts) lines 29–46). `WaitingApprovalState` and `ReferredState` implement only the moves in [design/05-state-model.md](../../design/05-state-model.md). A refused move throws `DomainError`. Return publishes `REQUISITION_RETURNED` after the status move ([requisition-state.ts](../../packages/domain/src/state/requisition-state.ts) lines 160–166). The diagram’s “notify the originator” is a `Notification` row the site manager sees on the next load, not an email.

The split is not inlined in the service. After the status is `APPROVED` or `PARTIALLY_APPROVED`, `createOrdersFor` calls `PurchaseOrderFactory.split` and inserts what it returns ([services.ts](../../packages/db/src/services.ts) lines 453–467).

### Review received order (sequence `09`)

Unchanged story: a receipt is allowed while the order is placed or partially delivered. Accepted quantity accumulates. When every line is fully accepted the order is fully delivered and ready to invoice. Over-receipt is refused. Damaged quantity does not count as accepted.

Changed interaction: `PurchaseOrder.receive` asks `purchaseOrderStateFor(status).assertCanReceive()` before it accepts quantities ([purchase-order.ts](../../packages/domain/src/models/purchase-order.ts) line 129). `PlacedState` and `PartiallyDeliveredState` allow it. `FullyDeliveredState.assertCanReceive` throws. `advance` publishes `PO_READY_FOR_INVOICE` only on the transition into `FULLY_DELIVERED` ([purchase-order-state.ts](../../packages/domain/src/state/purchase-order-state.ts) lines 24–26). A partial receipt publishes nothing.

### Invoicing and payment (sequence `10`)

Unchanged story: compare ordered quantity and value, accepted quantity, and the invoice amount. Outcomes are not delivered, full match, partial delivery, and price mismatch. Payment is refused until the invoice is approved. A credit note can close a price difference.

Changed interaction: `performThreeWayMatch` does not branch. It calls `runThreeWayMatch` ([invoice.ts](../../packages/domain/src/models/invoice.ts) line 58). Each handler returns a result or passes the same figures on ([three-way-match.ts](../../packages/domain/src/matching/three-way-match.ts) lines 12–30 and 79–85). Approve, hold, credit notes, and `releasePayment` stay on `Invoice`.

**Sentence to use for all four.** “The sequence result is the same. The caller stopped choosing. The strategy, the state, or the next handler chooses.”

Notifications: `captureDomainEvents` subscribes, runs the change, and inserts `Notification` rows in the same transaction ([services.ts](../../packages/db/src/services.ts) lines 89–104). Returned requisitions are addressed to the originator. Ready-to-invoice notices are addressed to `PROCUREMENT_STAFF`. Nothing is emailed. That is divergence 10 in [design/04-divergences.md](../../design/04-divergences.md).

## 3. Usage of the wireframes (5)

**Good (4–5).** The provided wireframes were followed, and the changes are justified.

Write one sentence of justification per difference. The screen inventory is [design/01-screen-inventory.md](../../design/01-screen-inventory.md).

| What the art shows | What we shipped | Why |
| --- | --- | --- |
| Pages 16–18 titled Order approval | Purchase Orders keep that art. Requisition decisions are a Requisitions page with the same sidebar, table, and modal | Those pages are a PO table and an Approve for Payment modal. Approve, decline, return, and partial are sequence `08` and the low-fidelity modal on page 12 |
| Four delivery phones, pages 19–22 | One Deliveries screen | The four frames repeat the same list and sheet for Overdue, Placed, Partially delivered, and Fully delivered. The pill comes from the PO status and the required date |
| Delivery sheet: quantity and a note | Condition Accepted or Damaged, photo only when Damaged | Assumption 7 and `DeliveryLine` on the class diagram. Accepted quantity is what fulfilment and the match use |
| Mixed ids (`PO-2026-0189` and `PO#230151`) and mixed currency (`Rs.` and `₹`) | `REQ-2026-####`, `PO-2026-####`, `INV-2026-####`, `PAY-2026-####`, and `Rs.` | The brief states amounts in rupees |
| One Supplier field on the create sheet | The same sheet can add lines from a second supplier | Assumptions 1 and 2. The split is `PurchaseOrderFactory`, not a second screen |
| Supplier actor on the use-case diagram | No supplier login. Procurement enters the invoice | No wireframe shows a supplier application. The placed PO is the document the supplier would receive |
| Budget check not drawn | Approval fails with a clear message when the total is above `Account.currentBalance` | `Requisition.validateBudget` is on the class diagram. Seeded accounts are funded so the happy path still matches the screens |
| No profile frame | Phone Profile: name, role, email, online or offline, sign out | Same type and colours as the phone shell. It is not a new visual language |
| No settings frame | Settings edits the two limits | This is the configurable-context control the brief asks for |

**Sentence to use.** “Layout follows the high-fidelity frames. Where a frame and a sequence disagree, we kept the frame’s layout and the sequence’s action.”

## 4. Totally new diagram (5)

**Good (4–5).** The new diagram is a good design and it covers an important business scenario.

ESAD-06 has no state machine. [design/05-state-model.md](../../design/05-state-model.md) is the diagram to include. It is three state charts: requisition, purchase order, and invoice. The implementation rejects any transition that is not drawn there.

**Why this scenario matters.** The case study’s whole risk is a status moving when it should not: a purchase order before approval, a cancel after approval, a second receipt after full delivery, a payment on hold. The sequences name the happy path. They do not say which moves are illegal. The state diagram is that missing rule.

Open the diagram, then open the class that enforces one transition.

| Drawn move | Class | What to say |
| --- | --- | --- |
| Draft can be held, sent for approval, referred, auto-approved, or cancelled | `DraftState` | Submit goes through `routePriced` |
| On hold is released into those same priced routes, or cancelled | `OnHoldState` | `resolveHold` calls `routePriced` again |
| Waiting can be approved, partially approved, declined, returned, referred, or cancelled | `WaitingApprovalState` | Operational approve above the manager limit becomes Referred |
| Referred can be approved, partially approved, declined, or returned, and only by senior management | `ReferredState` | `assertDecider` refuses an operational actor |
| Returned goes back to draft when the originator edits | `ReturnedState` | The same submit rules run again |
| Approved, partially approved, declined, and cancelled are terminal | `ApprovedState` and the three siblings | `next` is empty, so cancel after approval throws |
| Placed becomes partially or fully delivered. Partial can take another receipt. Fully delivered cannot | `PlacedState`, `PartiallyDeliveredState`, `FullyDeliveredState` | Damaged quantity does not move the state |
| Invoice: Pending to Approved, On hold, or Rejected. On hold can return to Pending. Approved to Paid | `Invoice.approve`, `hold`, `reject`, `CreditNote.apply`, `releasePayment` | `releasePayment` is legal only from Approved |

Approved and Partially approved both run `PurchaseOrderFactory` for the approved lines.

**Sentence to use.** “This diagram is new because ESAD-06 never drew which status may move. Every refused arrow is a `DomainError` from that state class.”

Include the mermaid from [design/05-state-model.md](../../design/05-state-model.md) in the report. Do not redraw a second, different machine.

## What not to add to the reflection

These were considered and left out. Saying so shows the boundary. They are divergence 10.

- No payment gateway.
- No email or SMS provider.
- No offline draft sync beyond blocking submit while offline.
- No report builder. Reports stay the two tables the brief asks for.
- No multi-company tenancy.
- No supplier application.
