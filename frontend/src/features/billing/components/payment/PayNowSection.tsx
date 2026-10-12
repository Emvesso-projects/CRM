import { useState } from "react";
import {
  CreditCard,
  ShieldCheck,
  Zap,
  ArrowRight,
  RefreshCw,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PlanSummary, SubscriptionSummary } from "@/contracts/types";
import { usePlans } from "../../hooks/useBilling";
import { useRazorpayCheckout } from "../../hooks/usePayment";
import { formatPrice, PLAN_INTERVAL_LABELS } from "../../constants/labels";

interface PayNowSectionProps {
  subscription: SubscriptionSummary;
}

export const PayNowSection = ({ subscription }: PayNowSectionProps) => {
  const { plan, effectiveStatus } = subscription;
  const [selectedPlanId, setSelectedPlanId] = useState<string>(plan.id);
  const [showPlanPicker, setShowPlanPicker] = useState(false);

  const { data: plansData, isLoading: plansLoading } = usePlans({
    includeInactive: false,
    includePrivate: false,
  });

  const { initiatePayment, isLoading, status, errorMessage, reset } =
    useRazorpayCheckout();

  const availablePlans = (plansData?.data ?? []).filter(
    (p: PlanSummary) => p.priceMinor > 0,
  );

  const targetPlan =
    availablePlans.find((p) => p.id === selectedPlanId) ??
    (plan.priceMinor > 0 ? (plan as PlanSummary) : availablePlans[0]);

  const handlePay = () => {
    if (!targetPlan) return;
    initiatePayment(targetPlan.id, targetPlan.name);
  };

  const isRenewal = targetPlan?.id === plan.id;
  const isLapsed =
    effectiveStatus === "EXPIRED" ||
    effectiveStatus === "PAST_DUE" ||
    effectiveStatus === "TRIALING";

  return (
    <Card className="relative overflow-hidden border-indigo-500/20 bg-gradient-to-br from-indigo-50/50 via-background to-purple-50/30 p-6 shadow-sm dark:from-indigo-950/20 dark:via-background dark:to-purple-950/10">
      {/* Decorative gradient blur */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-indigo-500/10 blur-2xl dark:bg-indigo-400/10" />

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              Razorpay Secure Checkout
            </span>
            <span className="inline-flex items-center rounded-md border border-amber-300/80 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-300">
              Test Mode
            </span>
          </div>

          <h3 className="text-xl font-bold text-foreground">
            {isLapsed
              ? "Activate or Renew Your Subscription"
              : "Subscription & Payments"}
          </h3>
          <p className="max-w-xl text-sm text-muted-foreground">
            {targetPlan
              ? `${isRenewal ? "Renew" : "Upgrade to"} the ${targetPlan.name} plan for ${formatPrice(targetPlan.priceMinor, targetPlan.currency)} per ${PLAN_INTERVAL_LABELS[targetPlan.billingCycle]}. Instant activation upon payment.`
              : "Select a plan to start your subscription."}
          </p>

          {errorMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-6 px-2 text-xs"
                onClick={reset}
              >
                Dismiss
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          {availablePlans.length > 1 && (
            <Button
              type="button"
              variant="outline"
              size="default"
              className="gap-2 border-border/80"
              onClick={() => setShowPlanPicker(!showPlanPicker)}
              disabled={isLoading}
            >
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
              {showPlanPicker ? "Hide Plans" : "Choose Other Plan"}
            </Button>
          )}

          <Button
            type="button"
            size="lg"
            className="group relative gap-2 bg-indigo-600 px-6 font-semibold text-white shadow-md shadow-indigo-600/20 transition-all hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/30 active:scale-[0.98] dark:bg-indigo-600 dark:hover:bg-indigo-500"
            onClick={handlePay}
            disabled={isLoading || !targetPlan}
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                <span>
                  Pay Now{" "}
                  {targetPlan
                    ? `(${formatPrice(targetPlan.priceMinor, targetPlan.currency)})`
                    : ""}
                </span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Plan picker dropdown grid when toggled */}
      {showPlanPicker && availablePlans.length > 0 && (
        <div className="relative z-10 mt-6 border-t border-border/60 pt-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Select a plan to subscribe:
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {availablePlans.map((p) => {
              const isSelected = p.id === (targetPlan?.id ?? plan.id);
              const isCurrent = p.id === plan.id;

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPlanId(p.id)}
                  className={`relative cursor-pointer rounded-xl border p-4 transition-all ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-500/5 shadow-sm ring-1 ring-indigo-600 dark:border-indigo-400 dark:ring-indigo-400"
                      : "border-border/70 bg-card hover:border-border hover:bg-muted/40"
                  }`}
                >
                  {isCurrent && (
                    <span className="absolute right-3 top-3 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Current
                    </span>
                  )}
                  <div className="font-semibold text-foreground">{p.name}</div>
                  <div className="mt-1 text-lg font-bold text-foreground">
                    {formatPrice(p.priceMinor, p.currency)}
                    <span className="text-xs font-normal text-muted-foreground">
                      {" "}
                      / {PLAN_INTERVAL_LABELS[p.billingCycle]}
                    </span>
                  </div>
                  {p.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {p.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trust & security footer */}
      <div className="relative z-10 mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border/40 pt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>256-bit encrypted checkout powered by Razorpay</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Cards, UPI, Netbanking & Wallets supported</span>
        </div>
      </div>
    </Card>
  );
};

export default PayNowSection;
