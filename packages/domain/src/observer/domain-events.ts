export type DomainEvent =
  | {
      type: "REQUISITION_RETURNED";
      requisitionId: string;
      originatorId: string;
      comment: string;
    }
  | {
      type: "PO_READY_FOR_INVOICE";
      poId: string;
    };

export interface DomainObserver {
  update(event: DomainEvent): void;
}

class DomainEventBus {
  private observers: DomainObserver[] = [];

  subscribe(observer: DomainObserver): () => void {
    this.observers.push(observer);
    return () => {
      this.observers = this.observers.filter((entry) => entry !== observer);
    };
  }

  publish(event: DomainEvent): void {
    for (const observer of [...this.observers]) {
      observer.update(event);
    }
  }
}

export const domainEvents = new DomainEventBus();
