import { Router } from "express";
import express from "express";
import { paymentController } from "./payment.controller";

/**
 * Webhook router — uses express.raw() middleware.
 *
 * Razorpay's webhook signature is computed over the raw request body bytes.
 * If express.json() parses the body first, the Buffer is gone and the
 * HMAC computation produces a different result, making every webhook invalid.
 *
 * This router is intentionally separate from billing.route.ts so it can be
 * mounted in app.ts BEFORE the global csrfProtection and apiLimiter
 * middlewares. Webhooks originate from Razorpay servers — they carry no
 * browser CSRF headers and legitimate payment bursts would trip the rate
 * limiter. The same exemption is already in place for the internal job
 * scheduler (/api/v1/internal).
 *
 * Authentication: none — verified instead via HMAC-SHA256 signature.
 */
const webhookRouter = Router();

webhookRouter.post(
  "/razorpay",
  // express.raw() captures the raw body as a Buffer.
  // The type filter ensures JSON payloads are captured correctly.
  express.raw({ type: "application/json" }),
  paymentController.handleWebhook,
);

export default webhookRouter;
