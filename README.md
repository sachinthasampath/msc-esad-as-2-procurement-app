# ProcureX

SiteFlow procurement simulator for the SE5060 case study. The site-manager phone app and the ProcureX office app share one API and one SQLite database.

## Documentation

| Guide | |
| --- | --- |
| [Install](docs/installation.md) | Node, `npm install`, and the first database |
| [Run](docs/running.md) | Dev servers, demo accounts, tests |
| [Architecture](docs/architecture.md) | Apps, packages, and the request path |
| [Planning](docs/planning.md) | Why the five design patterns sit where they do |
| [Design patterns](docs/design-patterns.md) | The classes that implement them |

Wireframes and the original screen notes are in [`design/`](design/).

## Quick start

```bash
npm install
npm run db:setup
npm run dev
```

- Office app: http://localhost:3000
- Site manager app: http://localhost:3001

Password for every demo account is `demo1234`.

| Email | Role |
| --- | --- |
| sachintha@procurex.test | Sachintha · Site manager (phone) |
| pasan@procurex.test | Pasan · Procurement |
| jayamadhuka@procurex.test | Jayamadhuka · Operational manager |
| tharaka@procurex.test | Tharaka · Senior manager |
