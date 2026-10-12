# Release 2 migrations — do NOT move into `migrations/` yet

These two migrations change **existing production data**, so they ship only
after release 1 (the additive migrations + new code) is live and verified.

Nothing reads this folder: neither Prisma nor
`src/scripts/applyPendingMigrations.ts` looks outside `prisma/migrations/`.
That is what stops them being applied by accident in release 1.

| Migration | Effect | Production at the pre-release check |
| --- | --- | --- |
| `20260912100000_drop_signup_requests` | drops `SignupRequest` and `SignupRequestStatus` | 1 row, `APPROVED` |
| `20260912100100_clear_placeholder_org_types` | sets `Organization.orgType = NULL` where it is `type1`/`type2` | all 5 organizations are `type1` |

Release-1 code already ignores both: it no longer reads `SignupRequest`, and it
treats `type1`/`type2` as an unset type. So release 2 is cleanup, not a fix, and
can wait until release 1 has proven stable.

## Before moving them in

1. Export production `SignupRequest` (all columns) and
   `Organization (id, name, orgType)`, stored off-server. Both contain personal
   or business data — never commit them.
2. If any migration newer than `20260912100100` has been added to
   `prisma/migrations/` since, rename these two folders with current timestamps
   so they still sort last.

## Release

1. `git mv prisma/release-2-pending/20260912100000_drop_signup_requests prisma/migrations/`
   and the same for `20260912100100_clear_placeholder_org_types`.
2. `npm run db:migrate:pooled:prod -- --dry-run` — must list **exactly these two**.
3. `npm run db:migrate:pooled:prod`
4. Ask admins to set each organization's real type in Settings → Company.

Both are idempotent (`IF EXISTS`, `WHERE … IN`). On dev databases that already
dropped the table or cleared the values under the old migration names, they are
no-ops.

## Rollback

- **SignupRequest:** recreate it with
  `prisma/migrations/20260804121500_add_signup_requests/migration.sql`, then
  re-insert the exported rows.
- **orgType:** `UPDATE "Organization" SET "orgType" = '<exported value>' WHERE id = '<id>'`
  for each exported row.
