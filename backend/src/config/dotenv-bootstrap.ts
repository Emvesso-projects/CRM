import dotenv from "dotenv";
import path from "path";

/**
 * Side-effect-only bootstrap: loads the correct .env file into process.env.
 *
 * Import this module before any Zod validation so that file-based variables
 * are available in process.env.  Platform-injected variables (Render, GitHub
 * Actions, systemd EnvironmentFile, etc.) are already present and are NOT
 * overridden in production.
 */
const nodeEnv = process.env.NODE_ENV || "development";
const envFile =
  nodeEnv === "production" ? ".env.production" : ".env.development";

dotenv.config({
  path: path.resolve(process.cwd(), envFile),
  // In local development, prefer the selected .env file over any stale shell vars.
  override: nodeEnv !== "production",
});
