# Where to look

Line numbers are from the current files. Open the file and go to that line. The code itself has no marker comments.

Tests for the rows below are in `packages/domain/test/domain.test.ts`. Run them with `npm test`.

## Coding conventions and best practices

| Practice | File | Lines | What those lines do |
| --- | --- | --- | --- |
| Rules stay out of the screens | `packages/domain/src` | whole package | Status changes, approval, matching, and purchase-order creation are classes here. React pages only call the API |
| A role is a class | `packages/domain/src/models/user.ts` | 6–15 | `User` is abstract and each subclass has a fixed `role` |
| | | 17–29 | `SiteManager` |
| | | 31–33 | `ProcurementStaff` |
| | | 35–47 | `ManagementStaff` |
| | | 49–53 | `assertRole` throws `ForbiddenError` when the actor is the wrong role |
| A broken rule is a typed error | `packages/domain/src/errors.ts` | 1–6 | `DomainError` |
| | | 8–12 | `ForbiddenError` extends `DomainError` |
| The API maps that error to HTTP | `apps/web/src/server/handle.ts` | 103–107 | `ForbiddenError` is 403, `DomainError` is 400, anything else is 500 |
| The money bands are data | `packages/domain/src/approval/approval-strategy.ts` | 5–8 | `ApprovalPolicy` is `autoApproveLimit` and `managerLimit` |
| | | 10–14 | Defaults are Rs. 10,000 and Rs. 100,000. Settings writes this row. The strategy classes do not hard-code the cut-offs |
| A notice is saved with the status change | `packages/db/src/services.ts` | 89–104 | `captureDomainEvents` subscribes, runs the change, then inserts `Notification` rows on the same transaction |

## Strategy

The approval band is an object. The caller does not switch on the band.

| Piece | File | Lines |
| --- | --- | --- |
| Strategy interface, including `apply` | `packages/domain/src/approval/approval-strategy.ts` | 17–22 |
| Auto-approve: mark lines and set `APPROVED` | same file | 24–38 |
| Manager band: set `WAITING_APPROVAL` | same file | 40–51 |
| Senior band: set `REFERRED` | same file | 53–64 |
| Pick the first strategy whose `applies` is true | same file | 72–78 |
| Client calls `apply` and does not branch on the outcome | `packages/domain/src/state/route-priced.ts` | 6–15 |
| Tests: Rs. 10,000 / 10,001 / 100,000 / 100,001, then a different policy | `packages/domain/test/domain.test.ts` | 47–59 |
| Tests: submit lands on approved, waiting, or referred | same file | 74–88 |

## State

The current status is an object. That object is the only one that allows the next action.

| Piece | File | Lines |
| --- | --- | --- |
| Requisition state interface | `packages/domain/src/state/requisition-state.ts` | 9–21 |
| Illegal move throws | same file | 23–28 |
| `DraftState` | same file | 83–88 |
| `OnHoldState` | same file | 90–97 |
| `WaitingApprovalState` | same file | 170–181 |
| `ReferredState` | same file | 183–186 |
| `ReturnedState` | same file | 188–195 |
| Terminal states `Approved`, `PartiallyApproved`, `Declined`, `Cancelled` | same file | 197–216 |
| Lookup from the status string | same file | 229–231 |
| Workflow delegates every action to that object | `packages/domain/src/state/requisition-workflow.ts` | 9–47 |
| Purchase-order state interface | `packages/domain/src/state/purchase-order-state.ts` | 11–15 |
| `PlacedState` | same file | 29–37 |
| `PartiallyDeliveredState` | same file | 39–47 |
| `FullyDeliveredState` refuses another receipt | same file | 49–57 |
| `PurchaseOrder.receive` asks the state before it accepts quantities | `packages/domain/src/models/purchase-order.ts` | 125–146 |
| Test: cancel is refused after approval | `packages/domain/test/domain.test.ts` | 115–119 |
| Test: placed, then partial, then full, and a further receipt throws | same file | 259–273 |

## Factory

Purchase orders are constructed in one class. The service does not group the lines.

| Piece | File | Lines |
| --- | --- | --- |
| `PurchaseOrderFactory.split` | `packages/domain/src/factory/purchase-order-factory.ts` | 12–20 |
| Group approved lines, then `new PurchaseOrder` per group, status `PLACED` | same file | 22–38 |
| The service only allocates ids and saves the objects `split` returns | `packages/db/src/services.ts` | 453–467 |
| Test: two suppliers become two orders, and the same supplier’s lines stay together | `packages/domain/test/domain.test.ts` | 122–140 |
| Test: the same supplier with two depots becomes two orders | same file | 142–163 |

## Observer

The status change publishes an event. A subscriber in the database layer writes the notice. The domain class does not import Prisma.

| Piece | File | Lines |
| --- | --- | --- |
| `DomainObserver.update` | `packages/domain/src/observer/domain-events.ts` | 13–15 |
| `publish` calls every subscriber | same file | 27–31 |
| Return publishes `REQUISITION_RETURNED` after the status move | `packages/domain/src/state/requisition-state.ts` | 160–166 |
| Full delivery publishes `PO_READY_FOR_INVOICE` | `packages/domain/src/state/purchase-order-state.ts` | 24–26 |
| Subscriber writes the `Notification` row | `packages/db/src/services.ts` | 65–104 |
| Used when a manager decides a requisition | same file | 665 |
| Used when a delivery is logged | same file | 713 |
| Test: one return event | `packages/domain/test/domain.test.ts` | 176–186 |
| Test: no event on a partial receipt, one event when the order becomes fully delivered | same file | 188–223 |

## Chain of Responsibility

Each match outcome is one handler. A handler returns a result or passes the same figures to the next handler.

| Piece | File | Lines |
| --- | --- | --- |
| Base handler: return a result, or call `next` | `packages/domain/src/matching/three-way-match.ts` | 12–30 |
| `NotDeliveredHandler` | same file | 32–41 |
| `FullMatchHandler` | same file | 43–53 |
| `PartialDeliveryHandler` | same file | 55–66 |
| `PriceMismatchHandler`, the last handler | same file | 68–77 |
| Chain order: not delivered, full match, partial, price mismatch | same file | 79–86 |
| `Invoice.performThreeWayMatch` only builds the figures and calls the chain | `packages/domain/src/models/invoice.ts` | 43–58 |
| Test: not delivered | `packages/domain/test/domain.test.ts` | 275–278 |
| Test: full match, and payment refused until approved | same file | 280–294 |
| Test: partial delivery | same file | 296–307 |
| Test: price mismatch, then a credit note makes it a full match | same file | 309–321 |
