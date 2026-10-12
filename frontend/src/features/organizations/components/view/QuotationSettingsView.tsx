import {
  useState,
  type ChangeEvent,
} from "react";
import {
  ChevronUp,
  FileUp,
  ImageIcon,
  QrCode,
  Signature,
  type LucideIcon,
} from "lucide-react";
import PdfAssetUploader from "@/components/common/PdfAssetUploader";
import { pagePanelClass } from "@/components/common/uiTokens";
import { useAppDispatch, useAppSelector } from "@/hooks/useRedux";
import { fetchMe, selectCurrentUser } from "@/features/auth";
import { organizationsService } from "../../api/services";
import { extractApiError } from "@/utils/apiError";
import { resolveAssetUrl } from "@/utils/assetUrl";
import { toast } from "@/utils/toast";
import { cn } from "@/utils/cn";
import BankDetailsForm from "../forms/BankDetailsForm";

type OrganizationAssetField = "companyLogo" | "qrCode" | "signature";

const assetConfig: {
  field: OrganizationAssetField;
  label: string;
  icon: LucideIcon;
  previewClassName: string;
}[] = [
  {
    field: "companyLogo",
    label: "Company Logo",
    icon: ImageIcon,
    previewClassName: "h-8 w-12 object-contain",
  },
  {
    field: "qrCode",
    label: "QR Code",
    icon: QrCode,
    previewClassName: "h-9 w-9 object-contain",
  },
  {
    field: "signature",
    label: "Signature",
    icon: Signature,
    previewClassName: "h-8 w-12 object-contain",
  },
];

const SectionHeader = ({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) => (
  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div className="flex min-w-0 items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary dark:bg-primary/20 dark:text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <h3 className="text-base font-bold leading-tight text-foreground">
          {title}
        </h3>
        <p className="mt-1 text-xs font-medium leading-snug text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
    {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
  </div>
);

export const QuotationSettingsView = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectCurrentUser);
  const [assetPreviews, setAssetPreviews] = useState<
    Partial<Record<OrganizationAssetField, string>>
  >({});
  const [uploadingAssetField, setUploadingAssetField] =
    useState<OrganizationAssetField | null>(null);
  const [isAssetsOpen, setIsAssetsOpen] = useState(true);

  if (!user || !user.organization) {
    return null;
  }

  const orgId = user.organizationId;

  const handleAssetChange =
    (field: OrganizationAssetField) =>
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) {
        toast.error("Only jpg, jpeg, png, or webp images are allowed.");
        event.target.value = "";
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error("Uploaded image must be 5MB or smaller.");
        event.target.value = "";
        return;
      }

      if (!orgId) {
        toast.error("Organization ID not found.");
        event.target.value = "";
        return;
      }

      setAssetPreviews((prev) => {
        if (prev[field]) URL.revokeObjectURL(prev[field]!);
        return { ...prev, [field]: URL.createObjectURL(file) };
      });
      event.target.value = "";

      const formData = new FormData();
      formData.append(field, file);

      try {
        setUploadingAssetField(field);
        await organizationsService.updateOrganization(orgId, formData);
        await dispatch(fetchMe());
        toast.success(
          `${field === "companyLogo" ? "Company logo" : field === "qrCode" ? "QR code" : "Signature"} updated successfully.`,
        );
      } catch (error) {
        toast.error(extractApiError(error).message ?? "Failed to upload asset.");
      } finally {
        setUploadingAssetField(null);
      }
    };

  return (
    <div className="min-w-0 space-y-6">
      {/* PDF Assets Section */}
      <section className={cn(pagePanelClass, "space-y-5")}>
        <SectionHeader
          icon={FileUp}
          title="Quotation PDF Assets"
          description="Upload or update the brand assets (Logo, Payment QR Code, Signature) that will appear in your quotation PDFs."
          action={
            <button
              type="button"
              onClick={() => setIsAssetsOpen((open) => !open)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-expanded={isAssetsOpen}
              aria-label={
                isAssetsOpen ? "Collapse PDF assets" : "Expand PDF assets"
              }
            >
              <ChevronUp
                className={`h-4 w-4 transition-transform ${
                  isAssetsOpen ? "" : "rotate-180"
                }`}
              />
            </button>
          }
        />
        {isAssetsOpen && (
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 *:min-w-0">
            {assetConfig.map((asset) => {
              const currentValue = user.organization?.[asset.field] ?? null;
              const previewUrl =
                assetPreviews[asset.field] ?? resolveAssetUrl(currentValue);
              const inputId = `settings-quotation-${asset.field}`;

              return (
                <PdfAssetUploader
                  key={asset.field}
                  id={inputId}
                  label={asset.label}
                  icon={asset.icon}
                  previewUrl={previewUrl}
                  previewClassName={asset.previewClassName}
                  onChange={handleAssetChange(asset.field)}
                  disabled={uploadingAssetField !== null}
                  isUploading={uploadingAssetField === asset.field}
                  compact
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Bank Details Section */}
      <section className={cn(pagePanelClass, "space-y-5")}>
        <BankDetailsForm />
      </section>
    </div>
  );
};

export default QuotationSettingsView;
