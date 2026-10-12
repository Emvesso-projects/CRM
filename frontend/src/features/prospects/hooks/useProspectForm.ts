import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useItems } from "@/features/items";
import { useAssignableUsers } from "@/features/leads";
import {
  prospectSchema,
  type ProspectFormValues,
} from "../validators/prospect.schema";
import { prospectToFormValues } from "../mappers";
import { useUpdateProspect } from "./useProspectMutations";
import type { Prospect } from "@/contracts/types";
import type { UpdateProspectInput } from "@/contracts/validation";

interface UseProspectFormOptions {
  mode?: "view" | "edit";
  prospect?: Prospect;
  onSuccess?: () => void;
}

const toUpdateProspectInput = (
  data: ProspectFormValues,
): UpdateProspectInput => ({
  firstName: data.firstName.trim(),
  lastName: data.lastName.trim(),
  email: data.email.trim(),
  mobile: data.mobile.trim(),
  companyName: data.companyName.trim(),
  expectedValue: data.expectedValue?.trim()
    ? Number(data.expectedValue)
    : null,
  notes: data.notes?.trim() || null,
  assignedToId: data.assignedToId?.trim() || null,
});

export const useProspectForm = ({
  prospect,
  onSuccess,
}: UseProspectFormOptions) => {
  const { mutateAsync: updateProspect, isPending: isUpdating } =
    useUpdateProspect();

  const { data: assignableUsersData = [] } = useAssignableUsers({
    enabled: true,
  });
  const { data: itemsData } = useItems({ limit: 100 }, { enabled: true });

  const items = itemsData?.data ?? [];
  const assignableUsers = assignableUsersData ?? [];

  const form = useForm<ProspectFormValues>({
    resolver: zodResolver(prospectSchema),
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: prospect ? prospectToFormValues(prospect) : undefined,
    values: prospect ? prospectToFormValues(prospect) : undefined,
  });

  useEffect(() => {
    if (prospect) {
      form.reset(prospectToFormValues(prospect));
    }
  }, [prospect, form]);

  const onSubmit = async (data: ProspectFormValues) => {
    if (!prospect) return;
    try {
      await updateProspect({
        id: prospect.id,
        data: toUpdateProspectInput(data),
      });
      onSuccess?.();
    } catch {
      // Handled in mutation hook
    }
  };

  return {
    form,
    items,
    assignableUsers,
    isSubmitting: isUpdating,
    onSubmit: form.handleSubmit(onSubmit),
  };
};

