import api from "@/lib/api/client";
import { createApiService } from "@/lib/api/service.utils";
import { normalizeOptionalFields } from "@/utils/normalization.utils";
import type { FollowUp } from "@/contracts/types";
import type {
  CancelFollowUpInput,
  EditFollowUpInput,
  RescheduleFollowUpInput,
  ScheduleFollowUpInput,
} from "@/contracts/validation";
import { PROSPECT_ENDPOINTS } from "./endpoints";

const service = createApiService(api);
const scheduleFields: Array<keyof ScheduleFollowUpInput> = ["time", "notes", "reminder", "assignedToId"];
const detailFields: Array<keyof EditFollowUpInput> = ["notes", "reminder", "assignedToId"];

/**
 * Follow-ups are completed by logging the activity that fulfilled them
 * (prospectsService.logActivity with completeFollowUpId), not from here.
 */
export const followUpApi = {
  scheduleFollowUp: (prospectId: string, data: ScheduleFollowUpInput) =>
    service.post<FollowUp>(
      PROSPECT_ENDPOINTS.FOLLOW_UPS(prospectId),
      normalizeOptionalFields(data, scheduleFields),
    ).then((response) => response.data),

  /** Moves the follow-up to a new date and time; type, notes, reminder and assignee carry over. */
  rescheduleFollowUp: (prospectId: string, followUpId: string, data: RescheduleFollowUpInput) =>
    service.patch<FollowUp>(PROSPECT_ENDPOINTS.RESCHEDULE_FOLLOW_UP(prospectId, followUpId), data)
      .then((response) => response.data),

  cancelFollowUp: (prospectId: string, followUpId: string, data: CancelFollowUpInput) =>
    service.patch<FollowUp>(PROSPECT_ENDPOINTS.CANCEL_FOLLOW_UP(prospectId, followUpId), data)
      .then((response) => response.data),

  /** Type, notes, reminder and assignee only; moving the date is a reschedule. */
  editFollowUp: (prospectId: string, followUpId: string, data: EditFollowUpInput) =>
    service.patch<FollowUp>(
      PROSPECT_ENDPOINTS.EDIT_FOLLOW_UP(prospectId, followUpId),
      normalizeOptionalFields(data, detailFields),
    ).then((response) => response.data),

  getFollowUpHistory: (prospectId: string) =>
    service.get<FollowUp[]>(PROSPECT_ENDPOINTS.FOLLOW_UPS(prospectId))
      .then((response) => response.data),

  getActiveFollowUp: (prospectId: string) =>
    service.get<FollowUp | null>(PROSPECT_ENDPOINTS.ACTIVE_FOLLOW_UP(prospectId))
      .then((response) => response.data),
};
