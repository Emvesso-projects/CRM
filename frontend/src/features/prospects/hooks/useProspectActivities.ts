import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useAppSelector } from "@/hooks/useRedux";
import { extractApiError } from "@/utils/apiError";
import { toast } from "@/utils/toast";
import type {
  LogProspectActivityInput,
  TimelineCategoryFilter,
  UpdateProspectActivityInput,
} from "@/contracts/validation";
import { prospectsService } from "../api/prospectsService";
import { useInvalidateProspectActivity } from "./useFollowUp";

const TIMELINE_PAGE_SIZE = 20;

/** The prospect's timeline, a page at a time, newest first. */
export const useProspectTimeline = (prospectId: string, category: TimelineCategoryFilter) => {
  const selectedOrgId = useAppSelector((state) => state.auth.selectedOrganizationId);
  const user = useAppSelector((state) => state.auth.user);
  const enabled = !!prospectId && !!user && (user.role !== "SUPER_ADMIN" || !!selectedOrgId);

  return useInfiniteQuery({
    queryKey: queryKeys.prospects.timeline(prospectId, category, selectedOrgId),
    queryFn: ({ pageParam }) =>
      prospectsService.getTimeline(prospectId, {
        cursor: pageParam,
        limit: TIMELINE_PAGE_SIZE,
        category,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
  });
};

const useActivityMutation = <T extends { prospectId: string }, R>(
  mutationFn: (variables: T) => Promise<R>,
  successMessage?: string,
) => {
  const invalidate = useInvalidateProspectActivity();
  return useMutation({
    mutationFn,
    onSuccess: (_result, variables) => {
      if (successMessage) toast.success(successMessage);
      invalidate(variables.prospectId);
    },
    onError: (error, variables) => {
      const apiError = extractApiError(error);
      toast.error(apiError.message);
      // The follow-up or activity changed underneath: show the current state.
      if (apiError.status === 409) invalidate(variables.prospectId);
    },
  });
};

/**
 * Logs what happened, optionally completing the pending follow-up and
 * scheduling the next one, in one save. The caller shows the summary.
 */
export const useLogProspectActivity = () =>
  useActivityMutation(({ prospectId, data }: { prospectId: string; data: LogProspectActivityInput }) =>
    prospectsService.logActivity(prospectId, data),
  );

export const useUpdateProspectActivity = () =>
  useActivityMutation(
    ({ prospectId, activityId, data }: { prospectId: string; activityId: string; data: UpdateProspectActivityInput }) =>
      prospectsService.updateActivity(prospectId, activityId, data),
    "Activity updated",
  );

export const useDeleteProspectActivity = () =>
  useActivityMutation(
    ({ prospectId, activityId }: { prospectId: string; activityId: string }) =>
      prospectsService.deleteActivity(prospectId, activityId),
    "Activity deleted",
  );
