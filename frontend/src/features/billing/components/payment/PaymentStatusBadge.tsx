import StatusBadge from "@/components/common/StatusBadge";
import type { PaymentStatus } from "../../types";

const PAYMENT_STATUS_CONFIG: Record<
  PaymentStatus,
  { label: string; type: "success" | "pending" | "error" | "inactive" }
> = {
  SUCCESS: { label: "Paid", type: "success" },
  PENDING: { label: "Pending", type: "pending" },
  FAILED: { label: "Failed", type: "error" },
  CANCELLED: { label: "Cancelled", type: "inactive" },
};

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
}

export const PaymentStatusBadge = ({ status }: PaymentStatusBadgeProps) => {
  const config = PAYMENT_STATUS_CONFIG[status] ?? {
    label: status,
    type: "inactive" as const,
  };

  return <StatusBadge status={status} label={config.label} type={config.type} />;
};

export default PaymentStatusBadge;
