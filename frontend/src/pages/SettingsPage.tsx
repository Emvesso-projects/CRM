import { useSearchParams } from "react-router-dom";
import PageHeader from "@/components/common/PageHeader";
import PageTabs from "@/components/common/PageTabs";
import { BillingView } from "@/features/billing";
import {
  CompanyProfileView,
  QuotationSettingsView,
} from "@/features/organizations";

/**
 * Organization settings.
 *
 * The active tab lives in the query string so a banner, an email or a support
 * agent can deep-link straight to billing or quotation setup.
 */

const SETTINGS_TABS = [
  { value: "company", label: "Company" },
  { value: "billing", label: "Billing" },
  { value: "quotation", label: "Quotation" },
] as const;

type SettingsTab = (typeof SETTINGS_TABS)[number]["value"];

/**
 * Company, not billing: settings should open on who you are, not on your
 * invoice — and for a new org this is the tab with the most missing. Existing
 * deep links are unaffected because the active tab comes from `?tab=`.
 */
const DEFAULT_TAB: SettingsTab = "company";

const SettingsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const requested = searchParams.get("tab");
  const activeTab: SettingsTab = SETTINGS_TABS.some(
    (tab) => tab.value === requested,
  )
    ? (requested as SettingsTab)
    : DEFAULT_TAB;

  const handleTabChange = (value: string) => {
    // replace, not push: flipping tabs should not fill the user's back button.
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your organization's plan, quotation setup, and preferences"
      />

      <PageTabs
        tabs={SETTINGS_TABS}
        value={activeTab}
        onValueChange={handleTabChange}
      />

      <div className="mt-6">
        {activeTab === "company" && <CompanyProfileView />}
        {activeTab === "billing" && <BillingView />}
        {activeTab === "quotation" && <QuotationSettingsView />}
      </div>
    </div>
  );
};

export default SettingsPage;
