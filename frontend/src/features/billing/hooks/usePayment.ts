import { useState, useCallback } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useAppSelector } from "@/hooks/useRedux";
import { ROLES } from "@/constants/roles";
import { toast } from "@/utils/toast";
import { extractApiError } from "@/utils/apiError";
import { billingService } from "../api/services";
import type {
  PaymentListParams,
  VerifyPaymentPayload,
} from "../types";
import type {
  RazorpayPaymentFailureResponse,
  RazorpayPaymentSuccessResponse,
} from "@/types/razorpay";

/**
 * Tenant scope resolver (consistent with useBilling.ts).
 */
const useTenantScope = () => {
  const user = useAppSelector((s) => s.auth.user);
  const selectedOrgId = useAppSelector((s) => s.auth.selectedOrganizationId);

  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;
  const organizationId = isSuperAdmin
    ? selectedOrgId
    : (user?.organizationId ?? null);

  return {
    user,
    isSuperAdmin,
    organizationId,
    canReadBilling:
      user?.role === ROLES.SUPER_ADMIN || user?.role === ROLES.ADMIN,
  };
};

/**
 * Invalidate all billing queries on payment state change.
 */
export const useBillingInvalidation = () => {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.billing.all });
};

/**
 * Create order mutation.
 */
export const useCreatePaymentOrder = () => {
  return useMutation({
    mutationFn: (planId: string) => billingService.createOrder(planId),
    onError: (error) => toast.error(extractApiError(error).message),
  });
};

/**
 * Verify payment mutation.
 */
export const useVerifyPayment = () => {
  const invalidate = useBillingInvalidation();

  return useMutation({
    mutationFn: (payload: VerifyPaymentPayload) =>
      billingService.verifyPayment(payload),
    onSuccess: (response) => {
      const planName = response.data?.planName ?? "your";
      toast.success(`Payment successful! ${planName} plan is now active.`);
      invalidate();
    },
    onError: (error) => toast.error(extractApiError(error).message),
  });
};

/**
 * Tenant payment history query (scoped to organization).
 */
export const usePaymentHistory = (params?: PaymentListParams) => {
  const { organizationId, canReadBilling } = useTenantScope();

  return useQuery({
    queryKey: queryKeys.billing.paymentHistory(organizationId, params),
    queryFn: () => billingService.getMyPaymentHistory(params),
    enabled: canReadBilling && Boolean(organizationId),
    placeholderData: keepPreviousData,
  });
};

/**
 * Super Admin global payments query.
 */
export const useAllPayments = (params?: PaymentListParams) => {
  const isSuperAdmin =
    useAppSelector((s) => s.auth.user?.role) === ROLES.SUPER_ADMIN;

  return useQuery({
    queryKey: queryKeys.billing.allPayments(params),
    queryFn: () => billingService.getAllPayments(params),
    enabled: isSuperAdmin,
    placeholderData: keepPreviousData,
  });
};

export type PaymentFlowStatus =
  | "idle"
  | "creating_order"
  | "awaiting_payment"
  | "verifying"
  | "success"
  | "error"
  | "cancelled";

/**
 * High-level hook managing the complete Razorpay payment flow.
 *
 * Handles:
 * 1. Calling backend to create order (amount computed on backend)
 * 2. Launching Razorpay Checkout modal
 * 3. Handling checkout success → verifying signature on backend
 * 4. Handling checkout failure or dismissal
 * 5. Managing fine-grained UI state & invalidating queries on completion
 */
export const useRazorpayCheckout = () => {
  const [status, setStatus] = useState<PaymentFlowStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { user } = useTenantScope();
  const createOrderMutation = useCreatePaymentOrder();
  const verifyPaymentMutation = useVerifyPayment();

  const initiatePayment = useCallback(
    async (planId: string, planName?: string) => {
      setStatus("creating_order");
      setErrorMessage(null);

      try {
        if (!window.Razorpay) {
          throw new Error(
            "Razorpay SDK is not loaded. Please check your internet connection and reload.",
          );
        }

        // 1. Create order on backend (amount retrieved securely from DB)
        const orderResponse = await createOrderMutation.mutateAsync(planId);
        const orderData = orderResponse.data;

        if (!orderData) {
          throw new Error("Failed to receive payment order details.");
        }

        const { orderId, amount, currency, keyId } = orderData;

        setStatus("awaiting_payment");

        // 2. Open Razorpay Checkout modal
        const razorpay = new window.Razorpay({
          key: keyId,
          amount,
          currency,
          name: "Emvesso CRM",
          description: `${planName ?? "CRM"} Subscription`,
          order_id: orderId,
          prefill: {
            name: `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || undefined,
            email: user?.email ?? undefined,
          },
          theme: {
            color: "#6366f1",
          },
          modal: {
            ondismiss: () => {
              setStatus("cancelled");
              toast.info("Payment was cancelled.");
            },
            escape: true,
            backdropclose: false,
          },
          handler: async (response: RazorpayPaymentSuccessResponse) => {
            setStatus("verifying");
            try {
              // 3. Verify signature securely on backend
              await verifyPaymentMutation.mutateAsync({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              setStatus("success");
            } catch (verifyErr) {
              const err = extractApiError(verifyErr);
              setStatus("error");
              setErrorMessage(err.message);
            }
          },
        });

        razorpay.on("payment.failed", (response: RazorpayPaymentFailureResponse) => {
          setStatus("error");
          const desc = response.error?.description || "Payment failed at gateway.";
          setErrorMessage(desc);
          toast.error(`Payment failed: ${desc}`);
        });

        razorpay.open();
      } catch (err) {
        const error = extractApiError(err);
        setStatus("error");
        setErrorMessage(error.message);
        toast.error(error.message);
      }
    },
    [createOrderMutation, verifyPaymentMutation, user],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setErrorMessage(null);
  }, []);

  return {
    initiatePayment,
    status,
    errorMessage,
    isLoading: status === "creating_order" || status === "verifying",
    reset,
  };
};
