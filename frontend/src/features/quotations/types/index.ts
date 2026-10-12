import type { PaginationMeta } from "@/types/api";
import type {
  Quotation,
  QuotationAttachment,
  QuotationAttachmentInput,
  QuotationDetails,
  QuotationLineItem,
  QuotationStatus,
} from "@/contracts/types";

export type {
  Quotation,
  QuotationAttachment,
  QuotationAttachmentInput,
  QuotationDetails,
  QuotationLineItem,
  QuotationStatus,
};

export type QuotationGstCategory =
  | "GST"
  | "IGST"
  | "EXEMPTED"
  | "NOT_APPLICABLE";

export interface QuotationFormValues {
  partyName: string;
  contactPerson: string;
  refNo: string;
  date: string;
  status: QuotationStatus;
  assignedToId?: string | null;
  prospectId?: string | null;
  details: QuotationDetails;
  attachments?: QuotationAttachmentInput[];
}

export interface QuotationFilterValues {
  status?: QuotationStatus | QuotationStatus[];
  assignedToId?: string | string[];
  createdFrom?: string;
  createdTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface QuotationsListResult {
  data: Quotation[];
  meta: PaginationMeta & {
    missedFollowUps?: number;
  };
}
