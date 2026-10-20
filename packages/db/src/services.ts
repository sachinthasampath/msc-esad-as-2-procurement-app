import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import {
  CatalogItem,
  CreditNote,
  DeliveryLine,
  DeliveryRecord,
  DomainError,
  ForbiddenError,
  Invoice,
  ManagementStaff,
  POLine,
  ProcurementStaff,
  PurchaseOrder,
  PurchaseOrderFactory,
  Requisition,
  RequisitionLine,
  RequisitionWorkflow,
  SiteManager,
  User,
  assertRole,
  assertValidPolicy,
  derivePoListBadge,
  domainEvents,
  type ApprovalPolicy,
  type DomainEvent,
  type DeliveryCondition,
  type InvoiceStatus,
  type ManagementLevel,
} from "@procurex/domain";
import { prisma } from "./client";
import { hashToken, newToken, verifyPassword } from "./password";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

const requisitionInclude = {
  site: true,
  account: true,
  createdBy: true,
  lines: true,
  purchaseOrders: { include: { supplier: true, lines: true, invoices: true } },
} satisfies Prisma.RequisitionInclude;

const poInclude = {
  supplier: true,
  lines: true,
  invoices: { include: { creditNotes: true, payment: true } },
  requisition: { include: { site: true, createdBy: true, account: true } },
  deliveries: { include: { lines: true, siteManager: true } },
} satisfies Prisma.PurchaseOrderInclude;

type RequisitionRow = Prisma.RequisitionGetPayload<{ include: typeof requisitionInclude }>;
type PurchaseOrderRow = Prisma.PurchaseOrderGetPayload<{ include: typeof poInclude }>;
type UserRow = Prisma.UserGetPayload<{ include: { site: true } }>;

function nid(prefix: string): string {
  return `${prefix}-${randomBytes(4).toString("hex")}`;
}

function notificationFrom(event: DomainEvent) {
  if (event.type === "REQUISITION_RETURNED") {
    const comment = event.comment.trim();
    return {
      id: nid("nt"),
      userId: event.originatorId,
      role: null,
      kind: event.type,
      message: comment
        ? `Requisition ${event.requisitionId} was returned: ${comment}`
        : `Requisition ${event.requisitionId} was returned`,
      entityId: event.requisitionId,
    };
  }
  return {
    id: nid("nt"),
    userId: null,
    role: "PROCUREMENT_STAFF",
    kind: event.type,
    message: `Purchase order ${event.poId} is ready for invoice`,
    entityId: event.poId,
  };
}

async function captureDomainEvents(tx: Prisma.TransactionClient, run: () => Promise<void> | void): Promise<void> {
  const events: DomainEvent[] = [];
  const unsubscribe = domainEvents.subscribe({
    update(event) {
      events.push(event);
    },
  });
  try {
    await run();
    for (const event of events) {
      await tx.notification.create({ data: notificationFrom(event) });
    }
  } finally {
    unsubscribe();
  }
}

export function toDomainUser(row: { id: string; name: string; email: string; contactNumber: string; role: string; level: string | null; siteId: string | null }): User {
  if (row.role === "SITE_MANAGER") {
    return new SiteManager(row.id, row.name, row.email, row.contactNumber, row.siteId);
  }
  if (row.role === "PROCUREMENT_STAFF") {
    return new ProcurementStaff(row.id, row.name, row.email, row.contactNumber);
  }
  if (row.role === "MANAGEMENT_STAFF") {
    return new ManagementStaff(row.id, row.name, row.email, row.contactNumber, (row.level ?? "OPERATIONAL") as ManagementLevel);
  }
  throw new DomainError("Unknown user role");
}

export function publicUser(row: UserRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    level: row.level,
    siteId: row.siteId,
    siteName: row.site?.siteName ?? null,
    contactNumber: row.contactNumber,
  };
}

