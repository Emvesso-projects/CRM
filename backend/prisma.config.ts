import { defineConfig } from "prisma/config";
import { prismaEnv } from "./src/config/prisma-env";

/**
 * CLI-only configuration.
 *
 * The runtime client does NOT read this file — src/config/db.ts builds its own
 * pg Pool from DATABASE_URL and hands it to PrismaClient through the adapter.
 * Everything here therefore affects `prisma migrate`, `prisma studio` and
 * `prisma db pull` only.
 *
 * `url` is deliberately DIRECT_URL rather than DATABASE_URL: DATABASE_URL points
 * at the Supabase pooler (pgbouncer, port 6543) in transaction mode, which
 * cannot hold the session-level advisory lock `prisma migrate` takes. Pointed at
 * the pooler, every migrate command hangs indefinitely instead of failing.
 */
export default defineConfig({
  schema: "./prisma",
  datasource: {
    url: prismaEnv.DIRECT_URL || prismaEnv.DATABASE_URL,
    directUrl: prismaEnv.DIRECT_URL,
  },
});
