# ProcureX

SiteFlow procurement simulator for the SE5060 case study. The site-manager phone app and the ProcureX office app share one API.

## Run

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

Design notes for the walkthrough are in `design/`.
