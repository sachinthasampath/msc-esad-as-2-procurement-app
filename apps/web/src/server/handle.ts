import { NextResponse } from "next/server";
import { DomainError, ForbiddenError } from "@procurex/domain";
import * as api from "@procurex/db";
import { AuthError } from "@procurex/db";

const origin = process.env.PWA_ORIGIN ?? "http://localhost:3001";

function tokenFrom(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|; )procurex_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function json(data: unknown, status = 200, extraHeaders?: HeadersInit) {
  const response = NextResponse.json(data, { status, headers: extraHeaders });
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  return response;
}

export async function handle(request: Request, parts: string[]) {
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
      },
    });
  }
  const token = tokenFrom(request);
  const [resource, id, action] = parts;
  try {
    const body = async () => (request.method === "GET" ? {} : await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
      online?: boolean;
      price?: number;
      [key: string]: unknown;
    };
    if (resource === "auth" && id === "login" && request.method === "POST") {
      const input = await body();
      const result = await api.login(input.email ?? "", input.password ?? "");
      return json(result, 200, {
        "Set-Cookie": `procurex_session=${result.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`,
      });
    }
    if (resource === "auth" && id === "logout" && request.method === "POST") {
      await api.logout(token);
      return json({ ok: true }, 200, { "Set-Cookie": "procurex_session=; Path=/; HttpOnly; Max-Age=0" });
    }
    if (resource === "auth" && id === "me" && request.method === "GET") {
      return json(api.publicUser(await api.requireUser(token)));
    }
    if (resource === "requisitions" && request.method === "GET" && !id) return json(await api.listRequisitions(token));
    if (resource === "requisitions" && request.method === "POST" && !id) return json(await api.createRequisition(token, await body() as never));
    if (resource === "requisitions" && id && request.method === "GET") return json(await api.getRequisition(token, id));
    if (resource === "requisitions" && id && request.method === "PATCH") return json(await api.updateRequisition(token, id, await body() as never));
    if (resource === "requisitions" && id && action === "submit" && request.method === "POST") {
      const input = await body();
      return json(await api.submitRequisition(token, id, input.online !== false));
    }
    if (resource === "requisitions" && id && action === "cancel" && request.method === "POST") return json(await api.cancelRequisition(token, id));
    if (resource === "requisitions" && id && action === "decision" && request.method === "POST") {
      return json(await api.decideRequisition(token, id, await body() as never));
    }
    if (resource === "purchase-orders" && request.method === "GET" && !id) return json(await api.listPurchaseOrders(token));
    if (resource === "purchase-orders" && id && action === "deliveries" && request.method === "POST") {
      return json(await api.logDelivery(token, id, await body() as never));
    }
    if (resource === "purchase-orders" && id && request.method === "GET") return json(await api.getPurchaseOrder(token, id));
    if (resource === "deliveries" && request.method === "GET") return json(await api.listDeliveries(token));
    if (resource === "invoices" && request.method === "GET" && !id) return json(await api.listInvoices(token));
    if (resource === "invoices" && request.method === "POST" && !id) return json(await api.createInvoice(token, await body() as never));
    if (resource === "invoices" && id && action === "actions" && request.method === "POST") {
      return json(await api.invoiceAction(token, id, await body() as never));
    }
    if (resource === "payments" && request.method === "GET") return json(await api.listPayments(token));
    if (resource === "dashboard" && request.method === "GET") return json(await api.dashboard(token));
    if (resource === "reports" && request.method === "GET") return json(await api.reports(token));
    if (resource === "settings" && request.method === "GET") return json(await api.getSettings(token));
    if (resource === "settings" && request.method === "PUT") return json(await api.updateSettings(token, await body() as never));
    if (resource === "catalogue" && request.method === "GET" && !id) {
      const supplierId = new URL(request.url).searchParams.get("supplierId") ?? undefined;
      return json(await api.listCatalogue(token, supplierId));
    }
    if (resource === "catalogue" && id && action === "price" && request.method === "POST") {
      const input = await body();
      return json(await api.setCataloguePrice(token, id, Number(input.price)));
    }
    if (resource === "suppliers" && request.method === "GET") return json(await api.listSuppliers(token));
    if (resource === "sites" && request.method === "GET") return json(await api.listSites(token));
    if (resource === "accounts" && request.method === "GET") return json(await api.listAccounts(token));
    if (resource === "managers" && request.method === "GET") return json(await api.listManagers(token));
    return json({ error: "Not found" }, 404);
  } catch (error) {
    const status = error instanceof AuthError ? 401 : error instanceof ForbiddenError ? 403 : error instanceof DomainError ? 400 : 500;
    const message = error instanceof Error ? error.message : "Something went wrong";
    if (status === 500) console.error(error);
    return json({ error: message }, status);
  }
}
