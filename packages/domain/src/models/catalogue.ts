import { DomainError } from "../errors";

export class Account {
  constructor(
    public readonly accountId: string,
    public accountName: string,
    public costCenter: string,
    public currentBalance: number,
  ) {}

  canCover(amount: number): boolean {
    return this.currentBalance >= amount;
  }
}

export class ConstructionSite {
  constructor(
    public readonly siteId: string,
    public siteName: string,
    public address: string,
    public contactPerson: string,
  ) {}
}

export class CatalogItem {
  constructor(
    public readonly itemId: string,
    public supplierId: string,
    public description: string,
    public unitOfMeasure: string,
    public agreedPrice: number | null,
    public isRestricted: boolean,
    public lastUpdatedBy: string | null,
  ) {}

  isPriced(): boolean {
    return this.agreedPrice != null && this.agreedPrice > 0;
  }

  setCatalogPrice(price: number, updatedBy: string): void {
    if (price <= 0) {
      throw new DomainError("A catalogue price must be greater than zero");
    }
    this.agreedPrice = price;
    this.lastUpdatedBy = updatedBy;
  }
}
