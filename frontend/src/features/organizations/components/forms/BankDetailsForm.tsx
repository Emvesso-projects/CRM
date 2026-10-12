import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Landmark, Pencil, Save } from "lucide-react";
import FormField from "@/components/common/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/hooks/useRedux";
import { fetchMe, selectCurrentUser } from "@/features/auth";
import { useUpdateOrganization } from "../../hooks/useOrganizationMutations";
import {
  BankDetailsSchema,
  type BankDetailsInput,
} from "@/contracts/validation";

const inputClassName =
  "h-9 rounded-md border-0 bg-[rgb(var(--input-editable))] px-4 text-sm text-foreground shadow-none placeholder:text-muted-foreground/60 hover:bg-muted/70 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/25 dark:bg-muted/50 dark:focus-visible:bg-background";
const readOnlyInputClassName = `${inputClassName} cursor-not-allowed text-foreground hover:bg-[rgb(var(--input-editable))] focus-visible:bg-[rgb(var(--input-editable))] focus-visible:ring-0`;

const BankDetailsForm = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectCurrentUser);
  const [isEditing, setIsEditing] = useState(false);
  const updateOrgMutation = useUpdateOrganization();

  const form = useForm<BankDetailsInput>({
    resolver: zodResolver(BankDetailsSchema),
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: {
      bankName: "",
      accountHolderName: "",
      accountNumber: "",
      ifscCode: "",
      branchName: "",
      accountType: "",
    },
  });

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = form;

  useEffect(() => {
    if (!user?.organization || isEditing) return;

    reset({
      bankName: user.organization.bankName ?? "",
      accountHolderName: user.organization.accountHolderName ?? "",
      accountNumber: user.organization.accountNumber ?? "",
      ifscCode: user.organization.ifscCode ?? "",
      branchName: user.organization.branchName ?? "",
      accountType: user.organization.accountType ?? "",
    });
  }, [user?.organization, isEditing, reset]);

  if (!user?.organization) {
    return null;
  }

  const onSubmit = async (data: BankDetailsInput) => {
    // If org ID is not directly in auth user, we use user's organizationId
    const targetOrgId = user.organizationId;
    if (!targetOrgId) return;

    try {
      await updateOrgMutation.mutateAsync({
        id: targetOrgId,
        data: {
          bankName: data.bankName?.trim() || null,
          accountHolderName: data.accountHolderName?.trim() || null,
          accountNumber: data.accountNumber?.trim() || null,
          ifscCode: data.ifscCode?.trim()?.toUpperCase() || null,
          branchName: data.branchName?.trim() || null,
          accountType: data.accountType?.trim() || null,
        },
      });

      await dispatch(fetchMe());
      setIsEditing(false);
    } catch {
      // Error handled by mutation hook toast
    }
  };

  const handleCancel = () => {
    reset({
      bankName: user.organization?.bankName ?? "",
      accountHolderName: user.organization?.accountHolderName ?? "",
      accountNumber: user.organization?.accountNumber ?? "",
      ifscCode: user.organization?.ifscCode ?? "",
      branchName: user.organization?.branchName ?? "",
      accountType: user.organization?.accountType ?? "",
    });
    setIsEditing(false);
  };

  return (
    <form
      id="organization-bank-details-form"
      onSubmit={handleSubmit(onSubmit)}
      className="min-w-0 space-y-5"
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary dark:bg-primary/20 dark:text-primary">
            <Landmark className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-bold leading-tight text-foreground">
              Bank Account Details
            </h3>
            <p className="mt-1 text-xs font-medium leading-snug text-muted-foreground">
              Configure your bank details to dynamically display them in your quotation PDFs.
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
            disabled={isSubmitting || updateOrgMutation.isPending}
            onClick={() => (isEditing ? handleCancel() : setIsEditing(true))}
            className="h-8 rounded-md border-border bg-background px-3 text-xs font-semibold text-foreground shadow-none hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
            {isEditing ? "Cancel" : "Edit"}
          </Button>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-3 *:min-w-0">
        <FormField
          label="Bank Name"
          error={errors.bankName?.message}
          required={isEditing}
        >
          <Input
            {...register("bankName")}
            placeholder="e.g. HDFC Bank, State Bank of India"
            readOnly={!isEditing}
            aria-readonly={!isEditing}
            className={isEditing ? inputClassName : readOnlyInputClassName}
          />
        </FormField>

        <FormField
          label="Account Holder Name"
          error={errors.accountHolderName?.message}
          required={isEditing}
        >
          <Input
            {...register("accountHolderName")}
            placeholder="e.g. Acme Corporation Pvt Ltd"
            readOnly={!isEditing}
            aria-readonly={!isEditing}
            className={isEditing ? inputClassName : readOnlyInputClassName}
          />
        </FormField>

        <FormField
          label="Account Number"
          error={errors.accountNumber?.message}
          required={isEditing}
        >
          <Input
            {...register("accountNumber")}
            placeholder="e.g. 50200012345678"
            readOnly={!isEditing}
            aria-readonly={!isEditing}
            className={isEditing ? inputClassName : readOnlyInputClassName}
          />
        </FormField>

        <FormField
          label="IFSC Code"
          error={errors.ifscCode?.message}
          required={isEditing}
        >
          <Input
            {...register("ifscCode")}
            placeholder="e.g. HDFC0001234"
            readOnly={!isEditing}
            aria-readonly={!isEditing}
            className={isEditing ? inputClassName : readOnlyInputClassName}
          />
        </FormField>

        <FormField
          label="Branch Name"
          error={errors.branchName?.message}
        >
          <Input
            {...register("branchName")}
            placeholder="e.g. Andheri East, Mumbai"
            readOnly={!isEditing}
            aria-readonly={!isEditing}
            className={isEditing ? inputClassName : readOnlyInputClassName}
          />
        </FormField>

        <FormField
          label="Account Type"
          error={errors.accountType?.message}
        >
          <Input
            {...register("accountType")}
            placeholder="e.g. Current, Savings"
            readOnly={!isEditing}
            aria-readonly={!isEditing}
            className={isEditing ? inputClassName : readOnlyInputClassName}
          />
        </FormField>
      </div>

      {isEditing && (
        <div className="flex justify-stretch border-t border-border pt-5 sm:justify-end">
          <Button
            type="submit"
            disabled={isSubmitting || updateOrgMutation.isPending}
            className="h-9 w-full rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-none hover:bg-primary-hover sm:w-auto"
          >
            <Save className="h-3.5 w-3.5" />
            {isSubmitting || updateOrgMutation.isPending ? "Saving..." : "Save Bank Details"}
          </Button>
        </div>
      )}
    </form>
  );
};

export default BankDetailsForm;
