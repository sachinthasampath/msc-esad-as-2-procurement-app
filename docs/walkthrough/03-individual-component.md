# Individual component (40)

Marks in this section vary by person. Git history does not record who wrote which module, so this file does not assign names. Before the panel, give each person one track below. Demo logins are roles for the walkthrough, not a claim about who authored the code.

| Login | Role on the day | Password |
| --- | --- | --- |
| sachintha@procurex.test | Site manager, phone :3001 | `demo1234` |
| pasan@procurex.test | Procurement, office :3000 | `demo1234` |
| jayamadhuka@procurex.test | Operational manager | `demo1234` |
| tharaka@procurex.test | Senior manager | `demo1234` |

There are five patterns and four tracks. Factory sits on the approval track, because that is when the split runs. The create track can point at the same factory when an auto-approved requisition produces purchase orders. If the panel asks a person about a pattern outside their track, use the map in section 2 and open that file. Do not invent a second implementation.

The line-by-line map for the oral is [docs/evidence.md](../evidence.md). This document is what to say.

## 1. Coding conventions and best practices (5)

**Good (4–5).** Best practices are applied, the code follows the conventions, and every member’s code is consistent.

Say this once, the same way, whoever is asked. The point of the Good band is that the four tracks look like one codebase.

**Rules stay out of the screens.** Status changes, approval, matching, and purchase-order creation are classes in [packages/domain/src](../../packages/domain/src). A React page calls the API. The API handler calls a function in [packages/db/src/services.ts](../../packages/db/src/services.ts). That function loads rows, runs a domain object, and saves the new status. Domain classes do not import Prisma.

**A role is a class.** `User` is abstract. `SiteManager`, `ProcurementStaff`, and `ManagementStaff` each have a fixed `role` ([packages/domain/src/models/user.ts](../../packages/domain/src/models/user.ts) lines 6–47). `assertRole` throws `ForbiddenError` (lines 49–53). The service checks the role at the boundary: management at `decideRequisition` (services.ts line 661), site manager at `logDelivery` (line 711), procurement at invoice and catalogue actions (lines 868, 942, 1116).

**A broken rule is a typed error.** `DomainError` and `ForbiddenError` are [packages/domain/src/errors.ts](../../packages/domain/src/errors.ts). [apps/web/src/server/handle.ts](../../apps/web/src/server/handle.ts) lines 103–107 map `ForbiddenError` to 403, `DomainError` to 400, and anything else to 500. The screen shows `error.message`. It does not re-implement the rule.

**Money bands are data.** `ApprovalPolicy` is `autoApproveLimit` and `managerLimit` ([approval-strategy.ts](../../packages/domain/src/approval/approval-strategy.ts) lines 5–13). Defaults are Rs. 10,000 and Rs. 100,000. Settings writes the row. The strategy classes do not hard-code the cut-offs.

**A notice is saved with the status change.** `captureDomainEvents` subscribes, runs the change, then inserts `Notification` rows on the same transaction (services.ts lines 89–104).

**What to say if asked “is everyone’s code the same?”** Open two tracks, for example `approval-strategy.ts` and `three-way-match.ts`. Both are a small interface, a few classes, and one caller. Both throw `DomainError`. Both are tested in [packages/domain/test/domain.test.ts](../../packages/domain/test/domain.test.ts). The screens for both are tables and modals in the same ProcureX shell.

## 2. Design patterns (20)

**Good (18–20).** The pattern is fully understood and implemented correctly.

For the person’s pattern, show four things in this order: the interface, one concrete class, the single caller, and the test. Then say what the caller does *not* do. That last sentence is the difference between “some understanding” (10–17) and a correct implementation.

