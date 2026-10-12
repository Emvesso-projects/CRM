import { Prisma, PaymentStatus } from "@prisma/client";
import { prisma, type DB } from "../../config/db";
import { paginate } from "../../utils/db/paginate";

/**
 * Payment Repository
 *
 * All database access for Razorpay Payment rows.
 *
 * Keeps SQL out of the service layer. Every function returns typed Prisma
 * results — the service maps them to summary shapes before they leave the
 * module boundary.
 */

/** What the payment table joins back to. */
const paymentInclude = {
  plan: {
    select: { id: true, name: true, billingCycle: true },
  },
  organization: {
    select: { id: true, name: true, slug: true },
  },
} satisfies Prisma.PaymentInclude;

export type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: typeof paymentInclude;
}>;

export interface PaymentFindAllOptions {
  pageNum?: number;
  limitNum?: number;
  organizationId?: string;
  status?: PaymentStatus;
}

export const paymentRepository = {
  /** Create a new PENDING payment row when an order is created in Razorpay. */
  async create(data: {
    organizationId: string;
    planId: string;
    razorpayOrderId: string;
    amountMinor: number;
    currency: string;
    billingCycle: string;
  }): Promise<PaymentWithRelations> {
    return prisma.payment.create({
      data: {
        organizationId: data.organizationId,
        planId: data.planId,
        razorpayOrderId: data.razorpayOrderId,
        amountMinor: data.amountMinor,
        currency: data.currency,
        billingCycle: data.billingCycle,
        status: "PENDING",
      },
      include: paymentInclude,
    });
  },

  /** Find by Razorpay Order ID — used in verify and webhook handlers. */
  async findByOrderId(orderId: string): Promise<PaymentWithRelations | null> {
    return prisma.payment.findUnique({
      where: { razorpayOrderId: orderId },
      include: paymentInclude,
    });
  },

  /** Find by Razorpay Payment ID — idempotency check in webhook handler. */
  async findByPaymentId(paymentId: string): Promise<PaymentWithRelations | null> {
    return prisma.payment.findUnique({
      where: { razorpayPaymentId: paymentId },
      include: paymentInclude,
    });
  },

  /**
   * Find an existing PENDING order for an org+plan combination.
   *
   * Prevents duplicate Razorpay orders when the user clicks "Pay Now"
   * multiple times quickly before the first order resolves.
   */
  async findPendingForOrgAndPlan(
    organizationId: string,
    planId: string,
  ): Promise<PaymentWithRelations | null> {
    return prisma.payment.findFirst({
      where: { organizationId, planId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: paymentInclude,
    });
  },

  /** Update a payment row — used by verify and webhook handlers. */
  async update(
    id: string,
    data: Prisma.PaymentUpdateInput,
    tx?: DB,
  ): Promise<PaymentWithRelations> {
    const db = tx || prisma;
    return db.payment.update({
      where: { id },
      data,
      include: paymentInclude,
    });
  },

  /**
   * Paginated payment history for one organization.
   * Always ordered newest-first.
   */
  async findByOrganization(
    organizationId: string,
    options: { pageNum?: number; limitNum?: number; status?: PaymentStatus },
  ) {
    const page = options.pageNum ?? 1;
    const limit = options.limitNum ?? 20;

    const where: Prisma.PaymentWhereInput = { organizationId };
    if (options.status) where.status = options.status;

    const result = await paginate(
      prisma.payment,
      where,
      { page, limit },
      undefined,
      {
        orderBy: { createdAt: "desc" },
        include: paymentInclude,
      },
    );

    return {
      ...result,
      data: result.data as PaymentWithRelations[],
    };
  },

  /**
   * Paginated payment history across ALL organizations (super-admin).
   * Optional organizationId filter.
   */
  async findAll(options: PaymentFindAllOptions) {
    const page = options.pageNum ?? 1;
    const limit = options.limitNum ?? 20;

    const where: Prisma.PaymentWhereInput = {};
    if (options.organizationId) where.organizationId = options.organizationId;
    if (options.status) where.status = options.status;

    const result = await paginate(
      prisma.payment,
      where,
      { page, limit },
      undefined,
      {
        orderBy: { createdAt: "desc" },
        include: paymentInclude,
      },
    );

    return {
      ...result,
      data: result.data as PaymentWithRelations[],
    };
  },
};

