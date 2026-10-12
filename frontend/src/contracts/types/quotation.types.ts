export type QuotationStatus = "APPROVED" | "PENDING" | "REJECTED";

export interface QuotationLineItem {
  id?: string;
  itemId: string;
  itemName: string;
  code: string;
  quantity: number;
  unit: string;
  price: number;
  discountPercent: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  amount: number;
}

export interface QuotationDetails {
  partyAddress: string;
  partyPostalCode: string;
  stateOfSupply: string;
  refNoSuffix: string;
  items: QuotationLineItem[];
  subtotal: number;
  taxTotal: number;
  tdsPercent: number;
  tdsAmount: number;
  roundOff: number;
  grandTotal: number;
  description?: string;
  termsAndConditions?: string | string[];
  gstCategory: string;
}


export interface QuotationAttachment {
  id: string;
  quotationId?: string;
  key: string;
  originalName: string;
  mimeType: string;
  size: number;
  type: "IMAGE" | "DOCUMENT";
  createdAt: string;
}

export interface QuotationAttachmentInput {
  key: string;
  originalName: string;
  mimeType: string;
  size: number;
  type: "IMAGE" | "DOCUMENT";
}

export interface Quotation {
  id: string;
  quotationNo: string;
  partyName: string;
  contactPerson: string;
  refNo: string;
  date: string;
  status: QuotationStatus;
  assignedToId: string | null;
  prospectId?: string | null;
  assignedTo?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  details?: QuotationDetails | null;
  attachments?: QuotationAttachment[];
  organization?: {
    id: string;
    name: string;
    prefix: string;
    address?: string | null;
    gstin?: string | null;
    mobile?: string | null;
    email?: string | null;
    companyLogo?: string | null;
    qrCode?: string | null;
    signature?: string | null;
    bankName?: string | null;
    accountHolderName?: string | null;
    accountNumber?: string | null;
    ifscCode?: string | null;
    branchName?: string | null;
    accountType?: string | null;
  };
}
