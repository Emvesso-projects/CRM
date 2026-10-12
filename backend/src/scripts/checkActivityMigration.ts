import { Client } from "pg";
import { prismaEnv } from "../config/prisma-env";

/**
 * Read-only report on follow-up and activity data for the activity/follow-up
 * overhaul migrations. Run it before and after each of those migrations and
 * keep the output with the release notes. Lines marked "MUST BE 0" make the
 * script exit non-zero.
 *
 * It never writes: the session is READ ONLY, enforced by the server.
 *
 * Target: DATABASE_URL from the env file NODE_ENV selects. On a developer
 * machine `db:check:activity:prod` loads backend/.env.production, which points
 * at STAGING; production checks run on the VPS. `--url=<postgres url>` points
 * it at anything else (e.g. a restored backup) without touching env files.
 *
 * Run:  npx tsx src/scripts/checkActivityMigration.ts [--url=postgres://...]
 */

const urlArg = process.argv.find((arg) => arg.startsWith("--url="));
const TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kolkata";
const DATA_MIGRATION = "20260911150200_migrate_existing_activity_data";

/** Session pooler, as in applyPendingMigrations.ts, unless --url is given. */
const connectionString = urlArg
  ? urlArg.slice("--url=".length)
  : (prismaEnv.DATABASE_URL ?? "")
      .replace(":6543", ":5432")
      .replace(/\?pgbouncer=true/, "");

const HH_MM = "^([01][0-9]|2[0-3]):[0-5][0-9]$";
const INTERACTION_TYPES =
  "('CALL','IN_PERSON_MEETING','VIRTUAL_MEETING','EMAIL','WHATSAPP','TEXT','SITE_VISIT','NOTE','MEETING')";

