# Activity & follow-up overhaul, release 3 — do NOT move into `migrations/` yet

Releases 1 and 2 shipped additive and data-only migrations, so the backend
could still be rolled back after each. This contract migration removes the
columns and indexes the new code no longer uses and enforces what it now
guarantees. After it runs, a build older than release 2 cannot start, so it
ships only once release 2 has been stable in production.

Nothing reads this folder: neither Prisma nor
`src/scripts/applyPendingMigrations.ts` looks outside `prisma/migrations/`.

| Change | Why it is safe once release 2 is stable |
| --- | --- |
| `FollowUp.scheduledTime`, `FollowUp.dueAt` → NOT NULL | Release 2 code always writes both; the migration first catches up any stragglers. |
| Drop `FollowUp.missedReason` | Copied into `statusReason` by releases 1–2 and here once more. |
| Drop `ProspectActivity.followUpHealth` and enum `FollowUpHealth` | Never written. |
| Drop the old `scheduledDate` / `createdAt` indexes | All queries use `dueAt` / `occurredAt`. |

## Before moving it in

1. Run `npm run db:check:activity:prod` **on the production VPS** (on a developer
   machine that script targets staging). Every "MUST BE 0" line must be 0.
2. If any migration newer than this folder's timestamp exists in
   `prisma/migrations/`, rename the folder with a current timestamp so it sorts last.

## Release (same PR)

1. `git mv prisma/release-activity-3-pending/20260920090000_contract_activity_follow_up prisma/migrations/`
2. Update the Prisma models to match:
   - `follow_up.prisma`: `scheduledTime String`, `dueAt DateTime`; remove `missedReason`
     and the three `@@index` entries on `scheduledDate`.
   - `prospect.prisma`: remove `followUpHealth` from `ProspectActivity`, the
     `FollowUpHealth` enum, and `@@index([prospectId, createdAt(sort: Desc)])`.
   - `lead_activity.prisma`: remove `@@index([leadId, createdAt(sort: Desc)])`.
3. Remove the remaining `missedReason` reads/writes (`followUp.service.ts`
   `markMissed`, `followUp.mapper.ts`) and the `dueAt` NULL fallback in
   `utils/business/businessTime.ts#resolveDueAt` callers if desired.
4. `npx prisma migrate diff --from-schema <previous schema> --to-schema ./prisma --script`
   must produce exactly this migration's DDL.
5. Deploy staging first (`db:migrate:pooled:prod` from a developer machine), then
   production from the VPS, with the backend stopped while it runs.

## After sign-off

The release-2 migration left an undo copy of the touched tables. Once release 3
is verified, drop it:

```sql
DROP SCHEMA IF EXISTS "migration_backup" CASCADE;
```
