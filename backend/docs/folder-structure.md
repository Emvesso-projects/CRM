# Backend Folder Structure

```text
backend/
|-- docs/
|-- prisma/
|   |-- schema.prisma
|   |-- models/
|   |-- migrations/
|   |-- release-2-pending/            (not applied yet — see its README)
|   `-- release-activity-3-pending/   (not applied yet — see its README)
|-- src/
|   |-- app.ts
|   |-- index.ts
|   |-- config/
|   |-- constants/
|   |-- contracts/
|   |-- middlewares/
|   |-- modules/
|   |-- scripts/
|   |-- types/
|   `-- utils/
|-- package.json
|-- tsconfig.json
`-- vitest.config.mts
```

The Prisma model files are listed in [database.md](database.md#schema-layout).

## `src` Roots

| Folder | Purpose |
| --- | --- |
| `config` | env, db, logger, multer, Razorpay client, storage provider (local/R2) |
| `constants` | permissions, roles, role permissions, HTTP/error constants |
| `contracts` | shared constants, DTO types, Zod validation schemas, dashboard DTOs |
| `middlewares` | auth, permission, organization, subscription, feature, CSRF, rate limiting, validation, upload cleanup, error handling |
| `modules` | route/controller/service/repository business modules |
| `scripts` | seeds, plan inspection, pending-migration runner, activity migration check, storage reconcile |
| `types` | backend-only shared TypeScript types |
| `utils` | activity, audit, auth, business, cache, db, errors, middleware, request, response, security, selectors, uploads, validation |

Unit tests sit next to the code they cover as `*.test.ts` (Vitest).

## Current Modules

```text
modules/
|-- announcement/
|-- audit/
|-- auth/
|-- billing/
|-- dashboard/
|-- followUp/
|-- item/
|-- jobs/
|-- lead/
|-- notification/
|-- organization/
|-- platformSettings/
|-- prospect/
|-- prospectActivity/
|-- quotation/
|-- reports/
`-- user/
```

`followUp` and `prospectActivity` are not mounted in `app.ts`: `prospect.route.ts` wires the follow-up endpoints directly and nests `prospectActivity.route.ts` at `/prospects/:id/activities`.

## Module Convention

Most persistence-backed modules use:

```text
<module>/
|-- <module>.route.ts
|-- <module>.controller.ts
|-- <module>.service.ts
`-- <module>.repository.ts
```

Some modules also include helpers, import/calculator files, validators, mappers, or rules:

- `lead.helpers.ts`, `lead.import.ts`, `lead.validation.ts`
- `followUp.commands.ts`, `followUp.mapper.ts`, `followUp.rules.ts`
- `quotation.calculator.ts`
- `dashboard.mapper.ts`
- `billing/limit.guard.ts`, `billing/payment.*.ts`, `billing/webhook.route.ts`
- `jobs/*.job.ts` (one file per scheduled job)

## Contracts Layout

```text
contracts/
|-- constants/
|-- dashboard/
|-- types/
`-- validation/
```

Validation schemas are the canonical request-body/query contracts for routes.
