import { type ColumnDef } from "@tanstack/react-table";
import type { PaymentSummary } from "../../types";
import { formatPrice, PLAN_INTERVAL_LABELS } from "../../constants/labels";
import PaymentStatusBadge from "../payment/PaymentStatusBadge";

const formatDateTime = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const getPaymentColumns = (
  options: { isSuperAdmin?: boolean } = {},
): ColumnDef<PaymentSummary>[] => {
  const columns: ColumnDef<PaymentSummary>[] = [];

  if (options.isSuperAdmin) {
    columns.push({
      header: "Organization",
      id: "organization",
      cell: ({ row }) => (
        <p className="truncate text-sm font-medium text-foreground">
          {row.original.organizationName ?? "—"}
        </p>
      ),
    });
  }

  columns.push(
    {
      header: "Date",
      id: "createdAt",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm text-foreground">
          {formatDateTime(row.original.createdAt)}
        </span>
      ),
    },
    {
      header: "Plan",
      id: "plan",
      cell: ({ row }) => {
        const { planName, billingCycle } = row.original;
        return (
          <div>
            <p className="text-sm font-medium text-foreground">{planName}</p>
            <p className="text-xs text-muted-foreground">
              {PLAN_INTERVAL_LABELS[billingCycle as keyof typeof PLAN_INTERVAL_LABELS] ??
                billingCycle}
            </p>
          </div>
        );
      },
    },
    {
      header: "Amount",
      id: "amount",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm font-semibold text-foreground">
          {formatPrice(row.original.amountMinor, row.original.currency)}
        </span>
      ),
    },
    {
      header: "Status",
      id: "status",
      cell: ({ row }) => <PaymentStatusBadge status={row.original.status} />,
    },
    {
      header: "Payment ID",
      id: "paymentId",
      cell: ({ row }) => {
        const { razorpayPaymentId, razorpayOrderId } = row.original;
        return (
          <div className="space-y-0.5 font-mono text-xs text-muted-foreground">
            {razorpayPaymentId ? (
              <p className="text-foreground">{razorpayPaymentId}</p>
            ) : (
              <p className="italic text-muted-foreground/70">Not captured</p>
            )}
            <p className="text-[11px] text-muted-foreground/60">{razorpayOrderId}</p>
          </div>
        );
      },
    },
  );

  return columns;
};
