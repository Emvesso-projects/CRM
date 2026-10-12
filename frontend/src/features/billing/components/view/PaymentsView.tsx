import { useMemo } from "react";
import ListViewLayout from "@/components/common/layout/ListViewLayout";
import { DataTable } from "@/components/common/table/DataTable";
import { useDataTable } from "@/components/common/table/useDataTable";
import EmptyState from "@/components/common/EmptyState";
import { useListView } from "@/hooks/useListView";
import type { FilterConfigItem } from "@/types/filter.types";
import { useAllPayments } from "../../hooks/usePayment";
import { getPaymentColumns } from "../table/payment.columns";
import type { PaymentListParams } from "../../types";

const FILTER_CONFIG: FilterConfigItem[] = [
  {
    type: "checkbox-group",
    name: "status",
    label: "Status",
    options: [
      { label: "Paid", value: "SUCCESS" },
      { label: "Pending", value: "PENDING" },
      { label: "Failed", value: "FAILED" },
      { label: "Cancelled", value: "CANCELLED" },
    ],
  },
];

/**
 * Super Admin global payments console.
 * Lists all transactions across all organizations.
 */
export const PaymentsView = () => {
  const { queryParams, onPageChange, toolbarProps } = useListView({
    filterConfig: FILTER_CONFIG,
  });

  const { data, isLoading } = useAllPayments(
    queryParams as PaymentListParams,
  );

  const payments = data?.data ?? [];

  const columns = useMemo(
    () => getPaymentColumns({ isSuperAdmin: true }),
    [],
  );

  const table = useDataTable({
    data: payments,
    columns,
    pageCount: -1,
    pagination: { pageIndex: 0, pageSize: payments.length || 10 },
    onPaginationChange: () => {},
  });

  return (
    <ListViewLayout
      {...toolbarProps}
      title="Payments"
      description="All Razorpay payment transactions across organizations"
      filterConfig={FILTER_CONFIG}
      searchPlaceholder="Search payments..."
      showAddButton={false}
      table={
        <DataTable
          table={table}
          isLoading={isLoading}
          loadingMessage="Loading payments..."
          emptyState={
            <EmptyState
              title="No payments found"
              description="Payments completed by organizations will appear here."
              className="border-none"
            />
          }
        />
      }
      meta={data?.meta}
      onPageChange={onPageChange}
      itemLabel="payments"
    />
  );
};

export default PaymentsView;
