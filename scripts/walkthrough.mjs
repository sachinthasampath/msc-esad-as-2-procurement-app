// Changes demo data. Restore the handout with: npm run db:seed
const base = "http://localhost:3000";

async function call(path, { method = "GET", token, body } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error ?? response.statusText);
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function login(email) {
  const result = await call("/api/v1/auth/login", {
    method: "POST",
    body: { email, password: "demo1234" },
  });
  return result.token;
}

const checks = [];
function ok(name, pass, detail) {
  checks.push({ name, pass, detail });
  if (!pass) throw new Error(`${name}: ${detail}`);
}

const manager = await login("jayamadhuka@procurex.test");
const approved = await call("/api/v1/requisitions/REQ-2026-0091/decision", {
  method: "POST",
  token: manager,
  body: { action: "approve", comment: "Approved for the ground beam" },
});
ok("manager approve splits one PO", approved.status === "APPROVED" && approved.purchaseOrders.length === 1, approved.status);

const procurement = await login("pasan@procurex.test");
const policy = await call("/api/v1/settings", {
  method: "PUT",
  token: procurement,
  body: { autoApproveLimit: 80000, managerLimit: 200000 },
});
ok("settings saved", policy.autoApproveLimit === 80000, JSON.stringify(policy));

const sachintha = await login("sachintha@procurex.test");
const sites = await call("/api/v1/sites", { token: sachintha });
const accounts = await call("/api/v1/accounts", { token: sachintha });
const draft = {
  siteId: sites[0].id,
  accountId: accounts[0].id,
  requiredDate: "2026-11-01",
  comments: "Walkthrough",
};

const auto = await call("/api/v1/requisitions", {
  method: "POST",
  token: sachintha,
  body: { ...draft, lines: [{ itemId: "br-steel", quantity: 20 }] },
});
const autoSubmitted = await call(`/api/v1/requisitions/${auto.id}/submit`, {
  method: "POST",
  token: sachintha,
  body: { online: true },
});
ok("68000 auto-approves under the new band", autoSubmitted.status === "APPROVED", autoSubmitted.status);

const mid = await call("/api/v1/requisitions", {
  method: "POST",
  token: sachintha,
  body: { ...draft, requiredDate: "2026-11-02", lines: [{ itemId: "br-steel", quantity: 40 }] },
});
const midSubmitted = await call(`/api/v1/requisitions/${mid.id}/submit`, {
  method: "POST",
  token: sachintha,
  body: { online: true },
});
ok("136000 waits for a manager", midSubmitted.status === "WAITING_APPROVAL", midSubmitted.status);

let offlineBlocked = false;
try {
  const offline = await call("/api/v1/requisitions", {
    method: "POST",
    token: sachintha,
    body: { ...draft, requiredDate: "2026-11-04", lines: [{ itemId: "br-pvc", quantity: 1 }] },
  });
  await call(`/api/v1/requisitions/${offline.id}/submit`, {
    method: "POST",
    token: sachintha,
    body: { online: false },
  });
} catch (error) {
  offlineBlocked = String(error.message).includes("online");
}
ok("offline submit is blocked", offlineBlocked, "expected an online error");

const held = await call("/api/v1/requisitions", {
  method: "POST",
  token: sachintha,
  body: {
    ...draft,
    requiredDate: "2026-11-05",
    lines: [
      { itemId: "br-cement", quantity: 1 },
      { itemId: "br-timber", quantity: 2 },
    ],
  },
});
const heldSubmitted = await call(`/api/v1/requisitions/${held.id}/submit`, {
  method: "POST",
  token: sachintha,
  body: { online: true },
});
ok("unpriced line is held", heldSubmitted.status === "ON_HOLD", heldSubmitted.status);
await call("/api/v1/catalogue/br-timber/price", { method: "POST", token: procurement, body: { price: 900 } });
const released = await call(`/api/v1/requisitions/${held.id}`, { token: sachintha });
ok("pricing a held line routes it", released.status === "APPROVED" || released.status === "WAITING_APPROVAL", released.status);

const poId = autoSubmitted.purchaseOrders[0].id;
const order = await call(`/api/v1/purchase-orders/${poId}`, { token: sachintha });
await call(`/api/v1/purchase-orders/${poId}/deliveries`, {
  method: "POST",
  token: sachintha,
  body: {
    note: "First drop",
    lines: [{ poLineId: order.lines[0].id, quantity: 5, condition: "ACCEPTED" }],
  },
});
const partial = await call(`/api/v1/purchase-orders/${poId}`, { token: sachintha });
ok("partial delivery stays open", partial.status === "PARTIALLY_DELIVERED", partial.status);

const invoice = await call("/api/v1/invoices", {
  method: "POST",
  token: procurement,
  body: {
    poId,
    invoiceNumber: "WALK-1",
    invoiceDate: "2026-10-20",
    totalAmount: partial.amount,
    invoiceQuantity: partial.orderedQty,
    itemDescription: "Steel rods",
    notes: "",
  },
});
ok("early full invoice is a partial match", invoice.match.outcome === "PARTIAL_DELIVERY", invoice.match.outcome);
const approvedInvoice = await call(`/api/v1/invoices/${invoice.id}/actions`, {
  method: "POST",
  token: procurement,
  body: { action: "approve-partial" },
});
const paid = await call(`/api/v1/invoices/${invoice.id}/actions`, {
  method: "POST",
  token: procurement,
  body: { action: "pay" },
});
ok("partial approval can be paid", paid.status === "PAID" && paid.payableAmount < paid.amount, `${paid.status} ${paid.payableAmount}`);

let paidBlocked = false;
try {
  await call(`/api/v1/invoices/INV-2026-0508/actions`, {
    method: "POST",
    token: procurement,
    body: { action: "pay" },
  });
} catch (error) {
  paidBlocked = String(error.message).toLowerCase().includes("hold") || String(error.message).toLowerCase().includes("approved");
}
ok("held invoice cannot be paid", paidBlocked, "expected a payment block");

console.log(JSON.stringify({ ok: checks.every((item) => item.pass), checks, voidApproved: approvedInvoice.status }, null, 2));
