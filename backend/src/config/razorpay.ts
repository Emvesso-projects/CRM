import Razorpay from "razorpay";
import { env } from "./env";
import { AppError } from "../utils/errors/appError";

/**
 * Razorpay SDK singleton.
 *
 * A single instance is created at startup and reused across all payment
 * handlers. Initialising per-request is wasteful and makes it harder to
 * spot missing configuration early.
 *
 * Throws a clear configuration error rather than silently constructing an
 * instance that would fail on every API call with a cryptic "key_id required"
 * message — better to fail loud at checkout than quiet at boot for optional config.
 */
const createRazorpayClient = (): Razorpay => {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw AppError.validation.badRequest(
      "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the environment.",
    );
  }

  return new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });
};

// Lazy-initialised so the rest of the app still boots in environments
// where Razorpay keys are intentionally absent.
let _client: Razorpay | null = null;

export const getRazorpayClient = (): Razorpay => {
  if (!_client) {
    _client = createRazorpayClient();
  }
  return _client;
};
