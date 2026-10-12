import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useAppSelector } from "@/hooks/useRedux";
import { prospectsService } from "../api/prospectsService";
import { toast } from "@/utils/toast";
import { extractApiError } from "@/utils/apiError";
import type {
  UpdateProspectInput,
  UpdateProspectStageInput,
} from "@/contracts/validation";

const invalidateProspectQueries = (
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
  selectedOrgId: string | null | undefined,
) => {
  queryClient.invalidateQueries({ queryKey: queryKeys.prospects.listScope });
  queryClient.invalidateQueries({
    queryKey: queryKeys.prospects.detail(id, selectedOrgId),
  });
  // A stage change can cancel the pending follow-up and adds timeline entries.
  queryClient.invalidateQueries({
    queryKey: queryKeys.prospects.timelineScope(id),
  });
  queryClient.invalidateQueries({ queryKey: ["dashboard"] });
};

export const useUpdateProspect = () => {
  const queryClient = useQueryClient();
  const selectedOrgId = useAppSelector(
    (state) => state.auth.selectedOrganizationId,
  );

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProspectInput }) =>
      prospectsService.updateProspect(id, data),
    onSuccess: (_, variables) => {
      toast.success("Prospect updated successfully");
      invalidateProspectQueries(queryClient, variables.id, selectedOrgId);
    },
    onError: (error) => {
      const apiError = extractApiError(error);
      toast.error(apiError.message);
    },
  });
};

export const useUpdateProspectStage = () => {
  const queryClient = useQueryClient();
  const selectedOrgId = useAppSelector(
    (state) => state.auth.selectedOrganizationId,
  );

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProspectStageInput }) =>
      prospectsService.updateStage(id, data),
    onSuccess: (_, variables) => {
      toast.success("Prospect stage updated successfully");
      invalidateProspectQueries(queryClient, variables.id, selectedOrgId);
    },
    onError: (error) => {
      const apiError = extractApiError(error);
      toast.error(apiError.message);
    },
  });
};

export const useDeleteProspect = () => {
  const queryClient = useQueryClient();
  const selectedOrgId = useAppSelector(
    (state) => state.auth.selectedOrganizationId,
  );

  return useMutation({
    mutationFn: (id: string) => prospectsService.deleteProspect(id),
    onSuccess: (_, id) => {
      toast.success("Prospect deleted successfully");
      queryClient.invalidateQueries({ queryKey: queryKeys.prospects.listScope });
      // Also invalidate the specific detail query
      queryClient.invalidateQueries({
        queryKey: queryKeys.prospects.detail(id, selectedOrgId),
      });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      const apiError = extractApiError(error);
      toast.error(apiError.message);
    },
  });
};
