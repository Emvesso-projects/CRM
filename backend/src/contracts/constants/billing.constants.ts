import type { FeatureKey } from "./feature.constants";

/**
 * Billing catalogue.
 *
 * Mirrors the Prisma enums in prisma/models/billing.prisma and is the source of
 * truth for zod validation on both sides of the wire.
 */

export const PLAN_INTERVALS = ["MONTHLY", "QUARTERLY", "YEARLY"] as const;

export const SUBSCRIPTION_STATUSES = [
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
  "CANCELLED",
  "EXPIRED",
] as const;

/**
 * Days a lapsed subscription keeps full access before going read-only.
 *
 * Decision D3. Do not shorten this without a product conversation: the grace
 * window is the difference between "your card expired, please update it" and a
 * customer discovering at 9am that their sales team cannot work.
 */
export const SUBSCRIPTION_GRACE_PERIOD_DAYS = 7;

/** Single-currency INR by decision D6. */
export const BILLING_CURRENCY = "INR";

/** A plan's starting feature values. Omitted keys fall back to code defaults. */
type PlanSeedFeatures = Partial<Record<FeatureKey, number | boolean | null>>;

interface PlanSeed {
  code: string;
  slug: string;
  name: string;
  description: string;
  /** PAISE. 200000 = ₹2,000. */
  priceMinor: number;
  billingCycle: (typeof PLAN_INTERVALS)[number];
  trialDays: number;
  sortOrder: number;
  /** Can be assigned at all. */
  isActive?: boolean;
  /** Offered to customers. */
  isPublic?: boolean;
  features: PlanSeedFeatures;
}

/**
 * Default system plans, created ONCE at installation.
 *
 * ⚠️ PLACEHOLDER PRICING — structurally correct but commercially invented.
 * Replace with the real terms before onboarding a paying customer.
 *
 * Deliberately NOT re-applied on later deploys: once a super-admin has edited a
 * plan through the console, a redeploy silently resetting it to the value
 * checked into git would be a billing incident. seedPlans skips existing codes
 * unless explicitly forced.
 *
 * ── Catalogue shape ────────────────────────────────────────────────────────
 * Two public plans, same unlimited feature set, differing only in term:
 *
 *   MONTHLY   ₹599/month, carries the trial — this is the signup default
 *   ANNUAL    ₹5,988/year, no trial
 *
 * TRIAL is NOT a plan. `trialDays` on a paid plan already opens the
 * subscription in TRIALING with a trialEndsAt (see buildInitialSubscription),
 * so a separate free plan for trialling is both redundant and — because a plan
 * with unset limits means unlimited — a way to get the product for nothing.
 *
 * ── Only MONTHLY carries trialDays ─────────────────────────────────────────
 * trialDays lives on the plan, so whichever plan a subscription opens on
 * decides whether it starts in TRIALING. ANNUAL stays at 0 deliberately:
 * nobody should begin a 14-day evaluation by committing to a year, and a
 * super-admin provisioning an org for a customer who has already paid picks
 * ANNUAL and gets a straight ACTIVE period.
 *
 * A trialDays of 0 on a priced plan does NOT mean "no free access" — it means
 * the subscription opens ACTIVE for one full billing cycle, unpaid. That is
 * the third branch of buildInitialSubscription, and it is why MONTHLY must
 * carry a real trial rather than 0: otherwise self-service signup silently
 * hands out a free month with no banner and nothing prompting payment.
 *
 * ── Keep limits monotonic if a ladder is ever reintroduced ─────────────────
 * A cheaper plan that grants MORE of anything is a reason not to buy the
 * dearer one. This went wrong once already: a mid-tier plan was edited in the
 * console with only its seat count filled in, and the blank limits resolved to
 * unlimited, leaving the cheaper plan strictly more generous on leads,
 * prospects, quotations and items. Both plans here are deliberately unlimited
 * and identical, so the hazard is dormant — it returns the moment a tier with
 * real caps is added.
 */
export const PLAN_SEEDS: PlanSeed[] = [
  {
    code: "MONTHLY",
    slug: "monthly",
    name: "Monthly Plan",
    description:
      "Full CRM access with all features, billed monthly. Includes a 14-day free trial.",
    priceMinor: 59900, // ₹599/month (59,900 paise)
    billingCycle: "MONTHLY",
    // The signup default, so this is the trial every self-service org starts
    // on. Changing it to 0 does not remove the free window — it converts it
    // into a silent unpaid month. See the note above.
    trialDays: 14,
    sortOrder: 1,
    isActive: true,
    isPublic: true,
    features: {
      MAX_USERS: null,
      MAX_LEADS: null,
      MAX_PROSPECTS: null,
      MAX_QUOTATIONS: null,
      MAX_ITEMS: null,
      AUDIT_LOG_ACCESS: true,
      ANNOUNCEMENTS: true,
      QUOTATION_PDF: true,
    },
  },
  {
    code: "ANNUAL",
    slug: "annual",
    name: "Annual Plan",
    description: "Full CRM access with all features, billed annually (₹499/month).",
    priceMinor: 598800, // ₹5,988/year (₹499/month × 12 months = 598,800 paise)
    billingCycle: "YEARLY",
    // Intentionally no trial — see the note above. An org opened on ANNUAL is
    // one an operator provisioned for a customer who has already committed.
    trialDays: 0,
    sortOrder: 2,
    isActive: true,
    isPublic: true,
    features: {
      MAX_USERS: null,
      MAX_LEADS: null,
      MAX_PROSPECTS: null,
      MAX_QUOTATIONS: null,
      MAX_ITEMS: null,
      AUDIT_LOG_ACCESS: true,
      ANNOUNCEMENTS: true,
      QUOTATION_PDF: true,
    },
  },
];

/**
 * The plan self-service signup falls back to when the platform has no default
 * set. Must be a code in PLAN_SEEDS that is active, public, and carries the
 * trial — seedPlans checks all three before wiring it up.
 */
export const SIGNUP_DEFAULT_PLAN_CODE = "MONTHLY";
