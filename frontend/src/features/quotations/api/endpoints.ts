export const QUOTATION_ENDPOINTS = {
  LIST: "/quotations",
  STATS: "/quotations/stats",
  CREATE: "/quotations",
  GET: (id: string) => `/quotations/${id}`,
  UPDATE: (id: string) => `/quotations/${id}`,
  DELETE: (id: string) => `/quotations/${id}`,
  UPLOAD_TEMP: "/quotations/attachments/temp",
  ADD_ATTACHMENT: (id: string) => `/quotations/${id}/attachments`,
  GET_ATTACHMENT_SIGNED_URL: (id: string, attachmentId: string) =>
    `/quotations/${id}/attachments/${attachmentId}/url`,
  DELETE_ATTACHMENT: (id: string, attachmentId: string) =>
    `/quotations/${id}/attachments/${attachmentId}`,
};
