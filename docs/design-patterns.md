# Design patterns in the code

These five patterns are implemented in `@procurex/domain`. The database service persists the result. React screens do not contain the rules.

## Strategy — approval bands

Files: `packages/domain/src/approval/approval-strategy.ts`, `packages/domain/src/state/route-priced.ts`.

`ApprovalPolicy` holds `autoApproveLimit` and `managerLimit`. The default row is Rs. 10,000 and Rs. 100,000. Settings edits that row.

`selectApprovalStrategy(total, policy)` picks the first strategy whose `applies` is true:

| Strategy | Band | `apply` |
| --- | --- | --- |
| `AutoApproveStrategy` | total at or under the auto-approve limit | mark every line approved, status `APPROVED` |
| `ManagerApprovalStrategy` | above that, at or under the manager limit | status `WAITING_APPROVAL` |
| `SeniorReferralStrategy` | above the manager limit | status `REFERRED` |

`routePriced` still holds a requisition that has an unpriced line. It does not switch on `outcome` after the strategy is chosen.

## State — requisitions and purchase orders

Files: `packages/domain/src/state/requisition-state.ts`, `packages/domain/src/state/requisition-workflow.ts`, `packages/domain/src/state/purchase-order-state.ts`.

`RequisitionWorkflow` loads `requisitionStateFor(status)` and calls the action. Each status class implements only the moves drawn in [design/05-state-model.md](../design/05-state-model.md). A refused move throws `DomainError`.

`PurchaseOrder.receive` still checks the payment lock, quantities, and a photo on damaged goods. It then calls `assertCanReceive` and `advance` on `PlacedState`, `PartiallyDeliveredState`, or `FullyDeliveredState`. The database still stores `PLACED`, `PARTIALLY_DELIVERED`, or `FULLY_DELIVERED`.

## Factory — one purchase order per supplier

File: `packages/domain/src/factory/purchase-order-factory.ts`.

`PurchaseOrderFactory.split` groups approved, priced lines by `supplierId` and returns one `PurchaseOrder` in `PLACED` per supplier. `createOrdersFor` in `packages/db/src/services.ts` allocates the `PO-2026-####` numbers and inserts the rows. It does not group lines itself.

## Observer — notices on the next load

Files: `packages/domain/src/observer/domain-events.ts`, `packages/db/src/services.ts`.

`domainEvents.publish` notifies every subscribed `DomainObserver`.

| Event | Published when | Stored for |
| --- | --- | --- |
| `REQUISITION_RETURNED` | a manager returns a requisition, after the status move | the site manager who created it (`userId`) |
| `PO_READY_FOR_INVOICE` | a receipt moves the order to `FULLY_DELIVERED` | `PROCUREMENT_STAFF` |

`captureDomainEvents` subscribes inside the same Prisma transaction as the status write and inserts `Notification` rows. `GET /api/v1/notifications` returns them. The office dashboard lists procurement notices. The site-manager home lists that user’s returned requisitions. Nothing is emailed.

## Chain of Responsibility — three-way match

File: `packages/domain/src/matching/three-way-match.ts`.

`Invoice.performThreeWayMatch` builds the quantities and amounts, then `runThreeWayMatch` walks this chain. The first handler that recognises the case returns the `MatchResult`. The others pass the same context on.

1. `NotDeliveredHandler` — accepted quantity is zero.
2. `FullMatchHandler` — accepted quantity covers the order and the invoice amount matches the order value.
3. `PartialDeliveryHandler` — the receipt is short and the amount matches the accepted or ordered value.
4. `PriceMismatchHandler` — every remaining case.

`Invoice.approve`, credit notes, and `releasePayment` stay on `Invoice`.
