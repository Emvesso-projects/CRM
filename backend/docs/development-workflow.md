# Development Workflow

## Local Setup

```bash
cd backend
npm install
cp .env.example .env.development   # then fill in the values below
npm run prisma:generate
npm run prisma:migrate             # or: npm run db:migrate:pooled (see Supabase note)
npm run seed                       # super admin from SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD
npm run seed:plans                 # plan catalog + default signup plan
npm run dev
```

The backend defaults to port `5000`. `NODE_ENV` selects which file is loaded: `.env.development` or `.env.production`.

## Environment

Validated at boot by `src/config/env.ts`; the server refuses to start if a required value is missing or malformed.

| Variable | Notes |
| --- | --- |
| `NODE_ENV` | `development` or `production`; selects `.env.development` or `.env.production` |
| `PORT` | Defaults to `5000` |
| `DATABASE_URL` | PostgreSQL URL (Supabase pooler on IPv4-only networks — see [database.md](database.md#supabase-connectivity)) |
| `DIRECT_URL` | Optional direct database URL for Prisma CLI workflows |
| `JWT_SECRET` | At least 32 characters |
| `JWT_REFRESH_SECRET` | At least 32 characters |
| `JWT_ACCESS_EXPIRY` | Duration like `15m` |
| `JWT_REFRESH_EXPIRY` | Duration like `7d` |
| `CORS_ORIGIN` | Comma-separated allowed frontend origins; defaults to `http://localhost:5173` |
| `INTERNAL_JOB_SECRET` | Optional, at least 32 characters. Internal job routes fail closed when unset |
| `RESEND_API_KEY` | Optional for boot, but without it signup and password-reset codes cannot be sent. All email goes through Resend's HTTP API; there is no SMTP |
| `RESEND_FROM_ADDRESS` | Bare sender address on a domain verified in Resend. The default `onboarding@resend.dev` only delivers to the Resend account owner |
| `RESEND_FROM_NAME` | Sender display name; defaults to `CRM Support` |
| `LOG_LEVEL` | Defaults to `info` |
| `APP_TIMEZONE` | Business timezone for follow-up due times and day windows; defaults to `Asia/Kolkata` |
| `ENABLE_IN_PROCESS_SCHEDULER` | Defaults to on; set `false` to disable the `node-cron` follow-up scheduler ([scheduled-jobs.md](scheduled-jobs.md)) |
| `SCHEDULER_CRON_EXPRESSION` | Defaults to `* * * * *` |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Optional; required for plan payments |
| `RAZORPAY_WEBHOOK_SECRET` | Optional; the Razorpay webhook rejects every call without it |
| `STORAGE_PROVIDER` | `local` (default, files under `uploads/`) or `r2` |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_CUSTOM_DOMAIN` | Required in production when `STORAGE_PROVIDER=r2` |
| `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` | Read only by `npm run seed`, not by the server |

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | `tsx watch` dev server (runs `prisma generate` first) |
| `npm run build` | Generates the Prisma client, removes `dist`, compiles TypeScript |
| `npm run start` | Runs the compiled server with `NODE_ENV=production` |
| `npm test` | Vitest unit tests (`*.test.ts` next to the code) |
| `npm run prisma:generate` | Generates the Prisma client |
| `npm run prisma:migrate` | `prisma migrate dev` against `DIRECT_URL` |
| `npm run prisma:status` | Migration status |
| `npm run prisma:studio` / `prisma:studio:prod` | Prisma Studio on the dev / prod env file |
| `npm run db:migrate:pooled` / `db:migrate:pooled:prod` | Applies pending migrations through the Supabase pooler, writing Prisma's bookkeeping rows. Supports `--dry-run`. This is the production migration path |
| `npm run db:check:activity` / `db:check:activity:prod` | Pre-flight checks for the `release-activity-3-pending` migration |
| `npm run seed` | Creates the super admin |
| `npm run seed:plans` | Seeds the plan catalog and sets the default signup plan if unset |
| `npm run db:inspect-plans` | Prints plans and features |
| `npm run storage:reconcile` | Finds stale temp uploads and unreferenced files. Dry run by default; `--prune`, `--all` |

On a developer machine the `:prod` scripts load `.env.production`, which points at **staging**; production commands run on the production server.

## Feature Delivery Order

1. Update Prisma models and migrations if persistence changes.
2. Update contract constants, types, and validation schemas.
3. Add or adjust repository methods.
4. Implement service rules, tenant checks, transactions, and audit events.
5. Wire controller response handling.
6. Wire route path, middleware order, permissions, and validation.
7. Update frontend contracts/API calls if the contract changed.
8. Update the owning doc (see the docs index in the [backend README](../README.md)).
9. Run `npm run build` and `npm test`.
