import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useAppSelector } from "@/hooks/useRedux";
import { leadsService } from "../api/services";

export const useLeadActivities = (id?: string | null) => {
  const selectedOrgId = useAppSelector(
    (state) => state.auth.selectedOrganizationId,
  );
  const user = useAppSelector((state) => state.auth.user);
  const isEnabled = user
    ? user.role === "SUPER_ADMIN"
      ? !!selectedOrgId
      : true
    : false;

  return useQuery({
    queryKey: id
      ? queryKeys.leads.activities(id, selectedOrgId)
      : queryKeys.leads.all,
    queryFn: async () => {
      if (!id) return [];
      return leadsService.getLeadActivities(id);
    },
    enabled: !!id && isEnabled,
  });
};
