# CRM

Multi-tenant CRM for sales teams: leads → prospects → quotations → customers, with follow-up reminders, reports, announcements, and plan-based billing.

Each organization (tenant) has its own users, catalog, and sales data. Roles:

| Role | Scope |
| --- | --- |
| `SUPER_ADMIN` | Platform operator: organizations, plans and billing, platform settings, announcements; can open any tenant's workspace |
| `ADMIN` | Runs one organization: users, items, all CRM data, settings, reports, audit log |
| `MANAGER` | Their own work plus their executives' |
| `EXECUTIVE` | Records assigned to them |

## Repository Layout

```text
backend/    Express 5 + TypeScript + Prisma 7 (PostgreSQL) REST API at /api/v1
frontend/   React 19 + Vite 7 SPA (TanStack Query, Redux for auth only, Tailwind v4)
```

Each side has its own `package.json`, README, and `docs/` folder.

## Quick Start

```bash
# 1. API on http://localhost:5000
cd backend
npm install
cp .env.example .env.development   # fill in DATABASE_URL, JWT secrets, ...
npm run prisma:migrate
npm run seed && npm run seed:plans
npm run dev

# 2. App on http://localhost:5173 (in a second terminal)
cd frontend
npm install
npm run dev
```

Details: [backend/docs/development-workflow.md](backend/docs/development-workflow.md) and [frontend/docs/development-workflow.md](frontend/docs/development-workflow.md).

## Sales Lifecycle

1. **Setup.** An organization is created by self-service signup (subscribed to the default plan, with a trial if that plan has one) or by the super admin. Its admin adds users and the product/service catalog (items).
2. **Lead.** Created manually or by import, assigned to an executive, and worked through `NEW` → `ATTEMPTED_CONTACT` → `CONTACTED` → `QUALIFIED` or `UNQUALIFIED`. Calls, emails, meetings, and notes go on the lead's activity timeline.
3. **Prospect.** Only a `QUALIFIED` lead converts, producing exactly one prospect linked to it. Stages: `REQUIREMENT` → `FOLLOW_UP` → `DEMO` → `PROPOSAL` → `NEGOTIATION` → `WON` or `LOST` (both terminal). A prospect has at most one pending follow-up; reminders and overdue alerts arrive as notifications.
4. **Quotation.** Built from catalog items, optionally linked to a prospect, numbered `<ORG-PREFIX>-QT-<year>-0001`. Status: `PENDING` → `APPROVED` or `REJECTED`.
5. **Customer.** A `WON` prospect. There is no separate customer record.

| Term in the UI | Value in code | Note |
| --- | --- | --- |
| Quote (stage) | `PROPOSAL` | Display label only |
| Qualified / Unqualified | `QUALIFIED` / `UNQUALIFIED` | Lead status |
| Converted | `Lead.convertedAt` set | Derived; not a lead status |
| Customer | `Prospect.stage = WON` | Derived; not a separate model |

## Documentation

Each doc owns one topic; others link to it rather than repeating it.

**Backend** ([backend/README.md](backend/README.md))

| Doc | Covers |
| --- | --- |
| [architecture.md](backend/docs/architecture.md) | Stack, middleware pipeline, tenancy, authorization, billing |
| [api-spec.md](backend/docs/api-spec.md) | Every route: method, permission, schema, response |
| [authentication.md](backend/docs/authentication.md) | Signup, login, refresh rotation, password reset, CSRF, rate limits |
| [database.md](backend/docs/database.md) | Prisma models, relations, constraints, migrations |
| [error-handling.md](backend/docs/error-handling.md) | `AppError`, error JSON, Prisma mapping, denial audit |
| [scheduled-jobs.md](backend/docs/scheduled-jobs.md) | Follow-up scheduler, job endpoint, token cleanup |
| [dashboard-report-formulas.md](backend/docs/dashboard-report-formulas.md) | How dashboard and report numbers are computed |
| [coding-guidelines.md](backend/docs/coding-guidelines.md) | Layer boundaries, middleware order, tenant safety |
| [folder-structure.md](backend/docs/folder-structure.md) | `src/` layout and module convention |
| [development-workflow.md](backend/docs/development-workflow.md) | Setup, environment variables, npm scripts |

Pending migration runbooks: [release-2-pending](backend/prisma/release-2-pending/README.md), [release-activity-3-pending](backend/prisma/release-activity-3-pending/README.md).

**Frontend** ([frontend/README.md](frontend/README.md) lists the docs in reading order): architecture, folder structure, API layer, auth, state management, components, error handling, coding guidelines, development workflow.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