export async function requireUser(token: string | null) {
  if (!token) throw new AuthError("Sign in required");
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { site: true } } },
  });
  if (!session || session.expiresAt.getTime() < Date.now()) {
    throw new AuthError("Sign in required");
  }
  return session.user;
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, include: { site: true } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new AuthError("Email or password is incorrect");
  }
  const token = newToken();
  await prisma.session.create({
    data: {
      id: nid("ses"),
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  return { token, user: publicUser(user) };
}

export async function logout(token: string | null) {
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

async function policyOf(): Promise<ApprovalPolicy> {
  const row = await prisma.approvalPolicy.findUniqueOrThrow({ where: { id: "default" } });
  return { autoApproveLimit: row.autoApproveLimit, managerLimit: row.managerLimit };
}

function hydrateRequisition(row: RequisitionRow, budget = row.account.currentBalance): Requisition {
  return new Requisition({
    requisitionId: row.id,
    siteId: row.siteId,
    accountId: row.accountId,
    createdBy: row.createdById,
    status: row.status as Requisition["status"],
    requiredDate: row.requiredDate,
    submittedDate: row.submittedDate,
    comments: row.comments,
    reviewComment: row.reviewComment,
    allocatedBudget: budget,
    lines: row.lines.map(
      (line) =>
        new RequisitionLine(
          line.id,
          line.itemId,
          line.supplierId,
          line.depotId,
          line.description,
          line.quantity,
          line.negotiatedPrice,
          line.isPriceValid,
          line.approved,
        ),
    ),
  });
}

function hydratePurchaseOrder(row: PurchaseOrderRow): PurchaseOrder {
  return new PurchaseOrder({
    poId: row.id,
    requisitionId: row.requisitionId,
    supplierId: row.supplierId,
    depotId: row.depotId,
    status: row.status as PurchaseOrder["status"],
    deliveryAddress: row.deliveryAddress,
    paymentLocked: row.paymentLocked,
    placedDate: row.placedDate,
    lines: row.lines.map(
      (line) =>
        new POLine(
          line.id,
          line.itemId,
          line.requisitionLineId,
          line.description,
          line.quantityOrdered,
          line.cumulativeAcceptedQty,
          line.unitPrice,
        ),
    ),
  });
}

function hydrateInvoice(row: {
  id: string;
  poId: string;
  supplierId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  totalAmount: number;
  payableAmount: number;
  invoiceQuantity: number;
  itemDescription: string;
  notes: string;
  status: string;
  processedById: string | null;
}): Invoice {
  const invoice = new Invoice(
    row.id,
    row.poId,
    row.supplierId,
    row.invoiceNumber,
    row.invoiceDate,
    row.totalAmount,
    row.invoiceQuantity,
    row.itemDescription,
    row.notes,
    row.status as InvoiceStatus,
    row.processedById,
  );
  invoice.payableAmount = row.payableAmount;
  return invoice;
}

function supplierNames(row: RequisitionRow): string {
  const names = [...new Set(row.purchaseOrders.map((order) => order.supplier.name))];
  if (names.length > 0) return names.join(", ");
  return [...new Set(row.lines.map((line) => line.supplierId))].join(", ");
}

export function presentRequisition(row: RequisitionRow) {
  const supplierIds = [...new Set(row.lines.map((line) => line.supplierId))];
  return {
    id: row.id,
    status: row.status,
    siteId: row.siteId,
    siteName: row.site.siteName,
    accountId: row.accountId,
    accountName: row.account.accountName,
    createdById: row.createdById,
    createdByName: row.createdBy.name,
    requiredDate: row.requiredDate.toISOString(),
    submittedDate: row.submittedDate?.toISOString() ?? null,
    comments: row.comments,
    reviewComment: row.reviewComment,
    totalValue: row.totalValue,
    itemCount: row.lines.reduce((sum, line) => sum + line.quantity, 0),
    lineCount: row.lines.length,
    supplierIds,
    supplierSummary: supplierIds.length === 0 ? "—" : `${supplierIds.length} supplier${supplierIds.length === 1 ? "" : "s"}`,
    purchaseOrders: row.purchaseOrders.map((order) => ({
      id: order.id,
      supplierName: order.supplier.name,
      status: order.status,
      listBadge: order.listBadge,
      orderedQty: order.lines.reduce((sum, line) => sum + line.quantityOrdered, 0),
      acceptedQty: order.lines.reduce((sum, line) => sum + line.cumulativeAcceptedQty, 0),
    })),
    lines: row.lines.map((line) => ({
      id: line.id,
      itemId: line.itemId,
      supplierId: line.supplierId,
      depotId: line.depotId,
      description: line.description,
      quantity: line.quantity,
      negotiatedPrice: line.negotiatedPrice,
      isPriceValid: line.isPriceValid,
      approved: line.approved,
    })),
    namedSuppliers: supplierNames(row),
  };
}

function latestInvoice(row: PurchaseOrderRow) {
  return [...row.invoices].sort((a, b) => b.invoiceDate.getTime() - a.invoiceDate.getTime())[0] ?? null;
}

async function depotLocations(ids: Array<string | null | undefined>): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();
  const depots = await prisma.depot.findMany({ where: { id: { in: unique } }, select: { id: true, location: true } });
  return new Map(depots.map((depot) => [depot.id, depot.location]));
}

function depotLabel(locations: Map<string, string>, depotId: string | null): string | null {
  if (!depotId) return null;
  return locations.get(depotId) ?? null;
}

export function presentPurchaseOrder(row: PurchaseOrderRow, depotName: string | null = null) {
  const po = hydratePurchaseOrder(row);
  const invoiceRow = latestInvoice(row);
  const invoice = invoiceRow ? hydrateInvoice(invoiceRow) : null;
  const match = invoice ? invoice.performThreeWayMatch(po) : null;
  return {
    id: row.id,
    requisitionId: row.requisitionId,
    supplierId: row.supplierId,
    supplierName: row.supplier.name,
    depotId: row.depotId,
    depotName,
    siteId: row.requisition.siteId,
    siteName: row.requisition.site.siteName,
    createdByName: row.requisition.createdBy.name,
    amount: po.orderedAmount(),
    orderedQty: po.orderedQuantity(),
    acceptedQty: po.acceptedQuantity(),
    status: row.status,
    listBadge: row.listBadge,
    placedDate: row.placedDate.toISOString(),
    requiredDate: row.requisition.requiredDate.toISOString(),
    deliveryAddress: row.deliveryAddress,
    paymentLocked: row.paymentLocked,
    comments: row.requisition.comments,
    lines: row.lines.map((line) => ({
      id: line.id,
      description: line.description,
      quantityOrdered: line.quantityOrdered,
      cumulativeAcceptedQty: line.cumulativeAcceptedQty,
      unitPrice: line.unitPrice,
    })),
    invoice: invoiceRow
      ? {
          id: invoiceRow.id,
          invoiceNumber: invoiceRow.invoiceNumber,
          status: invoiceRow.status,
          totalAmount: invoiceRow.totalAmount,
          payableAmount: invoiceRow.payableAmount,
          invoiceDate: invoiceRow.invoiceDate.toISOString(),
          itemDescription: invoiceRow.itemDescription,
          notes: invoiceRow.notes,
          match,
        }
      : null,
    deliveries: row.deliveries
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .map((delivery) => ({
        id: delivery.id,
        timestamp: delivery.timestamp.toISOString(),
        noteRef: delivery.supplierDeliveryNoteRef,
        note: delivery.note,
        siteManagerName: delivery.siteManager.name,
        lines: delivery.lines.map((line) => ({
          poLineId: line.poLineId,
          quantityReceived: line.quantityReceived,
          condition: line.condition,
          remark: line.remark,
          description: row.lines.find((entry) => entry.id === line.poLineId)?.description ?? "",
        })),
      })),
  };
}

function assertOwn(user: UserRow, createdById: string) {
  if (user.role === "SITE_MANAGER" && user.id !== createdById) {
    throw new ForbiddenError("You can only work with your own requisitions");
  }
}

async function allocate(tx: Prisma.TransactionClient, prefix: string, count: number): Promise<string[]> {
  if (count <= 0) return [];
  const key = `${prefix}-${new Date().getFullYear()}`;
  const existing = await tx.sequence.findUnique({ where: { id: key } });
  const start = (existing?.value ?? 0) + 1;
  await tx.sequence.upsert({
    where: { id: key },
    create: { id: key, value: start + count - 1 },
    update: { value: start + count - 1 },
  });
  return Array.from({ length: count }, (_, index) => `${key}-${String(start + index).padStart(4, "0")}`);
}

async function saveRequisition(tx: Prisma.TransactionClient, requisition: Requisition) {
  await tx.requisition.update({
    where: { id: requisition.requisitionId },
    data: {
      status: requisition.status,
      totalValue: requisition.calculateTotalValue(),
      submittedDate: requisition.submittedDate,
      reviewComment: requisition.reviewComment,
      allocatedBudget: requisition.allocatedBudget,
      comments: requisition.comments,
    },
  });
  for (const line of requisition.lines) {
    await tx.requisitionLine.update({
      where: { id: line.lineId },
      data: { approved: line.approved, negotiatedPrice: line.negotiatedPrice, isPriceValid: line.isPriceValid },
    });
  }
}

async function persistOrders(tx: Prisma.TransactionClient, orders: PurchaseOrder[]) {
  for (const order of orders) {
    await tx.purchaseOrder.create({
      data: {
        id: order.poId,
        requisitionId: order.requisitionId,
        supplierId: order.supplierId,
        depotId: order.depotId,
        status: order.status,
        listBadge: "APPROVED",
        deliveryAddress: order.deliveryAddress,
        paymentLocked: false,
        placedDate: order.placedDate,
        lines: {
          create: order.lines.map((line) => ({
            id: line.poLineId,
            itemId: line.itemId,
            requisitionLineId: line.requisitionLineId,
            description: line.description,
            quantityOrdered: line.quantityOrdered,
            cumulativeAcceptedQty: 0,
            unitPrice: line.unitPrice,
          })),
        },
      },
    });
  }
}

async function createOrdersFor(tx: Prisma.TransactionClient, row: RequisitionRow, requisition: Requisition) {
  if (requisition.status !== "APPROVED" && requisition.status !== "PARTIALLY_APPROVED") return;
  const groups = new Set(requisition.lines.filter((line) => line.approved).map((line) => line.supplierId));
  const poIds = await allocate(tx, "PO", groups.size);
  const queue = [...poIds];
  const orders = new PurchaseOrderFactory().split(requisition, {
    nextPoId: () => {
      const id = queue.shift();
      if (!id) throw new DomainError("Could not allocate a purchase order number");
      return id;
    },
    nextLineId: () => nid("pl"),
    deliveryAddress: `${row.site.siteName}, ${row.site.address}. Contact: ${row.site.contactPerson}`,
  });
  await persistOrders(tx, orders);
}

export interface LineInput {
  itemId: string;
  quantity: number;
  depotId?: string | null;
}

export interface RequisitionInput {
  siteId: string;
  accountId: string;
  requiredDate: string;
  comments?: string;
  lines: LineInput[];
  createdById?: string;
}

async function buildLines(lines: LineInput[]) {
  if (lines.length === 0) throw new DomainError("Add at least one item");
  const items = await prisma.catalogItem.findMany({
    where: { id: { in: lines.map((line) => line.itemId) } },
    include: { supplier: true },
  });
  const depotIds = [...new Set(lines.map((line) => line.depotId).filter((id): id is string => Boolean(id)))];
  const depots = depotIds.length === 0 ? [] : await prisma.depot.findMany({ where: { id: { in: depotIds } } });
  return lines.map((input) => {
    const item = items.find((entry) => entry.id === input.itemId);
    if (!item) throw new DomainError("An item is no longer in the catalogue");
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new DomainError("Quantity must be a whole number greater than zero");
    }
    if (input.depotId) {
      const depot = depots.find((entry) => entry.id === input.depotId);
      if (!depot || depot.supplierId !== item.supplierId) {
        throw new DomainError("Choose a depot that belongs to this supplier");
      }
    }
    const priced = item.agreedPrice != null && item.agreedPrice > 0;
    return {
      id: nid("rl"),
      itemId: item.id,
      supplierId: item.supplierId,
      depotId: input.depotId || null,
      description: item.description,
      quantity: input.quantity,
      negotiatedPrice: priced ? item.agreedPrice ?? 0 : 0,
      isPriceValid: priced,
      approved: false,
    };
  });
}

export async function listRequisitions(token: string | null) {
  const user = await requireUser(token);
  const rows = await prisma.requisition.findMany({
    where: user.role === "SITE_MANAGER" ? { createdById: user.id } : undefined,
    include: requisitionInclude,
    orderBy: { requiredDate: "desc" },
  });
  const suppliers = await prisma.supplier.findMany();
  return rows.map((row) => {
    const presented = presentRequisition(row);
    return {
      ...presented,
      supplierSummary: presented.supplierIds
        .map((id) => suppliers.find((supplier) => supplier.id === id)?.name ?? id)
        .join(", "),
    };
  });
}

export async function getRequisition(token: string | null, id: string) {
  const user = await requireUser(token);
  const row = await prisma.requisition.findUnique({ where: { id }, include: requisitionInclude });
  if (!row) throw new DomainError("Requisition not found");
  assertOwn(user, row.createdById);
  const presented = presentRequisition(row);
  const suppliers = await prisma.supplier.findMany({ where: { id: { in: presented.supplierIds } } });
  return {
    ...presented,
    supplierSummary: presented.supplierIds.map((supplierId) => suppliers.find((supplier) => supplier.id === supplierId)?.name ?? supplierId).join(", "),
    lines: presented.lines.map((line) => ({
      ...line,
      supplierName: suppliers.find((supplier) => supplier.id === line.supplierId)?.name ?? line.supplierId,
    })),
  };
}

export async function createRequisition(token: string | null, input: RequisitionInput) {
  const actor = await requireUser(token);
  const domainUser = toDomainUser(actor);
  let createdById = actor.id;
  if (domainUser.role === "PROCUREMENT_STAFF") {
    if (!input.createdById) throw new DomainError("Choose the site manager this requisition is for");
    const manager = await prisma.user.findUnique({ where: { id: input.createdById } });
    if (!manager || manager.role !== "SITE_MANAGER") throw new DomainError("Choose a site manager");
    createdById = manager.id;
  } else if (domainUser.role !== "SITE_MANAGER") {
    throw new ForbiddenError("Only a site manager or procurement staff can create a requisition");
  }
  const site = await prisma.constructionSite.findUnique({ where: { id: input.siteId } });
  const account = await prisma.account.findUnique({ where: { id: input.accountId } });
  if (!site || !account) throw new DomainError("Choose a site and a funding account");
  const requiredDate = new Date(input.requiredDate);
  if (Number.isNaN(requiredDate.getTime())) throw new DomainError("Choose the date the goods are required");
  const lines = await buildLines(input.lines);
  const total = lines.reduce((sum, line) => sum + (line.isPriceValid ? line.negotiatedPrice * line.quantity : 0), 0);
  const [id] = await prisma.$transaction(async (tx) => {
    const [nextId] = await allocate(tx, "REQ", 1);
    await tx.requisition.create({
      data: {
        id: nextId,
        siteId: site.id,
        accountId: account.id,
        createdById,
        status: "DRAFT",
        totalValue: total,
        requiredDate,
        comments: input.comments?.trim() ?? "",
        allocatedBudget: account.currentBalance,
        lines: { create: lines },
      },
    });
    return [nextId];
  });
  return getRequisition(token, id);
}

export async function updateRequisition(token: string | null, id: string, input: RequisitionInput) {
  const actor = await requireUser(token);
  const existing = await prisma.requisition.findUnique({ where: { id }, include: requisitionInclude });
  if (!existing) throw new DomainError("Requisition not found");
  assertOwn(actor, existing.createdById);
  const requisition = hydrateRequisition(existing);
  RequisitionWorkflow.editReturned(requisition);
  const lines = await buildLines(input.lines);
  const requiredDate = new Date(input.requiredDate);
  if (Number.isNaN(requiredDate.getTime())) throw new DomainError("Choose the date the goods are required");
  const total = lines.reduce((sum, line) => sum + (line.isPriceValid ? line.negotiatedPrice * line.quantity : 0), 0);
  await prisma.$transaction(async (tx) => {
    await tx.requisitionLine.deleteMany({ where: { requisitionId: id } });
    await tx.requisition.update({
      where: { id },
      data: {
        siteId: input.siteId,
        accountId: input.accountId,
        status: "DRAFT",
        requiredDate,
        comments: input.comments?.trim() ?? "",
        totalValue: total,
        lines: { create: lines },
      },
    });
  });
  return getRequisition(token, id);
}

export async function submitRequisition(token: string | null, id: string, online: boolean) {
  const actor = await requireUser(token);
  const currentPolicy = await policyOf();
  await prisma.$transaction(async (tx) => {
    const row = await tx.requisition.findUnique({ where: { id }, include: requisitionInclude });
    if (!row) throw new DomainError("Requisition not found");
    assertOwn(actor, row.createdById);
    if (actor.role !== "SITE_MANAGER" && actor.role !== "PROCUREMENT_STAFF") {
      throw new ForbiddenError("Only a site manager can submit a requisition");
    }
    const requisition = hydrateRequisition(row);
    RequisitionWorkflow.submit(requisition, currentPolicy, online);
    await saveRequisition(tx, requisition);
    await createOrdersFor(tx, row, requisition);
  });
  return getRequisition(token, id);
}

export async function cancelRequisition(token: string | null, id: string) {
  const actor = await requireUser(token);
  const row = await prisma.requisition.findUnique({ where: { id }, include: requisitionInclude });
  if (!row) throw new DomainError("Requisition not found");
  assertOwn(actor, row.createdById);
  const requisition = hydrateRequisition(row);
  RequisitionWorkflow.cancel(requisition);
  await prisma.requisition.update({ where: { id }, data: { status: requisition.status } });
  return getRequisition(token, id);
}

export async function decideRequisition(
  token: string | null,
  id: string,
  input: { action: "approve" | "decline" | "return" | "partial" | "refer"; comment?: string; lineIds?: string[] },
) {
  const actor = await requireUser(token);
  const manager = toDomainUser(actor);
  assertRole(manager, "MANAGEMENT_STAFF");
  if (!(manager instanceof ManagementStaff)) throw new ForbiddenError("Only management can decide a requisition");
  const currentPolicy = await policyOf();
  await prisma.$transaction(async (tx) => {
    await captureDomainEvents(tx, async () => {
      const row = await tx.requisition.findUnique({ where: { id }, include: requisitionInclude });
      if (!row) throw new DomainError("Requisition not found");
      const requisition = hydrateRequisition(row);
      const comment = input.comment?.trim() ?? "";
      if (input.action === "approve") RequisitionWorkflow.approve(requisition, manager.level, currentPolicy);
      if (input.action === "partial") RequisitionWorkflow.partialApprove(requisition, manager.level, input.lineIds ?? [], currentPolicy);
      if (input.action === "decline") RequisitionWorkflow.decline(requisition, manager.level, comment);
      if (input.action === "return") RequisitionWorkflow.returnToOriginator(requisition, manager.level, comment);
      if (input.action === "refer") RequisitionWorkflow.refer(requisition, manager.level, comment);
      if (comment && (input.action === "approve" || input.action === "partial")) requisition.reviewComment = comment;
      await saveRequisition(tx, requisition);
      await createOrdersFor(tx, row, requisition);
    });
  });
  return getRequisition(token, id);
}

export async function listPurchaseOrders(token: string | null) {
  const user = await requireUser(token);
  const rows = await prisma.purchaseOrder.findMany({
    where: user.role === "SITE_MANAGER" ? { requisition: { createdById: user.id } } : undefined,
    include: poInclude,
    orderBy: { placedDate: "desc" },
  });
  const locations = await depotLocations(rows.map((row) => row.depotId));
  return rows.map((row) => presentPurchaseOrder(row, depotLabel(locations, row.depotId)));
}

export async function getPurchaseOrder(token: string | null, id: string) {
  const user = await requireUser(token);
  const row = await prisma.purchaseOrder.findUnique({ where: { id }, include: poInclude });
  if (!row) throw new DomainError("Purchase order not found");
  assertOwn(user, row.requisition.createdById);
  const locations = await depotLocations([row.depotId]);
  return presentPurchaseOrder(row, depotLabel(locations, row.depotId));
}

export interface DeliveryInput {
  noteRef?: string;
  note?: string;
  lines: { poLineId: string; quantity: number; condition: DeliveryCondition; photoUrl?: string | null; remark?: string }[];
}

export async function logDelivery(token: string | null, poId: string, input: DeliveryInput) {
  const actor = await requireUser(token);
  assertRole(toDomainUser(actor), "SITE_MANAGER");
  await prisma.$transaction(async (tx) => {
    await captureDomainEvents(tx, async () => {
    const row = await tx.purchaseOrder.findUnique({ where: { id: poId }, include: poInclude });
    if (!row) throw new DomainError("Purchase order not found");
    assertOwn(actor, row.requisition.createdById);
    const po = hydratePurchaseOrder(row);
    const record = new DeliveryRecord(
      nid("del"),
      po.poId,
      actor.id,
      row.depotId,
      new Date(),
      input.noteRef?.trim() || `DN-${Date.now()}`,
      input.note?.trim() ?? "",
      input.lines.map(
        (line) =>
          new DeliveryLine(
            nid("dl"),
            line.poLineId,
            Number(line.quantity),
            line.condition,
            line.photoUrl || null,
            line.remark?.trim() ?? "",
          ),
      ),
    );
    for (const line of record.lines) {
      if (line.photoUrl && line.photoUrl.length > 200_000) {
        throw new DomainError("The photo is too large. Use an image under 150KB");
      }
    }
    po.receive(record);
    await tx.deliveryRecord.create({
      data: {
        id: record.deliveryRecordId,
        poId: record.poId,
        siteManagerId: record.siteManagerId,
        depotId: record.depotId,
        timestamp: record.timestamp,
        supplierDeliveryNoteRef: record.supplierDeliveryNoteRef,
        note: record.note,
        lines: {
          create: record.lines.map((line) => ({
            id: line.deliveryLineId,
            poLineId: line.poLineId,
            quantityReceived: line.quantityReceived,
            condition: line.condition,
            photoUrl: line.photoUrl,
            remark: line.remark,
          })),
        },
      },
    });
    for (const line of po.lines) {
      await tx.pOLine.update({
        where: { id: line.poLineId },
        data: { cumulativeAcceptedQty: line.cumulativeAcceptedQty },
      });
    }
    const invoice = latestInvoice(row);
    await tx.purchaseOrder.update({
      where: { id: po.poId },
      data: {
        status: po.status,
        listBadge: derivePoListBadge(po, (invoice?.status as InvoiceStatus | undefined) ?? null),
      },
    });
    });
  });
  return getPurchaseOrder(token, poId);
}

export async function listDeliveries(token: string | null) {
  const user = await requireUser(token);
  const rows = await prisma.deliveryRecord.findMany({
    where: user.role === "SITE_MANAGER" ? { siteManagerId: user.id } : undefined,
    include: { lines: { include: { poLine: true } }, po: { include: { supplier: true, requisition: { include: { site: true } } } }, siteManager: true },
    orderBy: { timestamp: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    poId: row.poId,
    supplierName: row.po.supplier.name,
    siteName: row.po.requisition.site.siteName,
    timestamp: row.timestamp.toISOString(),
    noteRef: row.supplierDeliveryNoteRef,
    note: row.note,
    siteManagerName: row.siteManager.name,
    acceptedQty: row.lines.filter((line) => line.condition === "ACCEPTED").reduce((sum, line) => sum + line.quantityReceived, 0),
    damagedQty: row.lines.filter((line) => line.condition === "DAMAGED").reduce((sum, line) => sum + line.quantityReceived, 0),
    lines: row.lines.map((line) => ({
      description: line.poLine.description,
      quantityReceived: line.quantityReceived,
      condition: line.condition,
      remark: line.remark,
    })),
  }));
}

function presentInvoice(
  row: Prisma.InvoiceGetPayload<{ include: { supplier: true; po: { include: typeof poInclude } } }>,
  depotName: string | null = null,
) {
  const po = hydratePurchaseOrder(row.po);
  const invoice = hydrateInvoice(row);
  const match = invoice.performThreeWayMatch(po);
  const matchLabel =
    row.status === "PAID" || match.outcome === "FULL_MATCH"
      ? "Match"
      : match.outcome === "PARTIAL_DELIVERY"
        ? "Partial"
        : match.outcome === "PRICE_MISMATCH"
          ? "Mismatch"
          : "Pending";
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    poId: row.poId,
    supplierName: row.supplier.name,
    siteName: row.po.requisition.site.siteName,
    amount: row.totalAmount,
    payableAmount: row.payableAmount,
    status: row.status,
    invoiceDate: row.invoiceDate.toISOString(),
    invoiceQuantity: row.invoiceQuantity,
    itemDescription: row.itemDescription,
    notes: row.notes,
    matchLabel,
    match,
    order: presentPurchaseOrder(row.po, depotName),
  };
}

