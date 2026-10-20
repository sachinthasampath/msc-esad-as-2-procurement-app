# State model

This diagram is new. ESAD-06 has no state machine. It is the diagram to include in the critical reflection for the “totally new diagram” mark. The implementation rejects any transition that is not drawn here.

## Requisition

```mermaid
stateDiagram-v2
  [*] --> Draft
  Draft --> OnHold: submit with an unpriced line
  Draft --> WaitingApproval: submit inside manager band
  Draft --> Referred: submit above manager limit
  Draft --> Approved: submit inside auto-approve limit
  Draft --> Cancelled: cancel
  OnHold --> WaitingApproval: all lines priced, manager band
  OnHold --> Referred: all lines priced, above manager limit
  OnHold --> Approved: all lines priced, auto-approve
  OnHold --> Cancelled: cancel
  WaitingApproval --> Approved: manager approves and budget holds
  WaitingApproval --> PartiallyApproved: manager approves some lines
  WaitingApproval --> Declined: manager declines
  WaitingApproval --> Returned: manager returns to originator
  WaitingApproval --> Referred: value is above manager limit
  WaitingApproval --> Cancelled: originator cancels
  Referred --> Approved: senior approves
  Referred --> PartiallyApproved: senior approves some lines
  Referred --> Declined: senior declines
  Referred --> Returned: senior returns
  Returned --> Draft: originator edits
  Approved --> [*]
  PartiallyApproved --> [*]
  Declined --> [*]
  Cancelled --> [*]
```

Approved and Partially approved both run `PurchaseOrderFactory` for the approved lines. Returned goes back through Draft so the same submit rules run again.

## Purchase order

```mermaid
stateDiagram-v2
  [*] --> Placed: factory after approval
  Placed --> PartiallyDelivered: receipt, some quantity still open
  Placed --> FullyDelivered: receipt covers every line
  PartiallyDelivered --> PartiallyDelivered: another short receipt
  PartiallyDelivered --> FullyDelivered: remaining quantity accepted
  FullyDelivered --> [*]
```

Over-receipt is refused. Damaged quantity does not move the state. A placed order can be invoiced only after at least one accepted unit, and payment locks the order only after a payment is recorded.

## Invoice

```mermaid
stateDiagram-v2
  [*] --> Pending: procurement submits invoice
  Pending --> Approved: full match, or explicit partial approval
  Pending --> OnHold: staff holds a partial or a mismatch
  Pending --> Rejected: staff rejects
  OnHold --> Pending: credit note or a corrected invoice is matched again
  OnHold --> Approved: match now passes and staff approves
  Approved --> Paid: payment recorded
  Rejected --> [*]
  Paid --> [*]
```

`Invoice.releasePayment` is legal only from Approved. On hold and Rejected throw.
