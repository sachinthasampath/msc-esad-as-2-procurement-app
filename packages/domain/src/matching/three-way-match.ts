import type { MatchResult } from "../models/invoice";

export interface MatchContext {
  orderedQty: number;
  acceptedQty: number;
  invoiceQty: number;
  orderedAmount: number;
  acceptedAmount: number;
  invoiceAmount: number;
}

abstract class MatchHandler {
  private nextHandler: MatchHandler | null = null;

  setNext(handler: MatchHandler): MatchHandler {
    this.nextHandler = handler;
    return handler;
  }

  handle(context: MatchContext): MatchResult {
    const result = this.tryHandle(context);
    if (result) return result;
    if (!this.nextHandler) {
      throw new Error("The match chain ended without a result");
    }
    return this.nextHandler.handle(context);
  }

  protected abstract tryHandle(context: MatchContext): MatchResult | null;
}

class NotDeliveredHandler extends MatchHandler {
  protected tryHandle(context: MatchContext): MatchResult | null {
    if (context.acceptedQty > 0) return null;
    return {
      ...context,
      outcome: "NOT_DELIVERED",
      message: "No accepted delivery has been recorded for this purchase order",
    };
  }
}

class FullMatchHandler extends MatchHandler {
  protected tryHandle(context: MatchContext): MatchResult | null {
    const matchesOrder = Math.abs(context.invoiceAmount - context.orderedAmount) < 0.5;
    if (context.acceptedQty < context.orderedQty || !matchesOrder) return null;
    return {
      ...context,
      outcome: "FULL_MATCH",
      message: "Purchase order, goods receipt, and invoice match",
    };
  }
}

class PartialDeliveryHandler extends MatchHandler {
  protected tryHandle(context: MatchContext): MatchResult | null {
    const matchesAccepted = Math.abs(context.invoiceAmount - context.acceptedAmount) < 0.5;
    const matchesOrder = Math.abs(context.invoiceAmount - context.orderedAmount) < 0.5;
    if (context.acceptedQty >= context.orderedQty || (!matchesAccepted && !matchesOrder)) return null;
    return {
      ...context,
      outcome: "PARTIAL_DELIVERY",
      message: `Partial delivery detected. ${context.acceptedQty} of ${context.orderedQty} units have been accepted`,
    };
  }
}

class PriceMismatchHandler extends MatchHandler {
  protected tryHandle(context: MatchContext): MatchResult {
    const difference = Math.round((context.invoiceAmount - context.acceptedAmount) * 100) / 100;
    return {
      ...context,
      outcome: "PRICE_MISMATCH",
      message: `Price mismatch of Rs. ${Math.abs(difference).toLocaleString("en-IN")} against the accepted goods`,
    };
  }
}

export function runThreeWayMatch(context: MatchContext): MatchResult {
  const notDelivered = new NotDeliveredHandler();
  const fullMatch = new FullMatchHandler();
  const partialDelivery = new PartialDeliveryHandler();
  const priceMismatch = new PriceMismatchHandler();
  notDelivered.setNext(fullMatch).setNext(partialDelivery).setNext(priceMismatch);
  return notDelivered.handle(context);
}