const invoiceInclude = { supplier: true, po: { include: poInclude } } satisfies Prisma.InvoiceInclude;

export async function listInvoices(token: string | null) {
  const user = await requireUser(token);
  if (user.role === "SITE_MANAGER") throw new ForbiddenError("Invoices are handled in the office");
  const rows = await prisma.invoice.findMany({ include: invoiceInclude, orderBy: { invoiceDate: "desc" } });
  const locations = await depotLocations(rows.map((row) => row.po.depotId));
  return rows.map((row) => presentInvoice(row, depotLabel(locations, row.po.depotId)));
}

export async function createInvoice(
  token: string | null,
  input: {
    poId: string;
    invoiceNumber: string;
    invoiceDate: string;
    totalAmount: number;
    invoiceQuantity: number;
    itemDescription?: string;
    notes?: string;
  },
) {
  const user = await requireUser(token);
  assertRole(toDomainUser(user), "PROCUREMENT_STAFF");
  const po = await prisma.purchaseOrder.findUnique({ where: { id: input.poId }, include: poInclude });
  if (!po) throw new DomainError("Purchase order not found");
  const domainPo = hydratePurchaseOrder(po);
  if (domainPo.acceptedQuantity() <= 0) {
    throw new DomainError("Record a delivery before entering an invoice");
  }
  const existing = po.invoices.find((invoice) => invoice.status !== "REJECTED");
  if (existing) throw new DomainError("This purchase order already has an invoice");
  if (!input.invoiceNumber.trim()) throw new DomainError("Enter the supplier invoice number");
  const invoiceDate = new Date(input.invoiceDate);
  if (Number.isNaN(invoiceDate.getTime())) throw new DomainError("Enter the invoice date");
  if (input.totalAmount <= 0 || input.invoiceQuantity <= 0) {
    throw new DomainError("Invoice quantity and amount must be greater than zero");
  }
  const id = nid("inv");
  const number = input.invoiceNumber.trim();
  await prisma.invoice.create({
    data: {
      id,
      poId: po.id,
      supplierId: po.supplierId,
      invoiceNumber: number,
      invoiceDate,
      totalAmount: Number(input.totalAmount),
      payableAmount: Number(input.totalAmount),
      invoiceQuantity: Number(input.invoiceQuantity),
      itemDescription: input.itemDescription?.trim() ?? "",
      notes: input.notes?.trim() ?? "",
      status: "PENDING",
      processedById: user.id,
    },
  });
  await prisma.purchaseOrder.update({
    where: { id: po.id },
    data: { listBadge: derivePoListBadge(domainPo, "PENDING") },
  });
  const created = await prisma.invoice.findUniqueOrThrow({ where: { id }, include: invoiceInclude });
  const locations = await depotLocations([created.po.depotId]);
  return presentInvoice(created, depotLabel(locations, created.po.depotId));
}

