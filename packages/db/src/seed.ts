import { PrismaClient } from "@prisma/client";
import { hashPassword } from "./password";

const prisma = new PrismaClient();
const password = hashPassword("demo1234");

async function main() {
  await prisma.payment.deleteMany();
  await prisma.creditNote.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.deliveryLine.deleteMany();
  await prisma.deliveryRecord.deleteMany();
  await prisma.pOLine.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.requisitionLine.deleteMany();
  await prisma.requisition.deleteMany();
  await prisma.catalogItem.deleteMany();
  await prisma.depot.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.account.deleteMany();
  await prisma.constructionSite.deleteMany();
  await prisma.sequence.deleteMany();
  await prisma.approvalPolicy.deleteMany();

  await prisma.approvalPolicy.create({
    data: { id: "default", autoApproveLimit: 10_000, managerLimit: 100_000 },
  });
  await prisma.sequence.createMany({
    data: [
      { id: "REQ-2026", value: 6100 },
      { id: "PO-2026", value: 6100 },
    ],
  });

  await prisma.account.createMany({
    data: [
      { id: "acc-foundation", accountName: "Foundation works", costCenter: "CC-100", currentBalance: 5_000_000 },
      { id: "acc-finishes", accountName: "Finishes", costCenter: "CC-200", currentBalance: 2_000_000 },
    ],
  });

  await prisma.constructionSite.createMany({
    data: [
      { id: "site-colombo", siteName: "Colombo Site A", address: "14 Baseline Road, Colombo", contactPerson: "Sachintha" },
      { id: "site-colombo-b", siteName: "Colombo Site B", address: "90 Galle Road, Colombo", contactPerson: "Sachintha" },
      { id: "site-galle", siteName: "Galle Coastal Wing", address: "8 Church Street, Galle", contactPerson: "Sachintha" },
      { id: "site-kandy", siteName: "Kandy Riverside", address: "3 River Road, Kandy", contactPerson: "Sachintha" },
      { id: "site-jaffna", siteName: "Jaffna Site", address: "21 Hospital Road, Jaffna", contactPerson: "Sachintha" },
      { id: "site-negombo", siteName: "Negombo Site", address: "5 Beach Road, Negombo", contactPerson: "Sachintha" },
    ],
  });

  await prisma.user.createMany({
    data: [
      { id: "user-sachintha", name: "Sachintha", email: "sachintha@procurex.test", contactNumber: "0771000001", passwordHash: password, role: "SITE_MANAGER", siteId: "site-colombo" },
      { id: "user-pasan", name: "Pasan", email: "pasan@procurex.test", contactNumber: "0771000002", passwordHash: password, role: "PROCUREMENT_STAFF" },
      { id: "user-jayamadhuka", name: "Jayamadhuka", email: "jayamadhuka@procurex.test", contactNumber: "0771000003", passwordHash: password, role: "MANAGEMENT_STAFF", level: "OPERATIONAL" },
      { id: "user-tharaka", name: "Tharaka", email: "tharaka@procurex.test", contactNumber: "0771000004", passwordHash: password, role: "MANAGEMENT_STAFF", level: "SENIOR" },
    ],
  });

  const suppliers = [
    ["sup-buildright", "BuildRight Hardware", "45 Industrial Estate, Colombo", "104567890"],
    ["sup-galle", "Galle Hardware Supplies", "12 Lighthouse Street, Galle", "204567890"],
    ["sup-kandy", "Kandy Steel Traders", "9 Peradeniya Road, Kandy", "304567890"],
    ["sup-cement", "Colombo Cement Distributors", "2 Harbour Road, Colombo", "404567890"],
    ["sup-timber", "Northern Timber Suppliers", "18 KKS Road, Jaffna", "504567890"],
    ["sup-elite", "Elite Electricals", "7 Main Street, Negombo", "604567890"],
    ["sup-paints", "Ceylon Paints (Pvt) Ltd", "30 Duplication Road, Colombo", "704567890"],
    ["sup-lanka", "Lanka Steel Traders", "11 Hill Street, Colombo", "804567890"],
    ["sup-ceylon", "Ceylon Cement Co.", "6 Baseline Road, Colombo", "904567890"],
    ["sup-fittings", "Timber & Fittings Ltd", "4 Rampart Street, Galle", "114567890"],
  ] as const;
  await prisma.supplier.createMany({
    data: suppliers.map(([id, name, address, taxId]) => ({ id, name, address, taxId })),
  });
  await prisma.depot.createMany({
    data: suppliers.map(([id, name]) => ({
      id: `dep-${id}`,
      supplierId: id,
      location: `${name} main depot`,
      contactDetails: "Stores desk",
    })),
  });

  await prisma.catalogItem.createMany({
    data: [
      item("br-cement", "sup-buildright", "Cement bags (50kg)", "bag", 1250),
      item("br-steel", "sup-buildright", "Steel rods (12mm)", "length", 3400),
      item("br-tiles", "sup-buildright", "Floor tiles (60cm)", "box", 2100),
      item("br-timber", "sup-buildright", "Timber planks (2x4)", "length", null),
      item("br-pvc", "sup-buildright", "PVC pipes (4 inch)", "length", 850),
      item("br-hinges", "sup-buildright", "Door hinges (box of 10)", "box", 900),
      item("gh-handles", "sup-galle", "Cabinet handles", "box", 640),
      item("gh-frames", "sup-galle", "Door frames", "each", 4200),
      item("ks-rods", "sup-kandy", "Steel rods (12mm)", "length", 3300),
      item("cc-cement", "sup-cement", "Cement bags (50kg)", "bag", 1180),
      item("nt-beams", "sup-timber", "Timber beams (3m)", "length", 2800),
      item("ee-cable", "sup-elite", "Cable drum (100m)", "drum", 7800),
      item("cp-paint", "sup-paints", "Emulsion paint (20L)", "tin", 6800),
      item("ls-rods", "sup-lanka", "Steel rods (12mm)", "length", 3485),
      item("cy-cement", "sup-ceylon", "Cement bags (50kg)", "bag", 1100),
      item("tf-beams", "sup-fittings", "Timber beams (3m)", "length", 1875),
    ],
  });

  await place({
    reqId: "REQ-2026-0045",
    poId: "PO-2026-0189",
    siteId: "site-colombo",
    supplierId: "sup-buildright",
    createdById: "user-sachintha",
    accountId: "acc-foundation",
    requiredDate: "2026-10-15",
    placedDate: "2026-10-16",
    comments: "Urgent for foundation work",
    listBadge: "APPROVED",
    lines: [
      { itemId: "br-cement", description: "Cement bags (50kg)", qty: 500, price: 280, accepted: 500 },
      { itemId: "br-tiles", description: "Floor tiles (60cm)", qty: 350, price: 300, accepted: 350 },
    ],
    invoice: { id: "INV-2026-0421", number: "SUP-8891", amount: 245_000, qty: 850, status: "PAID", date: "2026-10-18", description: "Cement and tiles" },
    payment: { id: "PAY-2026-0421", amount: 245_000, date: "2026-10-20" },
  });

  await place({
    reqId: "REQ-2026-0056",
    poId: "PO-2026-0234",
    siteId: "site-galle",
    supplierId: "sup-galle",
    createdById: "user-sachintha",
    accountId: "acc-finishes",
    requiredDate: "2026-10-18",
    placedDate: "2026-10-16",
    comments: "Coastal wing ironmongery",
    listBadge: "PENDING",
    lines: [{ itemId: "gh-handles", description: "Cabinet handles", qty: 500, price: 360, accepted: 200 }],
    invoice: { id: "INV-2026-0456", number: "GH-204", amount: 180_000, qty: 500, status: "PENDING", date: "2026-10-19", description: "Cabinet handles" },
  });

  await place({
    reqId: "REQ-2026-0038",
    poId: "PO-2026-0156",
    siteId: "site-kandy",
    supplierId: "sup-kandy",
    createdById: "user-sachintha",
    accountId: "acc-foundation",
    requiredDate: "2026-10-19",
    placedDate: "2026-10-10",
    comments: "",
    listBadge: "HOLD",
    lines: [{ itemId: "ks-rods", description: "Steel rods (12mm)", qty: 400, price: 800, accepted: 400 }],
    invoice: { id: "INV-2026-0508", number: "KS-778", amount: 352_000, qty: 400, status: "ON_HOLD", date: "2026-10-19", description: "Steel rods" },
  });

  await place({
    reqId: "REQ-2026-0022",
    poId: "PO-2026-0078",
    siteId: "site-colombo-b",
    supplierId: "sup-cement",
    createdById: "user-sachintha",
    accountId: "acc-foundation",
    requiredDate: "2026-10-21",
    placedDate: "2026-10-08",
    comments: "",
    listBadge: "HOLD",
    lines: [{ itemId: "cc-cement", description: "Cement bags (50kg)", qty: 800, price: 118.75, accepted: 320 }],
    invoice: { id: "INV-2026-0401", number: "CC-110", amount: 95_000, qty: 800, status: "ON_HOLD", date: "2026-10-18", description: "Cement bags" },
  });

  await place({
    reqId: "REQ-2026-0072",
    poId: "PO-2026-0312",
    siteId: "site-jaffna",
    supplierId: "sup-timber",
    createdById: "user-sachintha",
    accountId: "acc-foundation",
    requiredDate: "2026-10-12",
    placedDate: "2026-10-05",
    comments: "",
    listBadge: "PAID",
    lines: [{ itemId: "nt-beams", description: "Timber beams (3m)", qty: 620, price: 475_000 / 620, accepted: 620 }],
    invoice: { id: "INV-2026-0356", number: "NT-441", amount: 475_000, qty: 620, status: "PAID", date: "2026-10-09", description: "Timber beams" },
    payment: { id: "PAY-2026-0398", amount: 475_000, date: "2026-10-10" },
  });

  await place({
    reqId: "REQ-2026-0080",
    poId: "PO-2026-0302",
    siteId: "site-negombo",
    supplierId: "sup-elite",
    createdById: "user-sachintha",
    accountId: "acc-finishes",
    requiredDate: "2026-10-28",
    placedDate: "2026-10-14",
    comments: "",
    listBadge: "PENDING",
    lines: [{ itemId: "ee-cable", description: "Cable drum (100m)", qty: 200, price: 780, accepted: 100 }],
  });

  await place({
    reqId: "REQ-2026-0088",
    poId: "PO-2026-0345",
    siteId: "site-colombo",
    supplierId: "sup-paints",
    createdById: "user-sachintha",
    accountId: "acc-finishes",
    requiredDate: "2026-10-25",
    placedDate: "2026-10-17",
    comments: "",
    listBadge: "PENDING",
    lines: [{ itemId: "cp-paint", description: "Emulsion paint (20L)", qty: 150, price: 68_000 / 150, accepted: 150 }],
    invoice: { id: "INV-2026-0602", number: "CP-19", amount: 68_000, qty: 150, status: "PENDING", date: "2026-10-19", description: "Emulsion paint" },
  });

  await place({
    reqId: "REQ-2026-0151",
    poId: "PO-2026-0151",
    siteId: "site-colombo",
    supplierId: "sup-buildright",
    createdById: "user-sachintha",
    accountId: "acc-finishes",
    requiredDate: "2026-10-18",
    placedDate: "2026-10-10",
    comments: "",
    listBadge: "APPROVED",
    lines: [{ itemId: "br-hinges", description: "Door hinges (box of 10)", qty: 10, price: 1250, accepted: 0 }],
  });

  await place({
    reqId: "REQ-2026-5040",
    poId: "PO-2026-5040",
    siteId: "site-colombo",
    supplierId: "sup-lanka",
    createdById: "user-sachintha",
    accountId: "acc-foundation",
    requiredDate: "2026-10-26",
    placedDate: "2026-10-12",
    comments: "",
    listBadge: "APPROVED",
    lines: [{ itemId: "ls-rods", description: "Steel rods (12mm)", qty: 100, price: 3485, accepted: 0 }],
  });

  await place({
    reqId: "REQ-2026-5041",
    poId: "PO-2026-5041",
    siteId: "site-colombo",
    supplierId: "sup-ceylon",
    createdById: "user-sachintha",
    accountId: "acc-foundation",
    requiredDate: "2026-10-22",
    placedDate: "2026-10-11",
    comments: "",
    listBadge: "PENDING",
    lines: [{ itemId: "cy-cement", description: "Cement bags (50kg)", qty: 850, price: 187_500 / 850, accepted: 280 }],
  });

  await place({
    reqId: "REQ-2026-0158",
    poId: "PO-2026-0158",
    siteId: "site-galle",
    supplierId: "sup-fittings",
    createdById: "user-sachintha",
    accountId: "acc-finishes",
    requiredDate: "2026-10-10",
    placedDate: "2026-10-06",
    comments: "",
    listBadge: "APPROVED",
    lines: [
      { itemId: "tf-beams", description: "Timber beams (3m)", qty: 50, price: 1875, accepted: 50 },
      { itemId: "gh-frames", description: "Door frames", qty: 20, price: 4687.5, accepted: 20 },
    ],
  });

  await prisma.requisition.create({
    data: {
      id: "REQ-2026-0091",
      siteId: "site-colombo",
      accountId: "acc-foundation",
      createdById: "user-sachintha",
      status: "WAITING_APPROVAL",
      totalValue: 45_000,
      requiredDate: new Date("2026-10-30"),
      submittedDate: new Date("2026-10-19"),
      comments: "Extra steel for the ground beam",
      allocatedBudget: 5_000_000,
      lines: {
        create: [
          line("rl-91-a", "br-steel", "sup-buildright", "Steel rods (12mm)", 10, 3400, true),
          line("rl-91-b", "br-pvc", "sup-buildright", "PVC pipes (4 inch)", 12, 850, true),
        ],
      },
    },
  });

  await prisma.requisition.create({
    data: {
      id: "REQ-2026-0092",
      siteId: "site-colombo",
      accountId: "acc-finishes",
      createdById: "user-sachintha",
      status: "DRAFT",
      totalValue: 6_300,
      requiredDate: new Date("2026-11-02"),
      comments: "",
      allocatedBudget: 2_000_000,
      lines: { create: [line("rl-92", "br-tiles", "sup-buildright", "Floor tiles (60cm)", 3, 2100, true)] },
    },
  });

  await prisma.requisition.create({
    data: {
      id: "REQ-2026-0093",
      siteId: "site-colombo",
      accountId: "acc-foundation",
      createdById: "user-sachintha",
      status: "ON_HOLD",
      totalValue: 2_500,
      requiredDate: new Date("2026-10-29"),
      submittedDate: new Date("2026-10-18"),
      comments: "Price missing on timber",
      allocatedBudget: 5_000_000,
      lines: {
        create: [
          line("rl-93-a", "br-cement", "sup-buildright", "Cement bags (50kg)", 2, 1250, true),
          line("rl-93-b", "br-timber", "sup-buildright", "Timber planks (2x4)", 8, 0, false),
        ],
      },
    },
  });
}

