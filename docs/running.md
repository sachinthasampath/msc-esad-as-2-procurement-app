# Running

Install first. See [Installation](installation.md).

## Both apps

From the repository root:

```bash
npm run dev
```

Turbo starts:

- ProcureX office: http://localhost:3000
- SiteFlow phone: http://localhost:3001

Leave that terminal open. Stop it with Ctrl+C.

Sign in with any row below. The password for every account is `demo1234`.

| Email | Where to sign in |
| --- | --- |
| sachintha@procurex.test | http://localhost:3001 |
| pasan@procurex.test | http://localhost:3000 |
| jayamadhuka@procurex.test | http://localhost:3000 |
| tharaka@procurex.test | http://localhost:3000 |

The office login form starts on Pasan’s email with the demo password filled in. The phone login form starts on Sachintha’s email the same way.

The phone app refuses an office account. The office dashboard refuses a site manager. Use the app that matches the role.

On this machine, `localhost` cookies are shared across ports. If you sign into the phone app in the same browser profile as the office app, the office session becomes the site manager and the dashboard tells you to use port 3001. Sign in again on port 3000, or use a separate browser profile for the phone app.

## One app at a time

```bash
npm run dev -w @procurex/web
npm run dev -w @procurex/pwa
```

The phone app still needs the office app, because the API is served by `apps/web` on port 3000.

## Tests

Domain rules, including the five patterns, are covered by Vitest:

```bash
npm test
```

That runs `packages/domain/test/domain.test.ts` only. It does not need the database.

## Production build

```bash
npm run build
npm run start -w @procurex/web
npm run start -w @procurex/pwa
```

`build` compiles both Next.js apps. `start` serves the office app on port 3000 and the phone app on port 3001. Run `db:setup` before the first start so `dev.db` exists.

## What to click for the patterns

- **Strategy.** Submit a small priced requisition on the phone. It becomes approved without a manager. A total between the two Settings limits waits for Jayamadhuka. A total above the manager limit is referred to Tharaka. Change the limits on Settings and submit again.
- **State.** Cancel is refused after approval. A fully delivered purchase order refuses another receipt.
- **Factory.** Approve a requisition whose lines use two suppliers. The office purchase-order list shows one PO per supplier.
- **Observer.** Record a delivery that completes a purchase order. Reload the office dashboard. The notice says that PO is ready for invoice. Return a waiting requisition with a comment. Reload the phone home as the site manager who created it.
- **Chain of Responsibility.** Enter an invoice against a delivered PO. The invoice screen reports match, partial, or mismatch from the handler chain.