async function withInvoice(id: string, change: (invoice: Invoice, po: PurchaseOrder, row: PurchaseOrderRow) => Promise<void> | void) {
  await prisma.$transaction(async (tx) => {
    const invoiceRow = await tx.invoice.findUnique({ where: { id }, include: invoiceInclude });
    if (!invoiceRow) throw new DomainError("Invoice not found");
    const po = hydratePurchaseOrder(invoiceRow.po);
    const invoice = hydrateInvoice(invoiceRow);
    await change(invoice, po, invoiceRow.po);
    await tx.invoice.update({
      where: { id },
      data: {
        status: invoice.status,
        totalAmount: invoice.totalAmount,
        payableAmount: invoice.payableAmount,
        processedById: invoice.processedBy,
      },
    });
    await tx.purchaseOrder.update({
      where: { id: po.poId },
      data: {
        paymentLocked: po.paymentLocked,
        listBadge: derivePoListBadge(po, invoice.status),
      },
    });
  });
}

export async function invoiceAction(
  token: string | null,
  id: string,
  input: { action: "approve" | "approve-partial" | "hold" | "reject" | "credit" | "pay"; reason?: string; amount?: number },
) {
  const user = await requireUser(token);
  assertRole(toDomainUser(user), "PROCUREMENT_STAFF");
  if (input.action === "credit") {
    const amount = Number(input.amount);
    const reason = input.reason?.trim() ?? "";
    if (!reason) throw new DomainError("Enter the reason for the credit note");
    const noteId = nid("cn");
    await withInvoice(id, (invoice) => {
      new CreditNote(noteId, invoice.invoiceId, amount, reason).apply(invoice);
    });
    await prisma.creditNote.create({
      data: { id: noteId, invoiceId: id, adjustmentAmount: amount, reason },
    });
  } else if (input.action === "pay") {
    const paymentId = nid("pay");
    const reference = `BT-${Date.now()}`;
    let paidAmount = 0;
    let poId = "";
    await withInvoice(id, (invoice, po) => {
      const created = invoice.releasePayment(user.id, "Bank transfer", reference, paymentId);
      po.paymentLocked = true;
      paidAmount = created.paidAmount;
      poId = po.poId;
    });
    await prisma.payment.create({
      data: {
        id: paymentId,
        invoiceId: id,
        poId,
        paidAmount,
        paymentDate: new Date(),
        paymentMethod: "Bank transfer",
        paymentReference: reference,
        processedById: user.id,
        status: "PAID",
      },
    });
  } else {
    await withInvoice(id, (invoice, po) => {
      if (input.action === "approve") invoice.approve(po, "FULL");
      if (input.action === "approve-partial") invoice.approve(po, "PARTIAL");
      if (input.action === "hold") invoice.hold();
      if (input.action === "reject") invoice.reject();
    });
  }
  const row = await prisma.invoice.findUniqueOrThrow({ where: { id }, include: invoiceInclude });
  const locations = await depotLocations([row.po.depotId]);
  return presentInvoice(row, depotLabel(locations, row.po.depotId));
}

