import {
  Controller,
  type ControllerRenderProps,
  type UseFormReturn,
} from "react-hook-form";
import { useRef } from "react";
import FormField from "@/components/common/FormField";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  isLeadIndustryValue,
  isLeadSourceValue,
  leadIndustryOptions,
  leadSourceOptions,
  leadTypeOptions,
} from "@/features/leads";
import { cn } from "@/utils/cn";
import type { Prospect } from "../../types";
import type { ProspectFormValues } from "../../validators/prospect.schema";
import type { ItemPreview, UserPreview } from "@/features/leads";

export const ProspectFormSections = ({
  form,
  items = [],
  assignableUsers = [],
  prospect,
  mode,
}: {
  form: UseFormReturn<ProspectFormValues>;
  items?: ItemPreview[];
  assignableUsers?: UserPreview[];
  prospect: Prospect;
  mode: "view" | "edit";
}) => {
  const formSectionRef = useRef<HTMLDivElement>(null);
  const {
    register,
    formState: { errors },
  } = form;

  const isView = mode === "view";
  const isDisabled = isView || !prospect.isEditable;
  const watchedIndustry = form.watch("industry");
  const isOtherIndustry = watchedIndustry === "OTHER";

  const itemOptions = [
    { value: "", label: "Select product or service" },
    ...items.map((item) => ({
      value: item.id,
      label: `${item.name} (${item.itemCode})`,
    })),
  ];

  const assignableUserOptions = [
    { value: "", label: "Select assignee" },
    ...assignableUsers.map((u) => ({
      value: u.id,
      label: `${u.firstName} ${u.lastName} (${u.email})`,
    })),
  ];

  const fieldClasses = "transition-all";
  const handleSelectBlur = (
    open: boolean,
    field: ControllerRenderProps<ProspectFormValues>,
  ) => {
    if (!open) {
      field.onBlur();
    }
  };

  return (
    <div
      ref={formSectionRef}
      className="grid grid-cols-1 gap-x-6 gap-y-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-x-8"
    >
      <FormField label="Prospect ID" required>
        <Input
          value={prospect.prospectNo || "Auto-generated"}
          disabled
          placeholder="Auto-generated prospect ID"
          className="h-10 cursor-not-allowed border-border/50 bg-muted/40 font-bold"
        />
      </FormField>

      <FormField label="Lead Title" error={errors.leadType?.message}>
        <Controller
          name="leadType"
          control={form.control}
          render={({ field }) => (
            <Select
              value={field.value || "NEW"}
              onValueChange={field.onChange}
              onOpenChange={(open) => handleSelectBlur(open, field)}
              options={leadTypeOptions}
              placeholder="Select lead title"
              disabled={isDisabled}
              className={fieldClasses}
            />
          )}
        />
      </FormField>

      <FormField label="Lead Date" error={errors.leadDate?.message}>
        <Input
          type="date"
          {...register("leadDate")}
          readOnly={isDisabled}
          disabled={isDisabled}
          className={fieldClasses}
        />
      </FormField>

      <FormField label="First Name" required error={errors.firstName?.message}>
        <Input
          placeholder="Enter first name"
          {...register("firstName", { required: "First name is required" })}
          readOnly={isDisabled}
          className={fieldClasses}
        />
      </FormField>

      <FormField label="Last Name" required error={errors.lastName?.message}>
        <Input
          placeholder="Enter last name"
          {...register("lastName", { required: "Last name is required" })}
          readOnly={isDisabled}
          className={fieldClasses}
        />
      </FormField>

      <FormField label="Mobile No" required error={errors.mobile?.message}>
        <Input
          placeholder="Enter 10-digit mobile number"
          {...register("mobile", { required: "Mobile number is required" })}
          readOnly={isDisabled}
          className={fieldClasses}
        />
      </FormField>

      <FormField label="Alternate Mobile No">
        <Input
          placeholder="Enter alternate mobile number"
          {...register("alternateMobile")}
          readOnly={isDisabled}
          className={fieldClasses}
        />
      </FormField>

      <div className="min-w-0 md:col-span-2 lg:col-span-2">
        <FormField label="Address" error={errors.address?.message}>
          <Input
            placeholder="Enter full address"
            {...register("address")}
            readOnly={isDisabled}
            className={fieldClasses}
          />
        </FormField>
      </div>

      <FormField label="City" error={errors.city?.message}>
        <Input
          placeholder="Enter city"
          {...register("city")}
          readOnly={isDisabled}
          className={fieldClasses}
        />
      </FormField>

      <FormField label="State" error={errors.state?.message}>
        <Input
          placeholder="Enter state"
          {...register("state")}
          readOnly={isDisabled}
          className={fieldClasses}
        />
      </FormField>

      <FormField label="Pin Code" error={errors.pinCode?.message}>
        <Input
          placeholder="Enter pin code"
          {...register("pinCode")}
          readOnly={isDisabled}
          className={fieldClasses}
        />
      </FormField>

      <FormField label="Email Address" required error={errors.email?.message}>
        <Input
          type="email"
          placeholder="Enter email address"
          {...register("email", { required: "Email is required" })}
          readOnly={isDisabled}
          className={fieldClasses}
        />
      </FormField>

      <FormField
        label="Company Name"
        required
        error={errors.companyName?.message}
      >
        <Input
          placeholder="Enter company name"
          {...register("companyName", { required: "Company name is required" })}
          readOnly={isDisabled}
          className={fieldClasses}
        />
      </FormField>

      <FormField label="GSTIN" error={errors.gstin?.message}>
        <Input
          placeholder="Enter GSTIN (optional)"
          {...register("gstin")}
          readOnly={isDisabled}
          className={fieldClasses}
        />
      </FormField>

      <FormField label="Lead Source" error={errors.leadSource?.message}>
        <Controller
          name="leadSource"
          control={form.control}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(value) => {
                if (isLeadSourceValue(value)) {
                  field.onChange(value);
                }
              }}
              onOpenChange={(open) => handleSelectBlur(open, field)}
              options={leadSourceOptions}
              placeholder="Select lead source"
              disabled={isDisabled}
              className={fieldClasses}
            />
          )}
        />
      </FormField>

      <FormField label="Industry" error={errors.industry?.message}>
        <Controller
          name="industry"
          control={form.control}
          render={({ field }) => (
            <Select
              value={field.value ?? ""}
              onValueChange={(value) => {
                field.onChange(
                  value === ""
                    ? undefined
                    : isLeadIndustryValue(value)
                      ? value
                      : undefined,
                );
                if (value !== "OTHER") {
                  form.setValue("customIndustry", "");
                }
              }}
              onOpenChange={(open) => handleSelectBlur(open, field)}
              options={leadIndustryOptions}
              placeholder="Select industry"
              disabled={isDisabled}
              className={fieldClasses}
            />
          )}
        />
        {isOtherIndustry && (
          <div
            style={{
              overflow: "hidden",
              maxHeight: isOtherIndustry ? "60px" : "0px",
              opacity: isOtherIndustry ? 1 : 0,
              transition: "max-height 0.25s ease, opacity 0.2s ease",
              marginTop: "8px",
            }}
          >
            <Input
              placeholder="Specify industry"
              {...register("customIndustry")}
              readOnly={isDisabled}
              className={fieldClasses}
              autoFocus={!isDisabled}
            />
            {errors.customIndustry?.message && (
              <p className="mt-1 text-xs text-destructive">
                {errors.customIndustry.message}
              </p>
            )}
          </div>
        )}
      </FormField>

      <FormField
        label="Product / Service Interested"
        error={errors.productInterested?.message}
      >
        <Controller
          name="productInterested"
          control={form.control}
          render={({ field }) => (
            <Select
              value={field.value ?? ""}
              onValueChange={(value) => {
                field.onChange(value);
              }}
              onOpenChange={(open) => handleSelectBlur(open, field)}
              options={itemOptions}
              placeholder="Select product or service"
              disabled={isDisabled}
              className={fieldClasses}
            />
          )}
        />
      </FormField>

      <FormField label="Assign" error={errors.assignedToId?.message}>
        <Controller
          name="assignedToId"
          control={form.control}
          render={({ field }) => (
            <Select
              value={field.value ?? ""}
              onValueChange={field.onChange}
              onOpenChange={(open) => handleSelectBlur(open, field)}
              options={assignableUserOptions}
              placeholder="Select assignee"
              disabled={isDisabled}
              className={fieldClasses}
            />
          )}
        />
      </FormField>

      <FormField
        label="Expected Value (INR)"
        error={errors.expectedValue?.message}
      >
        <Input
          type="number"
          min="0"
          placeholder="Enter expected value in INR"
          {...register("expectedValue")}
          readOnly={isDisabled}
          className={fieldClasses}
        />
      </FormField>

      <div className="min-w-0 md:col-span-2 lg:col-span-3">
        <FormField
          label="Requirement Description"
          error={errors.notes?.message}
        >
          <textarea
            {...register("notes")}
            placeholder="Add enquiry details or requirement description"
            rows={4}
            readOnly={isDisabled}
            className={cn(
              "w-full resize-none rounded-2xl border border-input bg-card/10 px-4 py-3 text-sm shadow-sm outline-none transition-all md:text-sm",
              "hover:border-primary/50 hover:bg-card/20",
              "focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/20 focus-visible:bg-card",
              isDisabled &&
                "cursor-default border-transparent bg-muted/5 shadow-none focus-visible:ring-0",
            )}
          />
        </FormField>
      </div>
    </div>
  );
};
