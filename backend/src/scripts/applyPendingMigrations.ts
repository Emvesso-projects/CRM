import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Client } from "pg";
import { prismaEnv } from "../config/prisma-env";

/**
 * Applies migrations through the Supabase pooler.
 *
 * `prisma migrate deploy` cannot run from every machine here: DIRECT_URL points
 * at db.<ref>.supabase.co, which publishes only an AAAA record, so a host
 * without IPv6 egress gets P1001. The pooler is the IPv4 path, but Prisma's
 * migration engine will not use it (transaction mode cannot hold the advisory
 * lock it takes, and its resolver fails on the NAT64 address).
 *
 * This applies each pending migration in a transaction and writes the same
 * `_prisma_migrations` bookkeeping row Prisma would, including the SHA-256
 * checksum, so `prisma migrate status` stays truthful and a machine that CAN
 * reach the direct host keeps working normally.
 *
 * This is the production migration path, so it is deliberately cautious:
 *
 *  - `--dry-run` connects read-only (enforced by the server), prints the target
 *    and the pending migrations, and changes nothing. Run it first against
 *    production and check the list is exactly what the release expects.
 *
 *  - It refuses to run while `_prisma_migrations` holds an unfinished row
 *    (finished_at NULL and not rolled back). That is a migration that failed or
 *    was interrupted. Counting it as applied would silently skip it; re-running
 *    it blindly could apply half of it twice. A person has to look first.
 *
 *  - Each migration runs with a lock_timeout, so an ALTER TABLE on a busy table
 *    gives up after a few seconds instead of queueing every live query behind
 *    it. The transaction rolls back cleanly and the script can simply be re-run.
 *
 * Run:  npx tsx src/scripts/applyPendingMigrations.ts [--dry-run]
 */

const MIGRATIONS_DIR = path.resolve(__dirname, "../../prisma/migrations");
const DRY_RUN = process.argv.includes("--dry-run");

/** How long one migration may wait for a table lock before giving up. */
const LOCK_TIMEOUT = "5s";

/** Postgres SQLSTATE for "lock not available" (lock_timeout expired). */
const LOCK_NOT_AVAILABLE = "55P03";

/** Pooler in session mode: transaction mode cannot run DDL transactions. */
const sessionUrl = (prismaEnv.DATABASE_URL ?? "")
  .replace(":6543", ":5432")
  .replace(/\?pgbouncer=true/, "");

/** host:port/database only — never credentials — so the operator sees where this runs. */
const describeTarget = (url: string) => {
  try {
    const parsed = new URL(url);
    const database = parsed.pathname.replace(/^\//, "") || "postgres";
    return `${parsed.hostname}:${parsed.port || "5432"}/${database}`;
  } catch {
    return "<unparseable DATABASE_URL>";
  }
};

type HistoryRow = {
  migration_name: string;
  finished: boolean;
  rolled_back: boolean;
};

async function main() {
  const client = new Client({ connectionString: sessionUrl });
  await client.connect();

  try {
    console.log(
      `Target: ${describeTarget(sessionUrl)}${DRY_RUN ? "  (dry run: nothing will be changed)" : ""}`,
    );

    if (DRY_RUN) {
      // Enforced by the server, not just by this script behaving itself.
      await client.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");
    }

    const historyExists = (
      await client.query<{ exists: boolean }>(
        `SELECT to_regclass('"_prisma_migrations"') IS NOT NULL AS exists`,
      )
    ).rows[0].exists;

    if (!historyExists && !DRY_RUN) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
          "id"                    VARCHAR(36) PRIMARY KEY NOT NULL,
          "checksum"              VARCHAR(64) NOT NULL,
          "finished_at"           TIMESTAMPTZ,
          "migration_name"        VARCHAR(255) NOT NULL,
          "logs"                  TEXT,
          "rolled_back_at"        TIMESTAMPTZ,
          "started_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
          "applied_steps_count"   INTEGER NOT NULL DEFAULT 0
        );
      `);
    }

    const history: HistoryRow[] = historyExists
      ? (
          await client.query<HistoryRow>(
            `SELECT migration_name,
                    finished_at IS NOT NULL    AS finished,
                    rolled_back_at IS NOT NULL AS rolled_back
               FROM "_prisma_migrations"`,
          )
        ).rows
      : [];

    const unfinished = history
      .filter((row) => !row.finished && !row.rolled_back)
      .map((row) => row.migration_name);

    if (unfinished.length) {
      console.error(
        `Refusing to run: _prisma_migrations has unfinished row(s):\n  ${unfinished.join("\n  ")}\n` +
          "Each is a migration that failed or was interrupted. Inspect the database, then either " +
          "finish it by hand or mark it with `prisma migrate resolve --rolled-back <name>`, " +
          "before running this again.",
      );
      process.exitCode = 1;
      return;
    }

    // A rolled-back migration is eligible to run again, as in Prisma.
    const appliedNames = new Set(
      history.filter((row) => !row.rolled_back).map((row) => row.migration_name),
    );

    const all = fs
      .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    const pending = all.filter((name) => {
      const sqlPath = path.join(MIGRATIONS_DIR, name, "migration.sql");
      return !appliedNames.has(name) && fs.existsSync(sqlPath);
    });

    if (!pending.length) {
      console.log("No pending migrations.");
      return;
    }

    console.log(`${pending.length} pending migration(s):`);
    for (const name of pending) console.log(`  ${name}`);

    if (DRY_RUN) {
      console.log("Dry run: nothing applied.");
      return;
    }

    for (const name of pending) {
      const sqlPath = path.join(MIGRATIONS_DIR, name, "migration.sql");
      const sql = fs.readFileSync(sqlPath, "utf8");
      const checksum = crypto.createHash("sha256").update(sql).digest("hex");

      process.stdout.write(`Applying ${name} ... `);

      // DDL plus its bookkeeping row commit together, so a failure cannot leave
      // the database changed but unrecorded.
      await client.query("BEGIN");
      try {
        // SET LOCAL is scoped to this transaction, so it cannot leak into later work.
        await client.query(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT}'`);
        await client.query(sql);
        await client.query(
          `INSERT INTO "_prisma_migrations"
             (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
           VALUES ($1, $2, $3, now(), now(), 1)`,
          [crypto.randomUUID(), checksum, name],
        );
        await client.query("COMMIT");
        console.log("done");
      } catch (error) {
        await client.query("ROLLBACK");
        console.log("FAILED");

        if ((error as { code?: string }).code === LOCK_NOT_AVAILABLE) {
          console.error(
            `Could not get a table lock within ${LOCK_TIMEOUT}: another transaction is holding it. ` +
              `${name} was rolled back and nothing from it was applied; migrations before it ` +
              "remain applied. Re-run when traffic is quieter.",
          );
        }
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
