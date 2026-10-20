export class RequisitionLine {
  constructor(
    public readonly lineId: string,
    public itemId: string,
    public supplierId: string,
    public depotId: string | null,
    public description: string,
    public quantity: number,
    public negotiatedPrice: number,
    public isPriceValid: boolean,
    public approved = false,
  ) {}

  lineValue(): number {
    if (!this.isPriceValid) return 0;
    return this.negotiatedPrice * this.quantity;
  }
}
