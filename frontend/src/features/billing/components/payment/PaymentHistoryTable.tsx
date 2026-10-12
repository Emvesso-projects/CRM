import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/common/table/DataTable";
import { useDataTable } from "@/components/common/table/useDataTable";
import EmptyState from "@/components/common/EmptyState";
import { usePaymentHistory } from "../../hooks/usePayment";
import { getPaymentColumns } from "../table/payment.columns";

export const PaymentHistoryTable = () => {
  const { data, isLoading } = usePaymentHistory({ limit: 10 });
  const payments = data?.data ?? [];

  const columns = useMemo(() => getPaymentColumns({ isSuperAdmin: false }), []);

  const table = useDataTable({
    data: payments,
    columns,
    pageCount: -1,
    pagination: { pageIndex: 0, pageSize: 10 },
    onPaginationChange: () => {},
  });

  return (
    <Card className="overflow-hidden p-6">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-foreground">Payment History</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Recent transactions and invoices for your organization.
        </p>
      </div>

      <DataTable
        table={table}
        isLoading={isLoading}
        loadingMessage="Loading payment history..."
        emptyState={
          <EmptyState
            title="No payments yet"
            description="Completed payments through Razorpay will be listed here."
            className="border-none py-8"
          />
        }
      />
    </Card>
  );
};

export default PaymentHistoryTable;
