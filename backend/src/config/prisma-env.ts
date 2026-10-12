import "./dotenv-bootstrap";
import { z } from "zod";

/**
 * Minimal environment validation for Prisma CLI commands.
 *
 * `prisma generate`, `prisma migrate`, and `prisma studio` only need database
 * connection strings.  Importing the full `env.ts` would force these commands
 * to validate JWT secrets, mail credentials, and other runtime-only variables
 * — causing failures in CI and on machines that don't have those values.
 *
 * Application code should continue importing from `./env` instead.
 */
const prismaEnvSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid PostgreSQL URL"),
  DIRECT_URL: z
    .string()
    .url("DIRECT_URL must be a valid PostgreSQL URL")
    .optional(),
});

export const prismaEnv = prismaEnvSchema.parse(process.env);