export async function listPayments(token: string | null) {
  const user = await requireUser(token);
  if (user.role === "SITE_MANAGER") throw new ForbiddenError("Payments are handled in the office");
  const payments = await prisma.payment.findMany({
    include: { po: { include: { supplier: true } }, invoice: true },
    orderBy: { paymentDate: "desc" },
  });
  const pending = await prisma.invoice.findMany({ where: { status: { in: ["APPROVED", "PENDING", "ON_HOLD"] } } });
  const paidTotal = payments.reduce((sum, payment) => sum + payment.paidAmount, 0);
  const now = new Date();
  const monthTotal = payments
    .filter((payment) => payment.paymentDate.getMonth() === now.getMonth() && payment.paymentDate.getFullYear() === now.getFullYear())
    .reduce((sum, payment) => sum + payment.paidAmount, 0);
  return {
    summary: {
      totalPaid: paidTotal,
      pendingCount: pending.filter((invoice) => invoice.status === "APPROVED" || invoice.status === "PENDING").length,
      overdueCount: pending.filter((invoice) => invoice.status === "ON_HOLD").length,
      monthTotal,
    },
    rows: payments.map((payment) => ({
      id: payment.id,
      supplierName: payment.po.supplier.name,
      amount: payment.paidAmount,
      approvedDate: payment.invoice.invoiceDate.toISOString(),
      paymentDate: payment.paymentDate.toISOString(),
      status: payment.status,
    })),
  };
}

