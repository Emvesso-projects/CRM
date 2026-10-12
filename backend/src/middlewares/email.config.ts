import { env } from "../config/env";
import { logger } from "../config/logger";

/**
 * Email delivery. Every message (signup code, password-reset code) goes out
 * through Resend's HTTP API — there is no SMTP path.
 *
 * It calls the API with fetch rather than the Resend SDK: the SDK has no
 * request timeout and reports every network failure as the same generic error.
 * Production sits behind nginx, which gives up after 60s, so a send that can
 * hang turns the callers' 503 into a gateway 504.
 */

type SendOtpEmailInput = {
  to: string;
  otp: string;
};

/** The rendered message, once the sender name is known. */
type EmailContent = {
  subject: string;
  text: string;
  html: string;
};

/**
 * Must match RESET_OTP_EXPIRY_MINUTES / SIGNUP_OTP_EXPIRY_MINUTES in
 * auth.service. The email only states the window; the service enforces it.
 */
const OTP_EXPIRY_MINUTES = 10;
const SIGNUP_OTP_EXPIRY_MINUTES = 15;

const RESEND_EMAILS_URL = "https://api.resend.com/emails";

/**
 * Covers the whole call, connect to response body. Kept well under nginx's 60s
 * so a blocked or stalled request fails here first.
 *
 * If Resend accepted a message but answered after this, the user can receive a
 * code whose row the caller already deleted. That code is rejected and they ask
 * for a new one — acceptable next to a request that never returns.
 */
const RESEND_TIMEOUT_MS = 10_000;

/** RESEND_FROM_ADDRESS is the bare address; the display name is added here. */
const BARE_EMAIL_PATTERN = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getResendConfig = () => {
  if (!env.RESEND_API_KEY) {
    return null;
  }

  return {
    apiKey: env.RESEND_API_KEY,
    fromAddress: env.RESEND_FROM_ADDRESS,
    fromName: env.RESEND_FROM_NAME,
  };
};

type ResendConfig = NonNullable<ReturnType<typeof getResendConfig>>;

const buildResetOtpEmailContent = ({
  fromName,
  otp,
}: {
  fromName: string;
  otp: string;
}) => {
  const safeFromName = escapeHtml(fromName);
  const safeOtp = escapeHtml(otp);

  const subject = "Password Reset OTP";
  const text = [
    "You requested a password reset.",
    "",
    `Your OTP is: ${otp}`,
    "",
    `This OTP expires in ${OTP_EXPIRY_MINUTES} minutes.`,
    "",
    "If you did not request this password reset, you can safely ignore this email.",
    "",
    fromName,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6">
      <h2 style="margin:0 0 16px">${safeFromName}</h2>
      <p>You requested a password reset.</p>
      <p>Use this OTP to reset your CRM password:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:20px 0">${safeOtp}</p>
      <p>This OTP expires in ${OTP_EXPIRY_MINUTES} minutes.</p>
      <p>If you did not request this password reset, you can safely ignore this email.</p>
    </div>
  `;

  return { subject, text, html };
};

const buildSignupOtpEmailContent = ({
  fromName,
  otp,
}: {
  fromName: string;
  otp: string;
}): EmailContent => {
  const safeFromName = escapeHtml(fromName);
  const safeOtp = escapeHtml(otp);

  const subject = "Your signup code";
  const text = [
    "Enter this code to finish creating your account.",
    "",
    `Your code is: ${otp}`,
    "",
    `This code expires in ${SIGNUP_OTP_EXPIRY_MINUTES} minutes.`,
    "",
    "If you did not request this, you can safely ignore this email — no account has been created.",
    "",
    fromName,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6">
      <h2 style="margin:0 0 16px">${safeFromName}</h2>
      <p>Enter this code to finish creating your account:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:20px 0">${safeOtp}</p>
      <p>This code expires in ${SIGNUP_OTP_EXPIRY_MINUTES} minutes.</p>
      <p>If you did not request this, you can safely ignore this email — no account has been created.</p>
    </div>
  `;

  return { subject, text, html };
};

/** Renders the message once the sender name is known. */
type ContentBuilder = (args: { fromName: string; otp: string }) => EmailContent;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/** Explains a request that never produced a usable response. */
const describeRequestFailure = (error: unknown): string => {
  if (isRecord(error) && error.name === "TimeoutError") {
    return `Resend request timed out after ${RESEND_TIMEOUT_MS / 1000}s`;
  }

  if (error instanceof Error) {
    // fetch reports network failures as "fetch failed" with the reason in cause.
    const cause =
      "cause" in error &&
      isRecord(error.cause) &&
      typeof error.cause.message === "string"
        ? ` (${error.cause.message})`
        : "";

    return `Resend request failed: ${error.message}${cause}`;
  }

  return `Resend request failed: ${String(error)}`;
};

/** Resend answers errors as `{ statusCode, name, message }`. */
const describeResendError = (status: number, body: unknown): string => {
  if (isRecord(body) && typeof body.message === "string") {
    const name = typeof body.name === "string" ? ` ${body.name}` : "";
    return `Resend ${status}${name}: ${body.message}`;
  }

  return `Resend ${status}: unexpected response`;
};

const postToResend = async (payload: object, apiKey: string) => {
  const response = await fetch(RESEND_EMAILS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "crm-backend",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
  });

  // Read inside the same timeout: a response can stall mid-body too.
  const body = parseJson(await response.text());

  return { ok: response.ok, status: response.status, body };
};