function item(id: string, supplierId: string, description: string, unitOfMeasure: string, agreedPrice: number | null) {
  return { id, supplierId, description, unitOfMeasure, agreedPrice, isRestricted: false };
}

function line(id: string, itemId: string, supplierId: string, description: string, quantity: number, price: number, priced: boolean) {
  return {
    id,
    itemId,
    supplierId,
    description,
    quantity,
    negotiatedPrice: price,
    isPriceValid: priced,
    approved: false,
  };
}

interface SeedOrder {
  reqId: string;
  poId: string;
  siteId: string;
  supplierId: string;
  createdById: string;
  accountId: string;
  requiredDate: string;
  placedDate: string;
  comments: string;
  listBadge: string;
  lines: { itemId: string; description: string; qty: number; price: number; accepted: number }[];
  invoice?: { id: string; number: string; amount: number; qty: number; status: string; date: string; description: string };
  payment?: { id: string; amount: number; date: string };
}

async function place(input: SeedOrder) {
  const total = input.lines.reduce((sum, entry) => sum + entry.qty * entry.price, 0);
  const accepted = input.lines.reduce((sum, entry) => sum + entry.accepted, 0);
  const ordered = input.lines.reduce((sum, entry) => sum + entry.qty, 0);
  const fulfillment = accepted >= ordered && ordered > 0 ? "FULLY_DELIVERED" : accepted > 0 ? "PARTIALLY_DELIVERED" : "PLACED";
  await prisma.requisition.create({
    data: {
      id: input.reqId,
      siteId: input.siteId,
      accountId: input.accountId,
      createdById: input.createdById,
      status: "APPROVED",
      totalValue: total,
      requiredDate: new Date(input.requiredDate),
      submittedDate: new Date(input.placedDate),
      comments: input.comments,
      allocatedBudget: 5_000_000,
      lines: {
        create: input.lines.map((entry, index) => ({
          id: `${input.reqId}-L${index + 1}`,
          itemId: entry.itemId,
          supplierId: input.supplierId,
          description: entry.description,
          quantity: entry.qty,
          negotiatedPrice: entry.price,
          isPriceValid: true,
          approved: true,
        })),
      },
    },
  });
  await prisma.purchaseOrder.create({
    data: {
      id: input.poId,
      requisitionId: input.reqId,
      supplierId: input.supplierId,
      status: fulfillment,
      listBadge: input.listBadge,
      deliveryAddress: "Site delivery",
      paymentLocked: Boolean(input.payment),
      placedDate: new Date(input.placedDate),
      lines: {
        create: input.lines.map((entry, index) => ({
          id: `${input.poId}-L${index + 1}`,
          itemId: entry.itemId,
          requisitionLineId: `${input.reqId}-L${index + 1}`,
          description: entry.description,
          quantityOrdered: entry.qty,
          cumulativeAcceptedQty: entry.accepted,
          unitPrice: entry.price,
        })),
      },
    },
  });
  if (accepted > 0) {
    await prisma.deliveryRecord.create({
      data: {
        id: `del-${input.poId}`,
        poId: input.poId,
        siteManagerId: input.createdById,
        timestamp: new Date(input.placedDate),
        supplierDeliveryNoteRef: `DN-${input.poId}`,
        note: "",
        lines: {
          create: input.lines.flatMap((entry, index) =>
            entry.accepted > 0
              ? [
                  {
                    id: `dl-${input.poId}-${index + 1}`,
                    poLineId: `${input.poId}-L${index + 1}`,
                    quantityReceived: entry.accepted,
                    condition: "ACCEPTED",
                  },
                ]
              : [],
          ),
        },
      },
    });
  }
  if (input.invoice) {
    await prisma.invoice.create({
      data: {
        id: input.invoice.id,
        poId: input.poId,
        supplierId: input.supplierId,
        invoiceNumber: input.invoice.number,
        invoiceDate: new Date(input.invoice.date),
        totalAmount: input.invoice.amount,
        payableAmount: input.payment?.amount ?? input.invoice.amount,
        invoiceQuantity: input.invoice.qty,
        itemDescription: input.invoice.description,
        status: input.invoice.status,
        processedById: "user-pasan",
      },
    });
  }
  if (input.payment && input.invoice) {
    await prisma.payment.create({
      data: {
        id: input.payment.id,
        invoiceId: input.invoice.id,
        poId: input.poId,
        paidAmount: input.payment.amount,
        paymentDate: new Date(input.payment.date),
        paymentMethod: "Bank transfer",
        paymentReference: input.payment.id,
        processedById: "user-pasan",
        status: "PAID",
      },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