| Pattern | Interface and classes | The one caller | The caller does not | Test |
| --- | --- | --- | --- | --- |
| Strategy | `ApprovalStrategy` with `applies` and `apply`. `AutoApproveStrategy`, `ManagerApprovalStrategy`, `SeniorReferralStrategy`. [approval-strategy.ts](../../packages/domain/src/approval/approval-strategy.ts) lines 17–64. `selectApprovalStrategy` picks the first whose `applies` is true (lines 72–78) | `routePriced` line 14: `.apply(requisition)` | switch on `outcome` after the strategy is chosen | `domain.test.ts` lines 47–59 and 74–88 |
| State | `RequisitionState`. One class per status, looked up by `requisitionStateFor` ([requisition-state.ts](../../packages/domain/src/state/requisition-state.ts) lines 217–231). Purchase orders: `PlacedState`, `PartiallyDeliveredState`, `FullyDeliveredState` | `RequisitionWorkflow` delegates every action (workflow lines 9–47). `PurchaseOrder.receive` calls `assertCanReceive` (purchase-order.ts line 129) | contain the transition table itself | Cancel after approval throws, lines 115–119. Receipt after full delivery throws, lines 215–221 |
| Factory | `PurchaseOrderFactory.split` ([purchase-order-factory.ts](../../packages/domain/src/factory/purchase-order-factory.ts) lines 12–38) | `createOrdersFor` allocates ids and saves the objects `split` returns (services.ts lines 453–467) | group the lines itself | Two suppliers, lines 122–140. Same supplier, two depots, lines 142–163 |
| Observer | `DomainObserver.update` and `domainEvents.publish` ([domain-events.ts](../../packages/domain/src/observer/domain-events.ts) lines 13–31) | Return publishes `REQUISITION_RETURNED` after the status move (requisition-state.ts lines 160–166). Full delivery publishes `PO_READY_FOR_INVOICE` (purchase-order-state.ts lines 24–26). `captureDomainEvents` writes the row | import Prisma from the domain | One return event, lines 176–186. No event on a partial receipt, one event when fully delivered, lines 188–214 |
| Chain of Responsibility | `MatchHandler.handle` returns a result or calls `next` (three-way-match.ts lines 12–30). Order: not delivered, full match, partial, price mismatch (lines 79–85) | `Invoice.performThreeWayMatch` builds the figures and calls `runThreeWayMatch` (invoice.ts lines 43–58) | if/else on the outcome inside `Invoice` | Not delivered 275–278, full match and payment refused 280–294, partial 296–307, price mismatch then credit note 309–321 |

**Correctness points the panel is likely to push.**

- Strategy: an unpriced line never reaches a strategy. `routePriced` holds it first. Changing Settings changes the band without editing the three classes. The test at lines 55–59 uses a different policy and the same strategies.
- State: `ApprovedState.next` is empty. The illegal call throws. The stored status is still the string `APPROVED` or `PLACED`. The pattern did not add new database columns for “current state”.
- Factory: a purchase order is constructed only after `APPROVED` or `PARTIALLY_APPROVED` (factory lines 14–16). Items from two suppliers are never on one order. Two depots of one supplier are two orders in the domain test. Do not live-demo two depots: `createOrdersFor` counts supplier ids when allocating numbers (services.ts line 455).
- Observer: the domain publishes. The database subscribes. A partial receipt publishes nothing, because the event means “ready for invoice”.
- Chain: the first handler that recognises the case returns. `PriceMismatchHandler` is last and always returns. `Invoice.approve` and `releasePayment` are not handlers.

## 3. Enhancements on the implemented module (15)

**Good (12–15).** An exceptional enhancement that is relevant to the system, with strong development skills. Average is a substantial module done to an ordinary level (6–11).

The enhancement has to be past a straight port of the diagram, and still inside the case study. Show the behaviour on screen, then the class, then the test. Do not claim a payment gateway, email, SMS, a supplier app, or a report builder.

### Track A — Create requisition (sequence `07`)

Pattern to own: **Strategy**.

Enhancement to show: the thresholds are configurable, and submit is refused while offline.

1. On the phone as `sachintha@procurex.test`, submit a priced requisition at or under Rs. 10,000. It approves without a manager.
2. In the office as `pasan@procurex.test`, open Settings and change the auto-approve limit. Submit another requisition that now falls in a different band. The strategy classes were not edited.
3. Say the phone disables Submit when offline ([apps/pwa/components/orders.tsx](../../apps/pwa/components/orders.tsx) line 280) and `RequisitionWorkflow.submit` throws when `online` is false (workflow lines 11–13). Test: `domain.test.ts` lines 69–72.

Also point at `hasUnpriced`: a missing catalogue price is On hold, not a money band (`route-priced.ts` lines 10–12, test lines 63–67). That is the case study rule “hold unpriced items”, implemented as a guard in front of the strategy.

