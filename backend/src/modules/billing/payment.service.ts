import crypto from "crypto";
import { Role } from "@prisma/client";
import { prisma } from "../../config/db";
import { paymentRepository, type PaymentWithRelations } from "./payment.repository";
import { billingRepository } from "./billing.repository";
import { organizationRepository } from "../organization/organization.repository";
import { getRazorpayClient } from "../../config/razorpay";
import { env } from "../../config/env";
import { AppError } from "../../utils/errors/appError";
import { logger } from "../../config/logger";
import { ROLES } from "../../constants/roles";
import type { PaymentStatus } from "@prisma/client";

/**
 * Payment Service — Razorpay integration business logic.
 *
 * Security principles enforced here:
 *
 * 1. Amount is always read from the database, never from the frontend.
 * 2. Signature is verified with HMAC-SHA256 + timing-safe comparison.
 * 3. organizationId is checked on every verify call — a wrong org cannot
 *    claim another org's order.
 * 4. All writes that update both Payment and Subscription happen in a single
 *    DB transaction so they never partially succeed.
 * 5. Both verifyPayment and the webhook handler are idempotent: calling
 *    either multiple times for the same order is safe.
 */

type Actor = {
  id: string;
  role: Role;
  organizationId?: string | null;
};

// Months per billing interval — must match subscription.utils.ts
const MONTHS_PER_INTERVAL: Record<string, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  YEARLY: 12,
};

const addMonths = (from: Date, months: number): Date => {
  const next = new Date(from);
  next.setMonth(next.getMonth() + months);
  return next;
};

/** Compute the new period end date from today + one billing cycle. */
const computeNewPeriodEnd = (billingCycle: string): Date => {
  const months = MONTHS_PER_INTERVAL[billingCycle] ?? 1;
  return addMonths(new Date(), months);
};

/** Map a Payment DB row to the API summary shape. */
export type PaymentSummary = {
  id: string;
  organizationId: string;
  organizationName: string | null;
  planId: string;
  planName: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  amountMinor: number;
  currency: string;
  status: PaymentStatus;
  billingCycle: string;
  paidAt: string | null;
  createdAt: string;
};

const mapPayment = (p: PaymentWithRelations): PaymentSummary => ({
  id: p.id,
  organizationId: p.organizationId,
  organizationName: p.organization?.name ?? null,
  planId: p.planId,
  planName: p.plan?.name ?? "",
  razorpayOrderId: p.razorpayOrderId,
  razorpayPaymentId: p.razorpayPaymentId ?? null,
  amountMinor: p.amountMinor,
  currency: p.currency,
  status: p.status,
  billingCycle: p.billingCycle,
  paidAt: p.paidAt?.toISOString() ?? null,
  createdAt: p.createdAt.toISOString(),
});

/** Resolve the organization that an Admin request is about. */
const resolveOrganizationId = (actor: Actor): string => {
  const orgId = actor.organizationId;
  if (!orgId) {
    throw AppError.validation.badRequest(
      "No organization in context. Use requireOrganization middleware.",
    );
  }
  return orgId;
};

