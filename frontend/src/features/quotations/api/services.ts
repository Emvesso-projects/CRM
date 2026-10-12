import api from "@/lib/api/client";
import { createApiService } from "@/lib/api/service.utils";
import type { CreateQuotationInput, UpdateQuotationInput } from "@/contracts/validation";
import type { Quotation } from "@/contracts/types";
import type { QuotationFilterValues } from "../types";
import { resolveAssetUrl } from "@/utils/assetUrl";
import { QUOTATION_ENDPOINTS } from "./endpoints";

const service = createApiService(api);

export const quotationsService = {
  getQuotations: (params?: QuotationFilterValues) => 
    service.get<Quotation[]>(QUOTATION_ENDPOINTS.LIST, { params }),

  getQuotationStats: () => 
    service.get<{ total: number; pending: number; approved: number; rejected: number }>(QUOTATION_ENDPOINTS.STATS).then(res => res.data),

  getQuotationDetail: (id: string) => 
    service.get<Quotation>(QUOTATION_ENDPOINTS.GET(id)).then(res => res.data),

  createQuotation: (payload: CreateQuotationInput) => 
    service.post<Quotation>(QUOTATION_ENDPOINTS.CREATE, payload).then(res => res.data),

  updateQuotation: (id: string, payload: UpdateQuotationInput) => 
    service.patch<Quotation>(QUOTATION_ENDPOINTS.UPDATE(id), payload).then(res => res.data),

  deleteQuotation: (id: string) => 
    service.delete<void>(QUOTATION_ENDPOINTS.DELETE(id)),

  uploadTempAttachment: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post<{
      data: {
        key: string;
        originalName: string;
        mimeType: string;
        size: number;
        type: "IMAGE" | "DOCUMENT";
      };
    }>(QUOTATION_ENDPOINTS.UPLOAD_TEMP, formData);
    return res.data.data;
  },

  getAttachmentSignedUrl: async (quotationId: string, attachmentId: string) => {
    const res = await api.get<{
      data: { url: string; filename: string; mimeType: string; size: number };
    }>(QUOTATION_ENDPOINTS.GET_ATTACHMENT_SIGNED_URL(quotationId, attachmentId));
    const data = res.data.data;
    return {
      ...data,
      url: resolveAssetUrl(data.url) || data.url,
    };
  },

  deleteAttachment: (quotationId: string, attachmentId: string) =>
    service.delete<void>(
      QUOTATION_ENDPOINTS.DELETE_ATTACHMENT(quotationId, attachmentId),
    ),
};