If the auto-approved requisition has two suppliers, name `PurchaseOrderFactory` and hand the detail to Track B if that person is in the room.

### Track B — Order approval (sequence `08`)

Patterns to own: **State** for the requisition, and **Factory** for the split.

Enhancement to show: the funding-account check, and partial approval that orders only the ticked lines.

1. As `jayamadhuka@procurex.test`, open a waiting requisition. Approve, Partial, Decline, Return, and Refer are the sequence, enforced by `WaitingApprovalState` rather than by the button handler.
2. Approve a total the account cannot cover. The message is “The funding account cannot cover this requisition” (`requisition-state.ts` lines 112–114). Test lines 100–104. The class diagram already has `validateBudget`. The enhancement is that the state object runs it, so a screen cannot skip it.
3. Partial-approve one line of a two-supplier requisition. Status is `PARTIALLY_APPROVED`. Only that line is approved (test lines 106–113). `PurchaseOrderFactory.split` then builds one `PLACED` order for the approved supplier lines (factory lines 17–38).
4. As `tharaka@procurex.test`, decide a referred requisition. As the operational manager, show that the same action on a senior-band total refers instead of approving (test lines 91–97).

Say the illegal move: cancel after approval throws (test lines 115–119) because `ApprovedState` allows no next status.

### Track C — Review received order (sequence `09`)

Patterns to own: **State** for the purchase order, and **Observer** for the ready-to-invoice notice.

Enhancement to show: damaged quantity and a required photo, kept out of the accepted total.

1. On the phone, log a short receipt against a placed order. Status becomes Partially delivered. No notice yet.
2. Log the rest. Status becomes Fully delivered. The office dashboard, as procurement, lists “ready for invoice” on the next load. That is `PO_READY_FOR_INVOICE` from `advanceFulfillment` (purchase-order-state.ts lines 24–26) written by `captureDomainEvents`.
3. Mark a line Damaged and try to save without a photo. `PurchaseOrder.receive` throws (purchase-order.ts lines 139–141). With a photo, the damaged quantity stays on the receipt and `acceptedQuantity` does not rise (test lines 250–256). The order does not move on damaged goods alone.
4. Try another receipt after full delivery. `FullyDeliveredState.assertCanReceive` throws (purchase-order-state.ts lines 52–54, test lines 215–221).

The enhancement is relevant because the three-way match uses accepted quantity, not the raw delivery count. A damaged line must not become payable.

### Track D — Invoicing and payment (sequence `10`)

Pattern to own: **Chain of Responsibility**.

Enhancement to show: a credit note that turns a price mismatch back into a full match, and payment refused until the invoice is approved.

1. Not delivered is the first handler, so later handlers never run. Show it from the test (`domain.test.ts` lines 275–278), not from the invoice form. `createInvoice` refuses an invoice when accepted quantity is still zero ([packages/db/src/services.ts](../../packages/db/src/services.ts) lines 872–874).
2. After a full delivery, enter an invoice for the order value. Full match. Approve for payment, then record the payment. `releasePayment` sets `PAID` only from `APPROVED` (invoice.ts lines 93–96). Calling it earlier throws (test lines 289–293).
3. Enter an invoice above the accepted value. Price mismatch. Hold it. Raise a credit note for the difference. `CreditNote.apply` reduces the total and, if the invoice was on hold, sets it back to `PENDING` (invoice.ts lines 135–141). The next match is a full match (test lines 309–320). `validateAgainstInvoice` refuses a credit note above the invoice or against a paid invoice (lines 122–132).

Say the chain order out loud: not delivered, full match, partial, price mismatch. The last handler always returns. Adding a fifth outcome would be a new handler, not another branch in `Invoice`.

## What every person should refuse to claim

- A pattern “in the UI”. The pattern is in `packages/domain`. The screen only calls the API.
- That notifications are emails. They are rows read by `GET /api/v1/notifications`.
- That two depots were proved in the live office app. They are proved by `PurchaseOrderFactory.split` and the domain test.
- Authorship of a file the person cannot open and explain. Take the track you can walk. The Good band is understanding, not a name on a class.
