import crypto from "crypto";
import { Request, Response } from "express";
import { paymentService } from "./payment.service";
import { ApiResponse } from "../../utils/response/response";
import { AppError } from "../../utils/errors/appError";
import { asyncHandler } from "../../utils/middleware/asyncHandler";
import { logger } from "../../config/logger";
import { recordAudit } from "../../utils/audit/recordAudit";
import { env } from "../../config/env";
import { validateData } from "../../middlewares/validationMiddleware";
import {
  CreateOrderSchema,
  VerifyPaymentSchema,
  PaymentListSchema,
} from "../../contracts/validation";

/**
 * Payment Controller — HTTP boundary for Razorpay payment flow.
 *
 * Keeps all HTTP parsing (req, res) out of the service layer.
 * Delegates business logic entirely to paymentService.
 */

const requireActor = (req: Request) => {
  if (!req.user) {
    throw AppError.authentication.unauthorized("User not authenticated");
  }
  return {
    id: req.user.id,
    role: req.user.role,
    organizationId: req.user.organizationId,
  };
};

// POST /billing/payment/orders
const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireActor(req);
  const { planId } = CreateOrderSchema.parse(req.body);

  const result = await paymentService.createOrder(actor, planId);

  return ApiResponse.created(res, result, "Payment order created");
});

// POST /billing/payment/verify
const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireActor(req);
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } =
    VerifyPaymentSchema.parse(req.body);

  const payment = await paymentService.verifyPayment(
    actor,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  );

  logger.info("PAYMENT_VERIFIED", {
    event: "PAYMENT_VERIFIED",
    userId: actor.id,
    paymentId: payment.id,
    razorpayOrderId,
    razorpayPaymentId,
    organizationId: payment.organizationId,
    amountMinor: payment.amountMinor,
  });

  await recordAudit(req, {
    action: "PAYMENT_SUCCESS",
    entityType: "PAYMENT",
    entityId: payment.id,
    organizationId: payment.organizationId,
    after: {
      razorpayOrderId,
      razorpayPaymentId,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      planName: payment.planName,
      paidAt: payment.paidAt,
    },
  });

  return ApiResponse.ok(res, payment, "Payment verified and subscription activated");
});

// GET /billing/payment/history
const getMyPaymentHistory = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireActor(req);
  const params = PaymentListSchema.parse(req.query);

  const result = await paymentService.getPaymentHistory(actor, {
    page: params.page,
    limit: params.limit,
    status: params.status,
  });

  return ApiResponse.ok(res, result.data, "Payment history retrieved", result.meta);
});

// GET /billing/payments  (super-admin only)
const getAllPayments = asyncHandler(async (req: Request, res: Response) => {
  const params = PaymentListSchema.parse(req.query);

  const result = await paymentService.getAllPayments({
    page: params.page,
    limit: params.limit,
    organizationId: params.organizationId,
    status: params.status,
  });

  return ApiResponse.ok(res, result.data, "Payments retrieved", result.meta);
});

/**
 * POST /api/v1/billing/webhook/razorpay
 *
 * Razorpay webhook handler.
 *
 * Security model:
 * - This route receives express.raw() body — express.json() has NOT run.
 * - Signature is verified against the raw bytes using RAZORPAY_WEBHOOK_SECRET.
 * - Body is parsed ONLY after successful signature verification.
 * - Always returns 200 — Razorpay retries any non-200 response up to 5 times,
 *   which would replay successful payments.
 *
 * Idempotency:
 * - Payment rows are checked for their current status before any write.
 * - razorpayPaymentId @unique at DB level prevents duplicate rows even if
 *   the frontend verify call and this webhook race simultaneously.
 */
const handleWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers["x-razorpay-signature"] as string | undefined;

  if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) {
    logger.warn("Webhook received without valid X-Razorpay-Signature header");
    return res.status(400).json({ error: "Missing or invalid signature header" });
  }

  if (!env.RAZORPAY_WEBHOOK_SECRET) {
    logger.error("RAZORPAY_WEBHOOK_SECRET is not configured — webhook rejected");
    return res.status(500).json({ error: "Webhook not configured" });
  }

  // Verify signature against RAW body bytes
  const rawBody = req.body as Buffer;
  const expectedSignature = crypto
    .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  const expectedBuf = Buffer.from(expectedSignature, "hex");
  const signatureBuf = Buffer.from(signature, "hex");

  const isValid =
    expectedBuf.length === signatureBuf.length &&
    crypto.timingSafeEqual(expectedBuf, signatureBuf);

  if (!isValid) {
    logger.warn("Webhook signature verification failed — rejecting", {
      receivedSignature: signature.slice(0, 8) + "...",
    });
    return res.status(400).json({ error: "Invalid signature" });
  }

  // Parse body ONLY after signature is verified
  let event: {
    event: string;
    payload: {
      payment?: { entity: { id: string; order_id: string } };
      order?: { entity: { id: string } };
    };
  };

  try {
    event = JSON.parse(rawBody.toString("utf-8"));
  } catch {
    logger.warn("Webhook: failed to parse JSON body");
    return res.status(400).json({ error: "Invalid JSON" });
  }

  logger.info("Razorpay webhook received", { event: event.event });

  try {
    switch (event.event) {
      case "payment.captured":
      case "order.paid": {
        const paymentEntity = event.payload.payment?.entity;
        if (!paymentEntity) {
          logger.warn("Webhook: missing payment entity", { event: event.event });
          break;
        }
        await paymentService.markSuccessFromWebhook(
          paymentEntity.order_id,
          paymentEntity.id,
        );
        break;
      }

      case "payment.failed": {
        const paymentEntity = event.payload.payment?.entity;
        if (!paymentEntity) {
          logger.warn("Webhook: missing payment entity for failure", {
            event: event.event,
          });
          break;
        }
        await paymentService.markFailedFromWebhook(paymentEntity.order_id);
        break;
      }

      default:
        logger.debug("Webhook: unhandled event type — ignoring", {
          event: event.event,
        });
    }
  } catch (err) {
    // Log but still return 200 — Razorpay MUST get a 200 or it retries
    logger.error("Webhook handler error", {
      event: event.event,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Always return 200 to Razorpay
  return res.status(200).json({ received: true });
});

export const paymentController = {
  createOrder,
  verifyPayment,
  getMyPaymentHistory,
  getAllPayments,
  handleWebhook,
};
