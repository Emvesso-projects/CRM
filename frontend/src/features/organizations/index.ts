// Organizations Feature Barrel Exports

// Services
export { organizationsService } from "./api/services";

// Hooks
export {
  useOrganizations,
  useOrganizationBySlug,
  useOrganizationDetail,
} from "./hooks/useOrganizations";

// Types
export * from "./types";

// Components
export { default as OrganizationsView } from "./components/view/OrganizationsView";
export { default as OrganizationDetail } from "./components/details/OrganizationDetail";
export { default as SuperAdminOrganizationWorkspace } from "./components/details/SuperAdminOrganizationWorkspace";
export { default as QuotationSettingsView } from "./components/view/QuotationSettingsView";
export { default as CompanyProfileView } from "./components/view/CompanyProfileView";
export { default as BankDetailsForm } from "./components/forms/BankDetailsForm";
export { default as CompanyProfileForm } from "./components/forms/CompanyProfileForm";