const sendViaResend = async (
  to: string,
  content: EmailContent,
  kind: string,
  config: ResendConfig,
) => {
  const fromName = config.fromName.replace(/"/g, "'");

  const result = await postToResend(
    {
      from: `"${fromName}" <${config.fromAddress}>`,
      to: [to],
      subject: content.subject,
      html: content.html,
      text: content.text,
    },
    config.apiKey,
  ).catch((error: unknown) => {
    throw new Error(describeRequestFailure(error));
  });

  if (!result.ok) {
    throw new Error(describeResendError(result.status, result.body));
  }

  logger.info("OTP email sent via Resend", {
    kind,
    messageId:
      isRecord(result.body) && typeof result.body.id === "string"
        ? result.body.id
        : undefined,
  });
};

/**
 * Shared by every OTP email.
 *
 * Throws when nothing could be delivered, and both callers treat that as fatal
 * and compensate by deleting the row they just wrote — an undeliverable code is
 * worse than no code, because the user would be left waiting for mail that is
 * never coming.
 */
const deliverOtpEmail = async (
  to: string,
  otp: string,
  buildContent: ContentBuilder,
  kind: string,
) => {
  const config = getResendConfig();

  if (!config) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const content = buildContent({ fromName: config.fromName, otp });
  await sendViaResend(to, content, kind, config);
};

/**
 * Startup report. Mail is optional for booting, so without this a missing or
 * unusable setting would only surface when someone tries to sign up.
 */
export const logMailConfiguration = () => {
  const config = getResendConfig();

  if (!config) {
    logger.warn(
      "RESEND_API_KEY is not set: signup and password-reset codes cannot be sent",
    );
    return;
  }

  const { fromAddress, fromName } = config;

  if (!BARE_EMAIL_PATTERN.test(fromAddress)) {
    logger.warn(
      "RESEND_FROM_ADDRESS must be a bare address such as no-reply@example.com; the sender name comes from RESEND_FROM_NAME",
      { fromAddress },
    );
    return;
  }

  if (
    env.NODE_ENV === "production" &&
    fromAddress.toLowerCase().endsWith("@resend.dev")
  ) {
    logger.warn(
      "RESEND_FROM_ADDRESS is Resend's test sender, which only delivers to the Resend account owner. Use an address on a domain verified in Resend.",
      { fromAddress },
    );
    return;
  }

  logger.info("Mail: Resend", { fromAddress, fromName });
};

export const sendPasswordResetOtpEmail = async ({
  to,
  otp,
}: SendOtpEmailInput): Promise<void> => {
  if (env.NODE_ENV === "development") {
    logger.info(`[DEV] Password reset OTP for ${to}: ${otp}`);
  }

  await deliverOtpEmail(to, otp, buildResetOtpEmailContent, "password_reset");
};

export const sendSignupOtpEmail = async ({
  to,
  otp,
}: SendOtpEmailInput): Promise<void> => {
  if (env.NODE_ENV === "development") {
    logger.info(`[DEV] Signup OTP for ${to}: ${otp}`);
  }

  await deliverOtpEmail(to, otp, buildSignupOtpEmailContent, "signup");
};