export async function listNotifications(token: string | null) {
  const user = await requireUser(token);
  const rows = await prisma.notification.findMany({
    where: user.role === "SITE_MANAGER" ? { userId: user.id } : { role: "PROCUREMENT_STAFF" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    message: row.message,
    entityId: row.entityId,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function dashboard(token: string | null) {
  const user = await requireUser(token);
  if (user.role === "SITE_MANAGER") throw new ForbiddenError("The dashboard is for office staff");
  const [waiting, openOrders, held, payments] = await Promise.all([
    prisma.requisition.count({ where: { status: { in: ["WAITING_APPROVAL", "REFERRED", "ON_HOLD"] } } }),
    prisma.purchaseOrder.count({ where: { status: { in: ["PLACED", "PARTIALLY_DELIVERED"] } } }),
    prisma.invoice.count({ where: { status: "ON_HOLD" } }),
    listPayments(token),
  ]);
  return {
    waitingRequisitions: waiting,
    openPurchaseOrders: openOrders,
    invoicesOnHold: held,
    paidThisMonth: payments.summary.monthTotal,
  };
}

export async function reports(token: string | null) {
  const user = await requireUser(token);
  if (user.role === "SITE_MANAGER") throw new ForbiddenError("Reports are for office staff");
  const orders = await prisma.purchaseOrder.findMany({ include: poInclude });
  const byManager = new Map<string, { name: string; count: number; total: number }>();
  const bySupplier = new Map<string, { name: string; count: number; total: number }>();
  for (const order of orders) {
    const amount = order.lines.reduce((sum, line) => sum + line.quantityOrdered * line.unitPrice, 0);
    const manager = byManager.get(order.requisition.createdById) ?? { name: order.requisition.createdBy.name, count: 0, total: 0 };
    manager.count += 1;
    manager.total += amount;
    byManager.set(order.requisition.createdById, manager);
    const supplier = bySupplier.get(order.supplierId) ?? { name: order.supplier.name, count: 0, total: 0 };
    supplier.count += 1;
    supplier.total += amount;
    bySupplier.set(order.supplierId, supplier);
  }
  return {
    byManager: [...byManager.values()],
    bySupplier: [...bySupplier.values()],
  };
}

export async function getSettings(token: string | null) {
  await requireUser(token);
  const row = await prisma.approvalPolicy.findUniqueOrThrow({ where: { id: "default" } });
  return { autoApproveLimit: row.autoApproveLimit, managerLimit: row.managerLimit };
}

export async function updateSettings(token: string | null, input: ApprovalPolicy) {
  const user = await requireUser(token);
  if (user.role === "SITE_MANAGER") throw new ForbiddenError("Only office staff can change approval rules");
  assertValidPolicy(input);
  const row = await prisma.approvalPolicy.update({
    where: { id: "default" },
    data: { autoApproveLimit: Number(input.autoApproveLimit), managerLimit: Number(input.managerLimit) },
  });
  return { autoApproveLimit: row.autoApproveLimit, managerLimit: row.managerLimit };
}

export async function listCatalogue(token: string | null, supplierId?: string) {
  await requireUser(token);
  const items = await prisma.catalogItem.findMany({
    where: supplierId ? { supplierId } : undefined,
    include: { supplier: true },
    orderBy: { description: "asc" },
  });
  return items.map((item) => ({
    id: item.id,
    supplierId: item.supplierId,
    supplierName: item.supplier.name,
    description: item.description,
    unitOfMeasure: item.unitOfMeasure,
    agreedPrice: item.agreedPrice,
    isRestricted: item.isRestricted,
    priced: new CatalogItem(item.id, item.supplierId, item.description, item.unitOfMeasure, item.agreedPrice, item.isRestricted, item.lastUpdatedById).isPriced(),
  }));
}

export async function setCataloguePrice(token: string | null, itemId: string, price: number) {
  const user = await requireUser(token);
  assertRole(toDomainUser(user), "PROCUREMENT_STAFF");
  const row = await prisma.catalogItem.findUnique({ where: { id: itemId } });
  if (!row) throw new DomainError("Catalogue item not found");
  const item = new CatalogItem(row.id, row.supplierId, row.description, row.unitOfMeasure, row.agreedPrice, row.isRestricted, row.lastUpdatedById);
  item.setCatalogPrice(price, user.id);
  await prisma.catalogItem.update({
    where: { id: itemId },
    data: { agreedPrice: item.agreedPrice, lastUpdatedById: user.id },
  });
  const heldLines = await prisma.requisitionLine.findMany({
    where: { itemId, isPriceValid: false, requisition: { status: "ON_HOLD" } },
  });
  const requisitionIds = [...new Set(heldLines.map((line) => line.requisitionId))];
  await prisma.requisitionLine.updateMany({
    where: { id: { in: heldLines.map((line) => line.id) } },
    data: { negotiatedPrice: item.agreedPrice ?? price, isPriceValid: true },
  });
  const currentPolicy = await policyOf();
  for (const requisitionId of requisitionIds) {
    await prisma.$transaction(async (tx) => {
      const current = await tx.requisition.findUnique({ where: { id: requisitionId }, include: requisitionInclude });
      if (!current || current.status !== "ON_HOLD") return;
      const requisition = hydrateRequisition(current);
      if (requisition.hasUnpriced()) {
        await tx.requisition.update({ where: { id: requisitionId }, data: { totalValue: requisition.calculateTotalValue() } });
        return;
      }
      RequisitionWorkflow.resolveHold(requisition, currentPolicy);
      await saveRequisition(tx, requisition);
      await createOrdersFor(tx, current, requisition);
    });
  }
  return listCatalogue(token);
}

export async function listSuppliers(token: string | null) {
  await requireUser(token);
  const suppliers = await prisma.supplier.findMany({ include: { depots: true }, orderBy: { name: "asc" } });
  return suppliers.map((supplier) => ({
    id: supplier.id,
    name: supplier.name,
    address: supplier.address,
    taxId: supplier.taxId,
    depots: supplier.depots.map((depot) => ({ id: depot.id, location: depot.location, contactDetails: depot.contactDetails })),
  }));
}

export async function listSites(token: string | null) {
  await requireUser(token);
  const sites = await prisma.constructionSite.findMany({ orderBy: { siteName: "asc" } });
  return sites.map((site) => ({ id: site.id, siteName: site.siteName, address: site.address, contactPerson: site.contactPerson }));
}

export async function listAccounts(token: string | null) {
  await requireUser(token);
  const accounts = await prisma.account.findMany({ orderBy: { accountName: "asc" } });
  return accounts.map((account) => ({
    id: account.id,
    accountName: account.accountName,
    costCenter: account.costCenter,
    currentBalance: account.currentBalance,
  }));
}

export async function listManagers(token: string | null) {
  const user = await requireUser(token);
  if (user.role === "SITE_MANAGER") throw new ForbiddenError("Not available");
  const managers = await prisma.user.findMany({ where: { role: "SITE_MANAGER" }, include: { site: true }, orderBy: { name: "asc" } });
  return managers.map(publicUser);
}