/** host:port/database only — never credentials. */
const describeTarget = (url: string) => {
  try {
    const parsed = new URL(url);
    const database = parsed.pathname.replace(/^\//, "") || "postgres";
    return `${parsed.hostname}:${parsed.port || "5432"}/${database}`;
  } catch {
    return "<unparseable database url>";
  }
};

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  let failures = 0;

  const rows = async (sql: string, params: unknown[] = []) =>
    (await client.query(sql, params)).rows as Record<string, unknown>[];

  const count = async (sql: string, params: unknown[] = []) =>
    Number((await rows(sql, params))[0]?.count ?? 0);

  const hasColumn = async (table: string, column: string) =>
    (await count(
      `SELECT count(*) FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2`,
      [table, column],
    )) > 0;

  const line = (label: string, value: number, mustBeZero = false) => {
    const failed = mustBeZero && value !== 0;
    if (failed) failures += 1;
    console.log(`  ${label.padEnd(70)} ${value}${failed ? "   <-- MUST BE 0" : ""}`);
  };

  try {
    // Enforced by the server, not just by this script behaving itself.
    await client.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");

    console.log(`Target: ${describeTarget(connectionString)}   business timezone: ${TIMEZONE}\n`);

    const applied = new Set<string>();
    const historyExists = (
      await rows(`SELECT to_regclass('"_prisma_migrations"') IS NOT NULL AS exists`)
    )[0]?.exists;
    if (historyExists) {
      const history = await rows(
        `SELECT migration_name, finished_at IS NOT NULL AS finished
           FROM "_prisma_migrations"
          WHERE migration_name ~ '(activity|follow_?up)'
          ORDER BY migration_name`,
      );
      console.log("Activity / follow-up migrations recorded:");
      for (const row of history) {
        if (row.finished) applied.add(String(row.migration_name));
        console.log(`  ${row.migration_name}${row.finished ? "" : "   (NOT FINISHED)"}`);
      }
      console.log("");
    }

    const hasDueAt = await hasColumn("FollowUp", "dueAt");
    const hasOccurredAt = await hasColumn("ProspectActivity", "occurredAt");
    const hasClosedAt = await hasColumn("Prospect", "closedAt");
    const dataMigrated = applied.has(DATA_MIGRATION);

    console.log("Guards (the expand migration refuses to run unless these are 0):");
    line(
      "FollowUp.scheduledDate not at UTC midnight",
      await count(
        `SELECT count(*) FROM "FollowUp" WHERE "scheduledDate" <> date_trunc('day', "scheduledDate")`,
      ),
      true,
    );
    line(
      "FollowUp.scheduledTime not HH:mm",
      await count(
        `SELECT count(*) FROM "FollowUp" WHERE "scheduledTime" IS NOT NULL AND "scheduledTime" !~ $1`,
        [HH_MM],
      ),
      true,
    );

    console.log("\nFollow-ups:");
    for (const row of await rows(
      `SELECT status::text AS status, count(*) FROM "FollowUp" GROUP BY status ORDER BY status`,
    )) {
      line(`status ${row.status}`, Number(row.count));
    }
    line(
      "without a time (treated as 09:00)",
      await count(`SELECT count(*) FROM "FollowUp" WHERE "scheduledTime" IS NULL`),
      dataMigrated,
    );
    line(
      "PENDING on a won, lost or deleted prospect",
      await count(
        `SELECT count(*) FROM "FollowUp" f JOIN "Prospect" p ON p.id = f."prospectId"
          WHERE f.status = 'PENDING' AND (p.stage IN ('WON', 'LOST') OR p."deletedAt" IS NOT NULL)`,
      ),
      dataMigrated,
    );
    line(
      "PENDING without an assignee (no reminders)",
      await count(
        `SELECT count(*) FROM "FollowUp" WHERE status = 'PENDING' AND "assignedToId" IS NULL`,
      ),
    );

    if (hasDueAt) {
      line(
        "dueAt is NULL",
        await count(`SELECT count(*) FROM "FollowUp" WHERE "dueAt" IS NULL`),
        true,
      );
      line(
        `dueAt differs from date + time read in ${TIMEZONE}`,
        await count(
          `SELECT count(*) FROM "FollowUp"
            WHERE ("scheduledTime" IS NULL OR "scheduledTime" ~ $2)
              AND "dueAt" IS DISTINCT FROM
                  ((("scheduledDate"::date + COALESCE("scheduledTime", '09:00')::time)
                     AT TIME ZONE $1) AT TIME ZONE 'UTC')`,
          [TIMEZONE, HH_MM],
        ),
        true,
      );
    } else {
      console.log("  (dueAt column not present yet)");
    }

    console.log("\nProspects:");
    line(
      "WON or LOST",
      await count(`SELECT count(*) FROM "Prospect" WHERE stage IN ('WON', 'LOST')`),
    );
    if (hasClosedAt) {
      line(
        "WON or LOST without closedAt",
        await count(
          `SELECT count(*) FROM "Prospect" WHERE stage IN ('WON', 'LOST') AND "closedAt" IS NULL`,
        ),
        true,
      );
    } else {
      console.log("  (closedAt column not present yet)");
    }

    console.log("\nProspect activities by type:");
    for (const row of await rows(
      `SELECT type::text AS type, count(*) FROM "ProspectActivity" GROUP BY type ORDER BY type`,
    )) {
      line(String(row.type), Number(row.count));
    }

    console.log("\nFollow-up events by type and title:");
    for (const row of await rows(
      `SELECT type::text AS type, title, count(*) FROM "ProspectActivity"
        WHERE type::text LIKE 'FOLLOW_UP%' GROUP BY type, title ORDER BY type, title`,
    )) {
      line(`${row.type} / ${row.title}`, Number(row.count));
    }

    console.log("\nCompletions:");
    const completed = (
      await rows(
        `SELECT count(*) AS total,
                count(*) FILTER (WHERE EXISTS (
                  SELECT 1 FROM "ProspectActivity" a
                   WHERE a."prospectId" = f."prospectId"
                     AND a.title = 'Follow-up completed'
                     AND abs(extract(epoch FROM a."createdAt" - f."completedAt")) <= 10
                )) AS with_event
           FROM "FollowUp" f WHERE f.status = 'COMPLETED'`,
      )
    )[0];
    line("COMPLETED with a legacy 'Follow-up completed' event", Number(completed?.with_event ?? 0));
    line(
      "COMPLETED without one",
      Number(completed?.total ?? 0) - Number(completed?.with_event ?? 0),
    );

    console.log("\nActivities:");
    line(
      "prospect TEXT logged via the old 'Note' button (become NOTE in release 2)",
      await count(
        `SELECT count(*) FROM "ProspectActivity" WHERE type = 'TEXT' AND title = 'Text Message'`,
      ),
      dataMigrated,
    );
    if (hasOccurredAt) {
      line(
        "prospect activities with occurredAt after createdAt (+2 min)",
        await count(
          `SELECT count(*) FROM "ProspectActivity"
            WHERE "occurredAt" > "createdAt" + interval '2 minutes'`,
        ),
      );
      line(
        "lead activities with occurredAt after createdAt (+2 min)",
        await count(
          `SELECT count(*) FROM "LeadActivity"
            WHERE "occurredAt" > "createdAt" + interval '2 minutes'`,
        ),
      );
    } else {
      console.log("  (occurredAt column not present yet)");
    }

    if (dataMigrated) {
      console.log("\nAfter the data migration (release 2):");
      line(
        "COMPLETED follow-ups without exactly one completing activity",
        await count(
          `SELECT count(*) FROM "FollowUp" f
            WHERE f.status = 'COMPLETED'
              AND (SELECT count(*) FROM "ProspectActivity" a
                    WHERE a."followUpId" = f.id AND a.type::text IN ${INTERACTION_TYPES}) <> 1`,
        ),
        true,
      );
      line(
        "activities linked to a follow-up of another prospect",
        await count(
          `SELECT count(*) FROM "ProspectActivity" a JOIN "FollowUp" f ON f.id = a."followUpId"
            WHERE f."prospectId" <> a."prospectId"`,
        ),
        true,
      );
      line(
        "follow-up events not linked to a follow-up (older than the FollowUp table)",
        await count(
          `SELECT count(*) FROM "ProspectActivity"
            WHERE type::text LIKE 'FOLLOW_UP%' AND "followUpId" IS NULL`,
        ),
      );
      for (const row of await rows(
        `SELECT metadata->>'migratedFrom' AS source, count(*) FROM "ProspectActivity"
          WHERE metadata ? 'migratedFrom' GROUP BY 1 ORDER BY 1`,
      )) {
        line(`rows created or converted by the migration: ${row.source}`, Number(row.count));
      }
    }

    console.log("\nPer organization:");
    console.table(
      await rows(
        `SELECT o.name AS organization,
                (SELECT count(*) FROM "FollowUp" f
                  WHERE f."organizationId" = o.id AND f.status = 'PENDING')::int AS pending_follow_ups,
                (SELECT count(*) FROM "FollowUp" f
                  WHERE f."organizationId" = o.id AND f.status = 'COMPLETED')::int AS completed_follow_ups,
                (SELECT count(*) FROM "ProspectActivity" a JOIN "Prospect" p ON p.id = a."prospectId"
                  WHERE p."organizationId" = o.id)::int AS prospect_activities,
                (SELECT count(*) FROM "LeadActivity" la JOIN "Lead" l ON l.id = la."leadId"
                  WHERE l."organizationId" = o.id)::int AS lead_activities
           FROM "Organization" o
          ORDER BY o.name`,
      ),
    );
  } finally {
    await client.end();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) that must be 0 are not.`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
