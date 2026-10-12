# Database

## Technology

- PostgreSQL.
- Prisma ORM.
- Prisma client generated with `prisma-client-js`.
- Runtime database connection through `@prisma/adapter-pg`.

## Schema Layout

`backend/prisma/schema.prisma` contains only generator and datasource blocks. Models are split into `backend/prisma/models/*.prisma`.

```text
prisma/
|-- schema.prisma
|-- models/
|   |-- announcement.prisma
|   |-- audit_log.prisma
|   |-- billing.prisma
|   |-- follow_up.prisma
|   |-- item.prisma
|   |-- lead.prisma
|   |-- lead_activity.prisma
|   |-- lead_sequence.prisma
|   |-- notification.prisma
|   |-- organization.prisma
|   |-- platform_settings.prisma
|   |-- prospect.prisma
|   |-- quotation.prisma
|   |-- token.prisma
|   |-- user.prisma
|   `-- user_sequence.prisma
|-- migrations/
|-- release-2-pending/
`-- release-activity-3-pending/
```

The two `release-*-pending/` folders hold migrations that change existing production data or drop columns, so they ship in later releases. Prisma does not read them; each has a README with its release steps.

## Core Tenant Models

| Model | Purpose | Tenant key |
| --- | --- | --- |
| `Organization` | Tenant root, branding assets, status, archive state | `id` |
| `User` | Identity, role, employee metadata, manager hierarchy | `organizationId` optional for super admin |
| `Item` | Product/service catalog | `organizationId` |
| `Lead` | Enquiry data, assignment, lifecycle status, soft delete | `organizationId` |
| `Prospect` | Converted lead sales opportunity: stage, value, assignee | `organizationId` |
| `Quotation` | Quote header, totals, status, assignment, prospect link | `organizationId` |

Most tenant data supports soft delete through `deletedAt` and `deletedById`.

## Activity And Follow-Up Models

| Model | Purpose |
| --- | --- |
| `LeadActivity` | Timeline entry on a lead: status change, call, email, WhatsApp, meeting, site visit, note. Ordered by `occurredAt` |
| `ProspectActivity` | Timeline entry on a prospect: conversion, stage change, calls/meetings, quotation events. Optionally linked to the `FollowUp` it completed via `followUpId` |
| `FollowUp` | A scheduled follow-up on a prospect. `status`: `PENDING` → `COMPLETED` / `MISSED` / `CANCELLED` / `RESCHEDULED`; completion records an `outcome`. `dueAt` is the exact due instant resolved from `scheduledDate` + `scheduledTime` in `APP_TIMEZONE` |

Activity writes carry a `clientRequestId`, unique per lead/prospect, so a retried request cannot log the same activity twice. A rescheduled follow-up points at its replacement through the unique `rescheduledToId`.

Reminder and overdue notifications are driven by `FollowUp.dueAt` — see [scheduled-jobs.md](scheduled-jobs.md). The `release-activity-3-pending/` migration makes `dueAt`/`scheduledTime` NOT NULL and drops the legacy `missedReason`, `ProspectActivity.followUpHealth` and `FollowUpHealth`.

## Commercial Models

| Model | Purpose |
| --- | --- |
| `Plan` | Platform-level plan catalog |
| `PlanFeature` | Per-plan feature limits and toggles |
| `Subscription` | One live subscription row per organization |
| `SubscriptionFeatureOverride` | Per-organization feature override set |
| `Payment` | One row per Razorpay order: amount, plan, billing cycle, status (`PENDING` → `SUCCESS` / `FAILED` / `CANCELLED`) |
| `PlatformSetting` | Singleton platform name, support contacts, audit retention, default plan |

Plan prices use `priceMinor` in the smallest currency unit. Current currency is INR.

## Communication And Audit Models

| Model | Purpose |
| --- | --- |
| `AuditLog` | Append-only audit trail with denormalized actor email/role |
| `Announcement` | Human-authored platform or organization broadcast |
| `AnnouncementReceipt` | Per-user read/dismiss state for announcements |
| `Notification` | Per-user system event notification |

`AuditLog.action`, `AuditLog.entityType`, `Notification.type`, and `Notification.entityType` are strings constrained in TypeScript contracts so new values do not require migrations.

## Token Models

| Model | Purpose |
| --- | --- |
| `RefreshToken` | One row per live session; stores the SHA-256 hash, not the JWT |
| `PasswordResetOtp` | Hashed 6-digit reset code with expiry, failure count, revocation |
| `PendingSignup` | A started-but-unproven signup: the whole payload plus a hashed code |

`PendingSignup` is how signup proves the address **before** creating anything.
It holds the admin account (name, email, mobile, password hash) and the
organization's details as typed columns (`companyName`, `orgType`, `address`,
`orgMobile`, and nullable `orgEmail`, `authorizedPerson`, `dateOfRegistration`,
`gstin`, `remark`) — typed rather than a JSON blob so verify reads them back
with nothing to re-validate.

