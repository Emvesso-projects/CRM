import { useSearchParams } from "react-router-dom";
import PageTabs from "@/components/common/PageTabs";
import SubscriptionsView from "./SubscriptionsView";
import PlansView from "./PlansView";
import PaymentsView from "./PaymentsView";

/**
 * Platform billing console (super-admin).
 *
 * Three jobs:
 * 1. Who is on what (Subscriptions)
 * 2. What is on offer (Plans)
 * 3. Financial transactions & invoices (Payments)
 */

const CONSOLE_TABS = [
  { value: "subscriptions", label: "Subscriptions" },
  { value: "plans", label: "Plans" },
  { value: "payments", label: "Payments" },
] as const;

type ConsoleTab = (typeof CONSOLE_TABS)[number]["value"];

const BillingConsoleView = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const requested = searchParams.get("tab");
  const activeTab: ConsoleTab = CONSOLE_TABS.some(
    (tab) => tab.value === requested,
  )
    ? (requested as ConsoleTab)
    : "subscriptions";

  return (
    <div className="space-y-6">
      <PageTabs
        tabs={CONSOLE_TABS}
        value={activeTab}
        onValueChange={(value) =>
          setSearchParams({ tab: value }, { replace: true })
        }
      />

      {/*
        Rendered outside the Tabs primitive rather than in TabsContent: each view
        owns a full list screen with its own filters and pagination, and mounting
        them all would fire three sets of queries for a panel nobody is looking at.
      */}
      {activeTab === "subscriptions" && <SubscriptionsView />}
      {activeTab === "plans" && <PlansView />}
      {activeTab === "payments" && <PaymentsView />}
    </div>
  );
};

export default BillingConsoleView;

