# Architecture

The repo is an npm workspace. `npm run dev` starts both Next.js apps through Turbo.

```text
app/
  apps/web/          ProcureX office app, port 3000, and the shared API
  apps/pwa/          SiteFlow phone app, port 3001
  packages/domain/   requisitions, orders, invoices, and the five patterns
  packages/db/       Prisma, SQLite, seed data, and the service functions
  packages/ui/       shared controls and formatting
  design/            wireframes and the original screen notes
  docs/              this documentation
```

## Request path

The phone app calls `http://localhost:3000` with a bearer token kept in `sessionStorage`. The office app calls the same API with the `procurex_session` cookie.

`apps/web/app/api/v1/[...path]/route.ts` forwards to `apps/web/src/server/handle.ts`. That handler calls functions in `packages/db/src/services.ts`. Those functions load rows, run a domain object (`RequisitionWorkflow`, `PurchaseOrder`, `Invoice`, `PurchaseOrderFactory`), then save the new status.

Domain classes do not import Prisma. The service layer is the only place that writes the database, including `Notification` rows from domain events.

## Roles

| Email | App | Role |
| --- | --- | --- |
| sachintha@procurex.test | SiteFlow, port 3001 | Site manager |
| pasan@procurex.test | ProcureX, port 3000 | Procurement |
| jayamadhuka@procurex.test | ProcureX, port 3000 | Operational manager |
| tharaka@procurex.test | ProcureX, port 3000 | Senior manager |

Password for every demo account is `demo1234`.

## Data

SQLite lives at `packages/db/prisma/dev.db`. The schema is `packages/db/prisma/schema.prisma`. Document numbers are `REQ-2026-####`, `PO-2026-####`, `INV-2026-####`, and `PAY-2026-####`. Amounts are rupees.

`ApprovalPolicy` is a single row, `id = "default"`. The office Settings screen edits the two limits. The strategy objects read that row when a requisition is submitted or released from hold.