`Organization.orgType` is `TEXT` holding one of `PROPRIETORSHIP`, `PARTNERSHIP`,
`LLP`, `PRIVATE_LIMITED`, `PUBLIC_LIMITED`, `OTHER` (`ORGANIZATION_TYPE_VALUES`).
The former placeholders `type1`/`type2` are cleared to `NULL` by the release-2
migration `…_clear_placeholder_org_types` (in `prisma/release-2-pending/`), not
by `prisma/migrations/` — it rewrites existing rows, so it ships after the
additive release. Until then the code treats `type1`/`type2` as an unset type;
admins choose a real type in Settings → Company.

It is deliberately simpler than the OTP tables — no `userId` (no user exists
yet) and no `usedAt`/`revokedAt`, because the row is deleted when consumed and
deleted when superseded. It holds a bcrypt hash, so keeping spent copies would
retain that for nothing; the cleanup job purges expired rows after 1 hour rather
than the 24h used for OTPs.

The tables are kept separate on purpose: a signup code and a reset code must
never be interchangeable, and one shared table would make "consume the newest
pending code" ambiguous across flows with very different consequences. Each hash
is domain-separated by prefix for the same reason.

`User.emailVerifiedAt` is set at creation for self-service signups and stays
`NULL` for users a super-admin or admin creates directly.

## Sequence Models

| Model | Purpose |
| --- | --- |
| `LeadSequence` | Per-organization lead numbering |
| `ProspectSequence` | Per-organization prospect numbering |
| `QuotationSequence` | Per-organization, per-year quotation numbering |
| `UserSequence` | Per-organization employee id numbering |

Sequence generation is protected in service code with transactions and, where needed, database locks/retries.

## Important Relations

- `Organization` has many users, leads, items, prospects, quotations, audit logs, announcements, notifications, and one subscription.
- `User` belongs to an organization except super admin users.
- `User.managerId` models manager/team hierarchy.
- `Lead.productInterestId` points to `Item`.
- `Prospect.leadId` is unique (one prospect per converted lead) and nullable, with its FK explicitly `onDelete: Restrict` — a lead that still has a prospect cannot be hard-deleted. Keep `Restrict` explicit: for an optional relation Prisma's default is `SetNull`, and leaving it implicit made the schema disagree with the database after `20260813120000_make_prospect_lead_nullable` dropped `NOT NULL` without recreating the FK.
- `Quotation.prospectId` optionally links quotations to prospects.
- `AnnouncementReceipt` is unique by `(announcementId, userId)`.
- `Subscription.organizationId` is unique.
- `PlanFeature` is unique by `(planId, featureKey)`.

## Index And Uniqueness Notes

Item code uniqueness for active rows is handled by a manual partial unique index in a migration:

```sql
CREATE UNIQUE INDEX unique_active_item_code
ON items (organization_id, item_code)
WHERE deleted_at IS NULL;
```

Other notable unique constraints:

- `Organization.slug`
- `Organization.prefix`
- `User.email`
- `User.employeeId`
- `Lead.leadNo`
- `(Prospect.organizationId, Prospect.prospectNo)`
- `(Quotation.organizationId, Quotation.quotationNo)`
- `Notification.dedupeKey`
- `(LeadActivity.leadId, clientRequestId)`, `(ProspectActivity.prospectId, clientRequestId)`
- `FollowUp.rescheduledToId`

## Migrations

Current migration history includes initial schema, optional email/mobile changes, lead custom industry, organization PDF assets, soft delete, audit logs, billing/plans, notifications, platform settings, password reset OTPs, pending signups, payments, and the activity/follow-up overhaul (`…_expand_activity_follow_up`, `…_migrate_existing_activity_data`).

`Payment` was declared in the schema and called from `payment.repository.ts`
before any migration created it, so the Razorpay endpoints failed at runtime
until `20260910180000_add_payment_table` was added and applied.

`EmailVerificationOtp` and `Organization.setupCompletedAt` were added and then
dropped again (`20260910170000_add_pending_signup`) when verification moved
inside signup: once no account can exist unverified, there is nothing left to
chase afterwards and nothing to acknowledge having been chased.

The `SignupRequest` table and its enum are no longer used by the code (the
approval workflow was replaced by direct self-service signup), but they are
**not dropped by `prisma/migrations/`**. The drop was moved out of the release
that ships self-service signup so that release changes no existing data and
`master` can still be rolled back onto it. It ships in release 2 from
`prisma/release-2-pending/` (see its README), together with clearing the
placeholder `orgType` values. Until then `prisma migrate diff` reports
`SignupRequest` as drift on databases that still have it — expected.

Prisma and migration commands (`prisma:*`, `db:migrate:pooled[:prod]`) are listed in [development-workflow.md](development-workflow.md#commands).

## Supabase Connectivity

For Supabase on IPv4-only networks, use the Supavisor Session pooler connection string in `DATABASE_URL`. Keep the direct connection string in `DIRECT_URL` for Prisma CLI operations when needed.
