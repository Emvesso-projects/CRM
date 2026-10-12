export const PROSPECT_ENDPOINTS = {
  LIST: "/prospects",
  GET: (id: string) => `/prospects/${id}`,
  UPDATE: (id: string) => `/prospects/${id}`,
  UPDATE_STAGE: (id: string) => `/prospects/${id}/stage`,
  DELETE: (id: string) => `/prospects/${id}`,
  ACTIVITIES: (id: string) => `/prospects/${id}/activities`,
  ACTIVITY: (id: string, activityId: string) => `/prospects/${id}/activities/${activityId}`,
  FOLLOW_UPS: (id: string) => `/prospects/${id}/follow-ups`,
  ACTIVE_FOLLOW_UP: (id: string) => `/prospects/${id}/follow-ups/active`,
  RESCHEDULE_FOLLOW_UP: (id: string, followUpId: string) => `/prospects/${id}/follow-ups/${followUpId}/reschedule`,
  CANCEL_FOLLOW_UP: (id: string, followUpId: string) => `/prospects/${id}/follow-ups/${followUpId}/cancel`,
  EDIT_FOLLOW_UP: (id: string, followUpId: string) => `/prospects/${id}/follow-ups/${followUpId}`,
};
