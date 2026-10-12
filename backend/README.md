# CRM Backend

Express 5 + TypeScript REST API at `/api/v1`, backed by PostgreSQL through Prisma 7. Multi-tenant: every tenant route is scoped to the caller's organization.

## Quick Start

```bash
cd backend
npm install
cp .env.example .env.development   # fill in the values
npm run prisma:migrate
npm run seed && npm run seed:plans
npm run dev                        # http://localhost:5000, health check at /health
```

Environment variables and every npm script: [docs/development-workflow.md](docs/development-workflow.md).

## Docs

1. [architecture.md](docs/architecture.md) — stack, middleware pipeline, tenancy, authorization, billing
2. [folder-structure.md](docs/folder-structure.md) — `src/` layout and module convention
3. [coding-guidelines.md](docs/coding-guidelines.md) — layer boundaries, middleware order, tenant safety, uploads
4. [api-spec.md](docs/api-spec.md) — every route with permission, schema, and response
5. [authentication.md](docs/authentication.md) — signup, login, refresh rotation, password reset, CSRF, rate limits
6. [database.md](docs/database.md) — models, relations, constraints, migrations
7. [error-handling.md](docs/error-handling.md) — `AppError`, error JSON, Prisma mapping
8. [scheduled-jobs.md](docs/scheduled-jobs.md) — follow-up scheduler, job endpoint, token cleanup
9. [dashboard-report-formulas.md](docs/dashboard-report-formulas.md) — how dashboard and report numbers are computed
10. [development-workflow.md](docs/development-workflow.md) — setup, environment, commands

Migrations not yet applied to production live in `prisma/release-*-pending/`; each folder's README is its release runbook.
