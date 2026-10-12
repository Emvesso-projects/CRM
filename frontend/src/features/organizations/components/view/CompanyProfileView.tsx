import { cn } from "@/utils/cn";
import { pagePanelClass } from "@/components/common/uiTokens";
import CompanyProfileForm from "../forms/CompanyProfileForm";

/**
 * Settings → Company.
 *
 * The permanent home for the organization fields an admin owns. Thin on
 * purpose: the behaviour lives in CompanyProfileForm, this only supplies the
 * page panel so it matches the Quotation tab's section treatment.
 */
const CompanyProfileView = () => (
  <div className="min-w-0 space-y-6">
    <section className={cn(pagePanelClass, "space-y-5")}>
      <CompanyProfileForm />
    </section>
  </div>
);

export default CompanyProfileView;
