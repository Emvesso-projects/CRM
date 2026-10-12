import "./dotenv-bootstrap";
import { z } from "zod";

type Duration = `${number}${"s" | "m" | "h" | "d"}`;

/** Type guard for JWT duration strings to avoid 'as' per project rules */
function isDuration(val: string): val is Duration {
  return /^\d+[smhd]$/.test(val);
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid PostgreSQL URL"),
  DIRECT_URL: z
    .string()
    .url("DIRECT_URL must be a valid PostgreSQL URL")
    .optional(),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters long for security"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be at least 32 characters long"),
  JWT_ACCESS_EXPIRY: z
    .string()
    .default("15m")
    .refine(isDuration, { message: "Invalid duration format" })
    .transform((val) => val), // already narrowed by refine
  JWT_REFRESH_EXPIRY: z
    .string()
    .default("7d")
    .refine(isDuration, { message: "Invalid duration format" })
    .transform((val) => val),
  /**
   * Email (signup and password-reset codes) goes only through Resend's HTTP
   * API. Optional so the app still boots without it: sends then fail and
   * startup logs a warning. RESEND_FROM_ADDRESS is a bare address on a domain
   * verified in Resend; the default test sender only reaches the account owner.
   * Not validated as an email here on purpose — a malformed optional mail
   * setting should be a startup warning, not a backend that refuses to boot.
   */
  RESEND_API_KEY: z.string().trim().optional(),
  RESEND_FROM_NAME: z.string().trim().default("CRM Support"),
  RESEND_FROM_ADDRESS: z.string().trim().default("onboarding@resend.dev"),
  /**
   * Shared secret for POST /api/v1/internal/jobs/run, called by the platform
   * scheduler (Render Cron / GitHub Actions).
   *
   * Optional so existing deployments keep booting, but the endpoint REFUSES
   * every request when it is unset — an unauthenticated job runner that anyone
   * on the internet can trigger is worse than no job runner. Minimum length is
   * enforced because this is the only thing standing in front of it.
   */
  INTERNAL_JOB_SECRET: z
    .string()
    .min(32, "INTERNAL_JOB_SECRET must be at least 32 characters")
    .optional(),
  LOG_LEVEL: z.string().default("info"),
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:5173")
    .transform((val) => val.split(",").map(o => o.trim()).filter(Boolean)),
  APP_TIMEZONE: z.string().default("Asia/Kolkata"),
  ENABLE_IN_PROCESS_SCHEDULER: z
    .string()
    .optional()
    .transform((val) => val === undefined || val.toLowerCase() !== "false"),
  SCHEDULER_CRON_EXPRESSION: z.string().default("* * * * *"),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  STORAGE_PROVIDER: z.enum(["r2", "local"]).default("local"),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_CUSTOM_DOMAIN: z.string().url().optional(),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === "production" && data.STORAGE_PROVIDER === "r2") {
    const required = [
      ["R2_ACCOUNT_ID", data.R2_ACCOUNT_ID],
      ["R2_ACCESS_KEY_ID", data.R2_ACCESS_KEY_ID],
      ["R2_SECRET_ACCESS_KEY", data.R2_SECRET_ACCESS_KEY],
      ["R2_BUCKET_NAME", data.R2_BUCKET_NAME],
      ["R2_PUBLIC_CUSTOM_DOMAIN", data.R2_PUBLIC_CUSTOM_DOMAIN],
    ] as const;

    for (const [key, val] of required) {
      if (!val || val.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${key} is required in production when STORAGE_PROVIDER=r2`,
          path: [key],
        });
      }
    }
  }
});

export const env = envSchema.parse(process.env);
