import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useAppSelector } from "@/hooks/useRedux";
import { extractApiError } from "@/utils/apiError";
import { formatBusinessDateTime } from "@/utils/businessTime";
import { toast } from "@/utils/toast";
import type { FollowUp } from "@/contracts/types";
import type {
  CancelFollowUpInput,
  EditFollowUpInput,
  RescheduleFollowUpInput,
  ScheduleFollowUpInput,
} from "@/contracts/validation";
import { followUpApi } from "../api/followUp.api";

const useScope = () => {
  const selectedOrgId = useAppSelector((state) => state.auth.selectedOrganizationId);
  const user = useAppSelector((state) => state.auth.user);
  const enabled = !!user && (user.role !== "SUPER_ADMIN" || !!selectedOrgId);
  return { selectedOrgId, enabled };
};

/** Refreshes everything that shows a prospect's follow-ups or activity. */
export const useInvalidateProspectActivity = () => {
  const queryClient = useQueryClient();
  const { selectedOrgId } = useScope();
  return (prospectId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.prospects.listScope });
    queryClient.invalidateQueries({ queryKey: queryKeys.prospects.detail(prospectId, selectedOrgId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.prospects.timelineScope(prospectId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.prospects.followUpHistory(prospectId, selectedOrgId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.prospects.activeFollowUp(prospectId, selectedOrgId) });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };
};

export const useActiveFollowUp = (prospectId?: string) => {
  const { selectedOrgId, enabled } = useScope();
  return useQuery({
    queryKey: queryKeys.prospects.activeFollowUp(prospectId ?? "", selectedOrgId),
    queryFn: () => followUpApi.getActiveFollowUp(prospectId!),
    enabled: !!prospectId && enabled,
  });
};

export const useFollowUpHistory = (prospectId?: string) => {
  const { selectedOrgId, enabled } = useScope();
  return useQuery({
    queryKey: queryKeys.prospects.followUpHistory(prospectId ?? "", selectedOrgId),
    queryFn: () => followUpApi.getFollowUpHistory(prospectId!),
    enabled: !!prospectId && enabled,
  });
};

const useFollowUpMutation = <T extends { prospectId: string }>(
  mutationFn: (variables: T) => Promise<FollowUp>,
  successMessage: (followUp: FollowUp) => string,
) => {
  const invalidate = useInvalidateProspectActivity();
  return useMutation({
    mutationFn,
    onSuccess: (followUp, variables) => {
      toast.success(successMessage(followUp));
      invalidate(variables.prospectId);
    },
    onError: (error, variables) => {
      const apiError = extractApiError(error);
      toast.error(apiError.message);
      // Someone else changed the follow-up first: show its current state.
      if (apiError.status === 409) invalidate(variables.prospectId);
    },
  });
};

export const useScheduleFollowUp = () =>
  useFollowUpMutation(
    ({ prospectId, data }: { prospectId: string; data: ScheduleFollowUpInput }) =>
      followUpApi.scheduleFollowUp(prospectId, data),
    (followUp) => `Follow-up scheduled for ${formatBusinessDateTime(followUp.dueAt)}`,
  );

export const useRescheduleFollowUp = () =>
  useFollowUpMutation(
    ({ prospectId, followUpId, data }: { prospectId: string; followUpId: string; data: RescheduleFollowUpInput }) =>
      followUpApi.rescheduleFollowUp(prospectId, followUpId, data),
    (followUp) => `Follow-up moved to ${formatBusinessDateTime(followUp.dueAt)}`,
  );

export const useCancelFollowUp = () =>
  useFollowUpMutation(
    ({ prospectId, followUpId, data }: { prospectId: string; followUpId: string; data: CancelFollowUpInput }) =>
      followUpApi.cancelFollowUp(prospectId, followUpId, data),
    () => "Follow-up cancelled",
  );

export const useEditFollowUp = () =>
  useFollowUpMutation(
    ({ prospectId, followUpId, data }: { prospectId: string; followUpId: string; data: EditFollowUpInput }) =>
      followUpApi.editFollowUp(prospectId, followUpId, data),
    () => "Follow-up details updated",
  );
