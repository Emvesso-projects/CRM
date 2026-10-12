import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Pencil, Save } from "lucide-react";
import FormField from "@/components/common/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useAppDispatch, useAppSelector } from "@/hooks/useRedux";
import { fetchMe, selectCurrentUser } from "@/features/auth";
import { useUpdateOrganization } from "../../hooks/useOrganizationMutations";
import {
  CompanyProfileSchema,
  type CompanyProfileInput,
} from "@/contracts/validation";
import {
  ORGANIZATION_TYPE_OPTIONS,
  ORGANIZATION_TYPE_VALUES,
} from "@/contracts/constants";

const inputClassName =
  "h-9 rounded-md border-0 bg-[rgb(var(--input-editable))] px-4 text-sm text-foreground shadow-none placeholder:text-muted-foreground/60 hover:bg-muted/70 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/25 dark:bg-muted/50 dark:focus-visible:bg-background";
const readOnlyInputClassName = `${inputClassName} cursor-not-allowed text-foreground hover:bg-[rgb(var(--input-editable))] focus-visible:bg-[rgb(var(--input-editable))] focus-visible:ring-0`;

/** ISO timestamp -> the yyyy-MM-dd an <input type="date"> expects. */
const toDateInputValue = (value?: string | null) =>
  value ? value.slice(0, 10) : "";

/** A stored type that is no longer valid (or never set) shows as unselected. */
const toOrgTypeValue = (value?: string | null): CompanyProfileInput["orgType"] =>
  value && (ORGANIZATION_TYPE_VALUES as readonly string[]).includes(value)
    ? (value as CompanyProfileInput["orgType"])
    : "";

type OrganizationSnapshot = NonNullable<
  NonNullable<ReturnType<typeof selectCurrentUser>>["organization"]
>;

const toFormValues = (organization: OrganizationSnapshot): CompanyProfileInput => ({
  name: organization.name ?? "",
  orgType: toOrgTypeValue(organization.orgType),
  authorizedPerson: organization.authorizedPerson ?? "",
  email: organization.email ?? "",
  mobile: organization.mobile ?? "",
  gstin: organization.gstin ?? "",
  address: organization.address ?? "",
  dateOfRegistration: toDateInputValue(organization.dateOfRegistration),
});

/**
 * The organization details an admin owns — Settings → Company.
 *
 * Until this existed there was no tenant UI for gstin, address, mobile or
 * dateOfRegistration at all: the only form covering them sat behind the
 * super-admin route, so a self-service org could never complete its own
 * profile, and every quotation PDF printed without a letterhead address or
 * GSTIN line.
 *
 * Read-only with an Edit toggle, matching BankDetailsForm on the same page.
 */
