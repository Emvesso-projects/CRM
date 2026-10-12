import api from "@/lib/api/client";
import { createApiService } from "@/lib/api/service.utils";
import { normalizeOptionalFields } from "@/utils/normalization.utils";
import type {
  LogProspectActivityResult,
  Prospect,
  ProspectTimelineItem,
  ProspectTimelinePage,
} from "@/contracts/types";
import type {
  LogProspectActivityInput,
  TimelineCategoryFilter,
  UpdateProspectActivityInput,
  UpdateProspectInput,
  UpdateProspectStageInput,
} from "@/contracts/validation";
import type { ProspectFilterValues } from "../types";
import { PROSPECT_ENDPOINTS } from "./endpoints";

const service = createApiService(api);

const OPTIONAL_UPDATE_FIELDS: (keyof UpdateProspectInput)[] = [
  "expectedValue",
  "notes",
  "assignedToId",
];

export const prospectsService = {
  getProspects: (params?: ProspectFilterValues) =>
    service.get<Prospect[]>(PROSPECT_ENDPOINTS.LIST, { params }),

  getProspectDetails: (id: string) =>
    service.get<Prospect>(PROSPECT_ENDPOINTS.GET(id)).then(res => res.data),

  updateProspect: (id: string, data: UpdateProspectInput) =>
    service
      .patch<Prospect>(
        PROSPECT_ENDPOINTS.UPDATE(id),
        normalizeOptionalFields(data, OPTIONAL_UPDATE_FIELDS),
      )
      .then(res => res.data),

  updateStage: (id: string, data: UpdateProspectStageInput) =>
    service
      .patch<Prospect>(PROSPECT_ENDPOINTS.UPDATE_STAGE(id), data)
      .then(res => res.data),

  /** One page of the timeline, newest first by when things happened. */
  getTimeline: (
    id: string,
    params: { cursor?: string; limit?: number; category?: TimelineCategoryFilter },
  ) =>
    service
      .get<ProspectTimelinePage>(PROSPECT_ENDPOINTS.ACTIVITIES(id), { params })
      .then(res => res.data),

  /** Logs an activity, optionally completing the pending follow-up and scheduling the next, in one save. */
  logActivity: (id: string, data: LogProspectActivityInput) =>
    service
      .post<LogProspectActivityResult>(PROSPECT_ENDPOINTS.ACTIVITIES(id), data)
      .then(res => res.data),

  updateActivity: (id: string, activityId: string, data: UpdateProspectActivityInput) =>
    service
      .patch<ProspectTimelineItem>(PROSPECT_ENDPOINTS.ACTIVITY(id, activityId), data)
      .then(res => res.data),

  deleteActivity: (id: string, activityId: string) =>
    service
      .delete<null>(PROSPECT_ENDPOINTS.ACTIVITY(id, activityId))
      .then(res => res.data),

  deleteProspect: (id: string) =>
    service.delete<void>(PROSPECT_ENDPOINTS.DELETE(id)).then(res => res.data),
};
