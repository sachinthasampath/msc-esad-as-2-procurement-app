# Design system

Tokens are taken from the ProcureX high-fidelity screens. Both apps import the same CSS variables and the shared controls. Admin-only and PWA-only components stay in their own apps and compose the shared ones.

## Colour

| Token | Value | Use |
| --- | --- | --- |
| `--px-navy` | `#0e1726` | Sidebar, primary text on light surfaces |
| `--px-navy-2` | `#162033` | Sidebar hover |
| `--px-blue` | `#2563eb` | Active nav, links, focus ring |
| `--px-canvas` | `#f3f6fb` | Page background |
| `--px-surface` | `#ffffff` | Cards, tables, sheets |
| `--px-line` | `#e6ebf2` | Borders |
| `--px-muted` | `#64748b` | Secondary text |
| `--px-success` | `#16a34a` | Approved, paid, fully delivered |
| `--px-success-bg` | `#e8f8ee` | Success pill and match tile |
| `--px-warning` | `#d97706` | Pending, hold, partial |
| `--px-warning-bg` | `#fff6e8` | Warning pill and match tile |
| `--px-danger` | `#dc2626` | Overdue, mismatch, decline |
| `--px-danger-bg` | `#fdecec` | Danger pill and invoice tile |
| `--px-info` | `#2563eb` | Placed |
| `--px-info-bg` | `#e8f0fe` | Placed pill |

Status pills:

- Green: Approved, Paid, Fully delivered, Match.
- Amber: Pending, On hold, Partially delivered, Partial, Waiting approval.
- Red: Overdue, Declined, Mismatch, Rejected.
- Blue: Placed, Referred.
- Neutral: Draft, Cancelled.

## Type and shape

- Font: `Segoe UI`, `Inter`, system sans-serif.
- Page title 22px semibold. Section label 13px medium. Table text 14px.
- Radius: controls 10px, cards 14px, pills 999px, modals 16px.
- Shadow: `0 8px 30px rgba(15, 23, 42, 0.08)` on modals and phone sheets.
- Sidebar width 248px. Content padding 28px.
- Mobile shell max width 420px, centred on large screens, with a light phone-like background.

## Shared components (`packages/ui`)

- `Button` — primary (navy), secondary (white), danger, ghost.
- `TextField`, `Select`, `SearchField`.
- `StatusBadge` — one component, tone chosen from the status string.
- `Money` — formats with `Rs.` and Indian grouping (`Rs. 2,45,000`), matching the wireframes.
- `Modal` — title, close, body, footer actions.
- `ProgressBar` — ordered vs delivered.

## Admin components (`apps/web`)

- `AppShell` — sidebar groups and the top bar.
- `PageHeader` — title, subtitle, search, Export, primary action.
- `DataTable` — columns, row click.
- `FilterChips`.
- `StatCard`.
- `MatchTrio` — purchase order, goods receipt, invoice tiles.
- `DiscrepancyBanner`.

## PWA components (`apps/pwa`)

- `MobileShell`, `BottomNav`.
- `SegmentedTabs`.
- `OrderCard`.
- `RequisitionSheet`.
- `DeliverySheet`.
- `OfflineBanner`.

## Sample names to keep visible

Colombo Site A, Galle Coastal Wing, Kandy Riverside, BuildRight Hardware, Galle Hardware Supplies, Kandy Steel Traders, REQ-2026-0045, PO-2026-0189, INV-2026-0421. Seed data uses these so a walkthrough matches the handout.
