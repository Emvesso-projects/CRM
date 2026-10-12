# Backend Architecture

## Stack

- Node.js with Express 5.
- TypeScript.
- PostgreSQL with Prisma 7 and `@prisma/adapter-pg`.
- Zod for request validation.
- JWT access and refresh tokens, HTTP-only refresh cookie.
- Winston logger with Morgan request logging.
- File storage on local disk (`uploads/`) or Cloudflare R2, selected by `STORAGE_PROVIDER`.
- Razorpay for plan payments; Resend (HTTP API) for email.

## Application Pipeline

`src/app.ts` defines the middleware and route order:

1. `GET /health` checks database connectivity with `SELECT 1`.
2. Morgan request logging streams to Winston.
3. Helmet security headers with CSP disabled.
4. Compression, cookie parser, and JSON parser (`jsonBodyParserExcept` — skips the billing webhook, which needs its raw body).
5. CORS with `credentials: true` and `env.CORS_ORIGIN`.
6. `/uploads` static files with cross-origin resource policy override.
7. `/api/v1/internal` job routes — before CSRF and rate limiting; guarded by `requireInternalSecret`.
8. `/api/v1/billing/webhook` Razorpay webhook — before CSRF and rate limiting; guarded by HMAC signature.
9. `csrfProtection`.
10. `apiLimiter`.
11. Versioned `/api/v1/*` routers (full list in [api-spec.md](api-spec.md)).
12. `cleanupUploadsOnError`.
13. Global `errorHandler`.

## Module Layers

Each business module follows the route-controller-service-repository split when it has persistence:

- `*.route.ts`: paths and middleware chain.
- `*.controller.ts`: HTTP boundary and response envelope.
- `*.service.ts`: business rules, authorization, cross-entity checks.
- `*.repository.ts`: Prisma access.
- Contracts live in `src/contracts/*`.

Layer rules are in [coding-guidelines.md](coding-guidelines.md); the module list is in [folder-structure.md](folder-structure.md).

## Auth Model

JWT access token in the `Authorization` header plus a rotated, HTTP-only `refresh_token` cookie. Signup, login, refresh rotation, CSRF and rate limits are specified in [authentication.md](authentication.md).

## Multi-Tenancy

Tenant routes use `requireOrganization`.

- Normal users are pinned to their own `organizationId`.
- Super admin users must provide `x-organization-id` for tenant data routes.
- Platform routes such as audit, announcements, billing console, organizations, and platform settings enforce scope inside their services or are intentionally unscoped.

Tenant data writes in users, items, leads, prospects, and quotations are also protected by `enforceSubscription`.

## Authorization

`allowPermission` checks permissions from `src/constants/rolePermissions.ts`.

- `SUPER_ADMIN` has all permissions.
- `ADMIN` can manage tenant users, CRM data, org settings, reports, audit, announcements, and read billing.
- `MANAGER` can manage most CRM data and users but not platform/billing/admin-only actions.
- `EXECUTIVE` can read/update assigned CRM data and reports.

Some service methods add narrower rules, such as super-admin-only password reset and authoring scope rules for announcements.

## Billing And Features

Plans and subscriptions are first-class models:

- `Plan` and `PlanFeature` define catalog terms.
- `Subscription` is unique per organization.
- `SubscriptionFeatureOverride` replaces selected feature values for enterprise deals.
- `Payment` records each Razorpay order; payments are confirmed by `/billing/payment/verify` and by the webhook.
- `resolveSubscriptionState` derives the effective status instead of trusting `Subscription.status` alone.
- Feature gates use `requireFeature`.

## Background Jobs

Follow-up reminders run in-process on `node-cron`; subscription warnings and audit retention run through the secret-guarded `/api/v1/internal/jobs/run` endpoint; token cleanup runs on an interval. See [scheduled-jobs.md](scheduled-jobs.md).

## Response And Error Contracts

Controllers return `ApiResponse.ok` or `ApiResponse.created` for JSON success (envelope in [api-spec.md](api-spec.md#response-shapes)). CSV exports write directly to the response.

Errors flow through `AppError`, Prisma/Zod handling, and the global `errorHandler`. The error JSON shape and mappings are in [error-handling.md](error-handling.md).