const CompanyProfileForm = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectCurrentUser);
  const [isEditing, setIsEditing] = useState(false);
  const updateOrgMutation = useUpdateOrganization();

  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<CompanyProfileInput>({
    resolver: zodResolver(CompanyProfileSchema),
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: {
      name: "",
      orgType: "",
      authorizedPerson: "",
      email: "",
      mobile: "",
      gstin: "",
      address: "",
      dateOfRegistration: "",
    },
  });

  const organization = user?.organization;

  useEffect(() => {
    if (!organization || isEditing) return;
    reset(toFormValues(organization));
  }, [organization, isEditing, reset]);

  if (!organization) return null;

  const isBusy = isSubmitting || updateOrgMutation.isPending;

  const onSubmit = async (data: CompanyProfileInput) => {
    const targetOrgId = user?.organizationId;
    if (!targetOrgId) return;

    /*
     * Blank optional fields are OMITTED, not sent as "".
     *
     * The server's address rule is min(2) and mobile is /^[6-9]\d{9}$/, neither
     * of which allows an empty string — posting "" would fail validation on a
     * field the user simply left alone. gstin is the exception: its refine
     * explicitly permits "", which is how a non-GST business clears it.
     */
    const payload: Record<string, string> = { name: data.name.trim() };
    const optional: Array<[keyof CompanyProfileInput, string]> = [
      ["orgType", data.orgType],
      ["authorizedPerson", data.authorizedPerson.trim()],
      ["email", data.email.trim()],
      ["mobile", data.mobile.trim()],
      ["address", data.address.trim()],
      ["dateOfRegistration", data.dateOfRegistration.trim()],
    ];

    for (const [field, value] of optional) {
      if (value) payload[field] = value;
    }

    // Sent even when empty — "" is how GSTIN is deliberately cleared.
    payload.gstin = data.gstin.trim();

    try {
      await updateOrgMutation.mutateAsync({ id: targetOrgId, data: payload });
      // Refresh user.organization so this form and the quotation PDF read the
      // saved values rather than a stale session copy.
      await dispatch(fetchMe());
      setIsEditing(false);
    } catch {
      // Surfaced by the mutation hook's toast.
    }
  };

  const handleCancel = () => {
    reset(toFormValues(organization));
    setIsEditing(false);
  };

  const fieldClassName = isEditing ? inputClassName : readOnlyInputClassName;

  return (
    <form
      id="organization-company-profile-form"
      onSubmit={handleSubmit(onSubmit)}
      className="min-w-0 space-y-5"
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary dark:bg-primary/20">
            <Building2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-bold leading-tight text-foreground">
              Company Details
            </h3>
            <p className="mt-1 text-xs font-medium leading-snug text-muted-foreground">
              Your address and GSTIN appear on the letterhead of every quotation
              you send.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isEditing && (
            <span className="inline-flex h-7 items-center rounded-md border border-primary/20 bg-primary/10 px-2.5 text-xs font-semibold text-primary">
              Editing
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isBusy}
            onClick={() => (isEditing ? handleCancel() : setIsEditing(true))}
            className="h-8 rounded-md border-border bg-background px-3 text-xs font-semibold text-foreground shadow-none hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
            {isEditing ? "Cancel" : "Edit"}
          </Button>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 *:min-w-0">
        <FormField
          label="Company Name"
          error={errors.name?.message}
          required={isEditing}
        >
          <Input
            {...register("name")}
            placeholder="e.g. Acme Steel Works Pvt Ltd"
            readOnly={!isEditing}
            aria-readonly={!isEditing}
            className={fieldClassName}
          />
        </FormField>

        <FormField label="Organization Type" error={errors.orgType?.message}>
          <Controller
            name="orgType"
            control={control}
            render={({ field }) => (
              <Select
                options={ORGANIZATION_TYPE_OPTIONS}
                value={field.value || undefined}
                onValueChange={field.onChange}
                placeholder={isEditing ? "Select organization type" : "Not set"}
                disabled={!isEditing}
                triggerClassName={fieldClassName}
              />
            )}
          />
        </FormField>

        <FormField
          label="Authorized Person"
          error={errors.authorizedPerson?.message}
        >
          <Input
            {...register("authorizedPerson")}
            placeholder="e.g. Priya Sharma"
            readOnly={!isEditing}
            aria-readonly={!isEditing}
            className={fieldClassName}
          />
        </FormField>

        <FormField label="Company Email" error={errors.email?.message}>
          <Input
            {...register("email")}
            type="email"
            placeholder="e.g. accounts@acmesteel.in"
            readOnly={!isEditing}
            aria-readonly={!isEditing}
            className={fieldClassName}
          />
        </FormField>

        <FormField label="Company Phone" error={errors.mobile?.message}>
          <Input
            {...register("mobile")}
            inputMode="numeric"
            placeholder="e.g. 9876543210"
            readOnly={!isEditing}
            aria-readonly={!isEditing}
            className={fieldClassName}
          />
        </FormField>

        <FormField
          label="GSTIN"
          error={errors.gstin?.message}
          description="Leave blank if your business is not GST registered."
        >
          <Input
            {...register("gstin")}
            placeholder="e.g. 27AAAAA0000A1Z5"
            readOnly={!isEditing}
            aria-readonly={!isEditing}
            className={fieldClassName}
          />
        </FormField>

        <FormField
          label="Date of Registration"
          error={errors.dateOfRegistration?.message}
        >
          <Input
            {...register("dateOfRegistration")}
            type="date"
            readOnly={!isEditing}
            aria-readonly={!isEditing}
            className={fieldClassName}
          />
        </FormField>

        <div className="sm:col-span-2">
          <FormField label="Registered Address" error={errors.address?.message}>
            <textarea
              {...register("address")}
              rows={3}
              readOnly={!isEditing}
              aria-readonly={!isEditing}
              placeholder="Street, area, city, state and PIN code"
              className={`w-full resize-none rounded-md border-0 bg-[rgb(var(--input-editable))] px-4 py-2 text-sm text-foreground shadow-none placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 dark:bg-muted/50 ${
                isEditing ? "" : "cursor-not-allowed focus-visible:ring-0"
              }`}
            />
          </FormField>
        </div>
      </div>

      {isEditing && (
        <div className="flex justify-stretch border-t border-border pt-5 sm:justify-end">
          <Button
            type="submit"
            disabled={isBusy}
            className="h-9 w-full rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-none hover:bg-primary-hover sm:w-auto"
          >
            <Save className="h-3.5 w-3.5" />
            {isBusy ? "Saving..." : "Save Company Details"}
          </Button>
        </div>
      )}
    </form>
  );
};

export default CompanyProfileForm;