export const paymentService = {
  /**
   * Create a Razorpay order for the given plan.
   *
   * Steps:
   * 1. Validate organization is active.
   * 2. Load plan from DB — amount always comes from DB, never from the client.
   * 3. Return an existing PENDING order if one already exists (dedup guard).
   * 4. Call Razorpay orders.create() and write a PENDING Payment row.
   * 5. Return orderId + amount + keyId to the frontend.
   */
  async createOrder(
    actor: Actor,
    planId: string,
  ): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
    paymentId: string;
  }> {
    const organizationId = resolveOrganizationId(actor);

    // Verify org exists and is not archived
    const org = await organizationRepository.findById(organizationId, undefined, {
      includeArchived: false,
    });
    if (!org) {
      throw AppError.resource.notFound("Organization");
    }

    // Load plan from DB — NEVER trust client-supplied amount
    const plan = await billingRepository.findPlanById(planId);
    if (!plan) {
      throw AppError.resource.notFound("Plan", planId);
    }
    if (!plan.isActive) {
      throw AppError.business.ruleViolation(
        `Plan "${plan.name}" is retired and cannot be purchased`,
      );
    }
    if (plan.priceMinor === 0) {
      throw AppError.business.ruleViolation(
        "Free plans require no payment. Contact your account manager to activate.",
      );
    }

    // Dedup: return existing PENDING order for this org+plan if one exists and is not stale
    const existing = await paymentRepository.findPendingForOrgAndPlan(
      organizationId,
      planId,
    );
    if (existing) {
      const ORDER_STALE_MS = 30 * 60 * 1000; // 30 minutes
      const isStale = Date.now() - existing.createdAt.getTime() > ORDER_STALE_MS;

      if (isStale) {
        logger.info("Cancelling stale PENDING order", {
          paymentId: existing.id,
          razorpayOrderId: existing.razorpayOrderId,
          createdAt: existing.createdAt.toISOString(),
          organizationId,
          planId,
        });
        await paymentRepository.update(existing.id, { status: "CANCELLED" });
        // Fall through to create a fresh Razorpay order
      } else {
        logger.info("Returning existing PENDING order", {
          paymentId: existing.id,
          razorpayOrderId: existing.razorpayOrderId,
          organizationId,
          planId,
        });
        return {
          orderId: existing.razorpayOrderId,
          amount: existing.amountMinor,
          currency: existing.currency,
          keyId: env.RAZORPAY_KEY_ID!,
          paymentId: existing.id,
        };
      }
    }

    // Create Razorpay order
    const razorpay = getRazorpayClient();
    const receipt = `${organizationId.slice(0, 8)}-${planId.slice(0, 8)}-${Date.now()}`;

    let rzpOrder: { id: string; amount: number; currency: string };
    try {
      rzpOrder = await razorpay.orders.create({
        amount: plan.priceMinor,
        currency: plan.currency,
        receipt,
      }) as { id: string; amount: number; currency: string };
    } catch (err) {
      logger.error("PAYMENT_ORDER_CREATION_FAILED", {
        organizationId,
        planId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw AppError.business.ruleViolation(
        "Could not create payment order. Please try again.",
      );
    }

    // Write PENDING payment row — snapshot amount and billingCycle from plan
    const payment = await paymentRepository.create({
      organizationId,
      planId,
      razorpayOrderId: rzpOrder.id,
      amountMinor: plan.priceMinor, // from DB, not from Razorpay response
      currency: plan.currency,
      billingCycle: plan.billingCycle,
    });

    logger.info("PAYMENT_ORDER_CREATED", {
      event: "PAYMENT_ORDER_CREATED",
      paymentId: payment.id,
      razorpayOrderId: rzpOrder.id,
      organizationId,
      planId,
      amountMinor: plan.priceMinor,
    });

    return {
      orderId: rzpOrder.id,
      amount: plan.priceMinor,
      currency: plan.currency,
      keyId: env.RAZORPAY_KEY_ID!,
      paymentId: payment.id,
    };
  },

  /**
   * Verify a Razorpay payment after the Checkout handler fires.
   *
   * Steps:
   * 1. Load Payment row by orderId.
   * 2. Verify organizationId matches the authenticated actor (cross-org guard).
   * 3. Idempotency: return success if already SUCCESS.
   * 4. Verify HMAC-SHA256 signature with timing-safe comparison.
   * 5. In a transaction: mark Payment SUCCESS + advance Subscription period.
   */
  async verifyPayment(
    actor: Actor,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ): Promise<PaymentSummary> {
    const organizationId = resolveOrganizationId(actor);

    const payment = await paymentRepository.findByOrderId(razorpayOrderId);
    if (!payment) {
      throw AppError.resource.notFound("Payment order");
    }

    // Cross-org security: this org can only verify their own orders
    if (payment.organizationId !== organizationId) {
      logger.warn("Cross-org payment verification attempt", {
        actorOrgId: organizationId,
        paymentOrgId: payment.organizationId,
        razorpayOrderId,
      });
      throw AppError.authorization.forbidden(
        "You cannot verify a payment that belongs to a different organization.",
      );
    }

    // Idempotency: already SUCCESS — return current state
    if (payment.status === "SUCCESS") {
      logger.info("Payment already verified — returning idempotently", {
        paymentId: payment.id,
        razorpayOrderId,
      });
      return mapPayment(payment);
    }

    // Reject if already in a terminal failed/cancelled state
    if (payment.status === "FAILED" || payment.status === "CANCELLED") {
      throw AppError.business.stateConflict(
        `This payment order is no longer valid (status: ${payment.status}). Please start a new payment.`,
      );
    }

    // HMAC-SHA256 signature verification
    if (!env.RAZORPAY_KEY_SECRET) {
      throw AppError.validation.badRequest("Razorpay is not configured on this server.");
    }

    // Guard: signature must be a 64-char hex string
    if (!/^[0-9a-f]{64}$/i.test(razorpaySignature)) {
      await paymentRepository.update(payment.id, { status: "FAILED" });
      logger.warn("PAYMENT_FAILED", {
        event: "PAYMENT_FAILED",
        reason: "INVALID_SIGNATURE_FORMAT",
        paymentId: payment.id,
        razorpayOrderId,
        organizationId,
      });
      throw AppError.validation.badRequest("Invalid payment signature format.");
    }

    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    const expectedBuf = Buffer.from(expectedSignature, "hex");
    const signatureBuf = Buffer.from(razorpaySignature, "hex");

    const isValid =
      expectedBuf.length === signatureBuf.length &&
      crypto.timingSafeEqual(expectedBuf, signatureBuf);

    if (!isValid) {
      // Mark FAILED so a future retry does not attempt verification again
      await paymentRepository.update(payment.id, { status: "FAILED" });
      logger.warn("PAYMENT_FAILED", {
        event: "PAYMENT_FAILED",
        reason: "SIGNATURE_VERIFICATION_FAILED",
        paymentId: payment.id,
        razorpayOrderId,
        organizationId,
      });
      throw AppError.validation.badRequest(
        "Payment signature verification failed. This payment has been marked as failed.",
      );
    }

    // Success — update Payment and advance Subscription in a single atomic transaction
    const now = new Date();
    const newPeriodEnd = computeNewPeriodEnd(payment.billingCycle);

    const updated = await prisma.$transaction(async (tx) => {
      const updatedPayment = await paymentRepository.update(
        payment.id,
        {
          status: "SUCCESS",
          razorpayPaymentId,
          razorpaySignature,
          paidAt: now,
        },
        tx,
      );

      await billingRepository.updateSubscription(
        organizationId,
        {
          // The paid-for plan, not the one they were on. Without this an
          // upgrade bills the new price and extends by the new cycle while
          // leaving entitlements — and the billing UI — on the old plan.
          planId: payment.planId,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: newPeriodEnd,
          cancelAtPeriodEnd: false,
        },
        tx,
      );

      return updatedPayment;
    });

    logger.info("PAYMENT_VERIFIED", {
      event: "PAYMENT_VERIFIED",
      trigger: "frontend_verify",
      paymentId: payment.id,
      razorpayOrderId,
      razorpayPaymentId,
      organizationId,
      planId: payment.planId,
    });
    logger.info("SUBSCRIPTION_ACTIVATED", {
      event: "SUBSCRIPTION_ACTIVATED",
      trigger: "frontend_verify",
      organizationId,
      planId: payment.planId,
      newPeriodEnd: newPeriodEnd.toISOString(),
    });

    return mapPayment(updated);
  },

  /**
   * Mark a payment SUCCESS via webhook event.
   *
   * Idempotent: safe to call multiple times for the same order.
   * Used by the webhook handler to handle the case where the frontend
   * disconnected before calling verifyPayment.
   */
  async markSuccessFromWebhook(
    razorpayOrderId: string,
    razorpayPaymentId: string,
  ): Promise<void> {
    const payment = await paymentRepository.findByOrderId(razorpayOrderId);
    if (!payment) {
      logger.warn("Webhook: payment order not found — possibly a different environment", {
        razorpayOrderId,
        razorpayPaymentId,
      });
      return; // Idempotent — not our order
    }

    if (payment.status === "SUCCESS") {
      logger.debug("Webhook: payment already SUCCESS — skipping", {
        paymentId: payment.id,
        razorpayOrderId,
      });
      return; // Idempotent
    }

    const now = new Date();
    const newPeriodEnd = computeNewPeriodEnd(payment.billingCycle);

    await prisma.$transaction(async (tx) => {
      await paymentRepository.update(
        payment.id,
        {
          status: "SUCCESS",
          razorpayPaymentId,
          paidAt: now,
        },
        tx,
      );

      await billingRepository.updateSubscription(
        payment.organizationId,
        {
          // See verifyPayment — the webhook is the same activation and must
          // move the plan too, or whichever path wins the race decides it.
          planId: payment.planId,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: newPeriodEnd,
          cancelAtPeriodEnd: false,
        },
        tx,
      );
    });

    logger.info("PAYMENT_VERIFIED", {
      event: "PAYMENT_VERIFIED",
      trigger: "webhook",
      paymentId: payment.id,
      razorpayOrderId,
      razorpayPaymentId,
      organizationId: payment.organizationId,
    });
    logger.info("SUBSCRIPTION_ACTIVATED", {
      event: "SUBSCRIPTION_ACTIVATED",
      trigger: "webhook",
      organizationId: payment.organizationId,
      planId: payment.planId,
      newPeriodEnd: newPeriodEnd.toISOString(),
    });
  },

  /**
   * Mark a payment FAILED via webhook event.
   * Idempotent: safe to call multiple times.
   */
  async markFailedFromWebhook(razorpayOrderId: string): Promise<void> {
    const payment = await paymentRepository.findByOrderId(razorpayOrderId);
    if (!payment) {
      logger.warn("Webhook: payment order not found for failure event", {
        razorpayOrderId,
      });
      return;
    }

    if (payment.status !== "PENDING") {
      logger.debug("Webhook: payment not PENDING — skipping failure mark", {
        paymentId: payment.id,
        currentStatus: payment.status,
      });
      return;
    }

    await paymentRepository.update(payment.id, { status: "FAILED" });

    logger.warn("PAYMENT_FAILED", {
      event: "PAYMENT_FAILED",
      trigger: "webhook",
      paymentId: payment.id,
      razorpayOrderId,
      organizationId: payment.organizationId,
    });
  },

  /**
   * Paginated payment history for the authenticated admin's organization.
   */
  async getPaymentHistory(
    actor: Actor,
    params: { page?: number; limit?: number; status?: PaymentStatus },
  ): Promise<{ data: PaymentSummary[]; meta: any }> {
    const organizationId = resolveOrganizationId(actor);

    const result = await paymentRepository.findByOrganization(organizationId, {
      pageNum: params.page,
      limitNum: params.limit,
      status: params.status,
    });

    return {
      data: result.data.map(mapPayment),
      meta: result.meta,
    };
  },

  /**
   * Paginated payment history across all organizations (super-admin).
   */
  async getAllPayments(
    params: {
      page?: number;
      limit?: number;
      organizationId?: string;
      status?: PaymentStatus;
    },
  ): Promise<{ data: PaymentSummary[]; meta: any }> {
    const result = await paymentRepository.findAll({
      pageNum: params.page,
      limitNum: params.limit,
      organizationId: params.organizationId,
      status: params.status,
    });

    return {
      data: result.data.map(mapPayment),
      meta: result.meta,
    };
  },
};
