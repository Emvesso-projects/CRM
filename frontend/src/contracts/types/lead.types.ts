export type LeadSource =
  | "COLD_CALL"
  | "EMAIL"
  | "REFERENCE"
  | "SOCIAL_MEDIA"
  | "WEBSITE"
  | "ADVERTISE"
  | "GOOGLE_ADS"
  | "EVENT"
  | "TRADE_SHOW"
  | "FACEBOOK"
  | "INSTAGRAM"
  | "LINKEDIN"
  | "OTHER";

export type Industry =
  | "IT"
  | "BANKING"
  | "BANKING_FINANCE"
  | "EDUCATION"
  | "MANUFACTURING"
  | "HEALTHCARE"
  | "REAL_ESTATE"
  | "RETAIL"
  | "ECOMMERCE"
  | "AUTOMOBILE"
  | "CONSTRUCTION"
  | "TRAVEL_TOURISM"
  | "MEDIA_ENTERTAINMENT"
  | "FOOD_BEVERAGES"
  | "SCIENCE_TECHNOLOGY"
  | "OTHER";

export type LeadType = "NEW" | "EXISTING";

export type LeadStatus =
  | "NEW"
  | "ATTEMPTED_CONTACT"
  | "CONTACTED"
  | "QUALIFIED"
  | "UNQUALIFIED";

export interface LeadUserPreview {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface LeadProductPreview {
  id: string;
  name: string;
  itemCode: string | null;
}

export interface Lead {
  id: string;
  leadNo: string;
  firstName: string;
  lastName: string;
  profilePicture?: string | null;
  mobile: string;
  alternateMobile?: string | null;
  companyName?: string | null;
  gstin?: string | null;
  email: string;
  website?: string | null;
  linkedInProfile?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pinCode?: string | null;
  source?: LeadSource | null;
  industry?: Industry | null;
  customIndustry?: string | null;
  leadType?: LeadType | null;
  status: LeadStatus;
  productInterested?: string | null;
  productInterest?: LeadProductPreview | null;
  requiredDescription?: string | null;
  assignedToId?: string | null;
  assignedTo?: LeadUserPreview | null;
  convertedAt?: string | null;
  convertedById?: string | null;
  leadDate: string;
  createdAt: string;
  isConverted: boolean;
  isActive?: boolean;
  activities?: LeadActivity[];
}

export type LeadActivityType =
  | "STATUS_CHANGE"
  | "IN_PERSON_MEETING"
  | "VIRTUAL_MEETING"
  | "CALL"
  | "EMAIL"
  | "TEXT"
  | "WHATSAPP"
  | "MEETING"
  | "SITE_VISIT"
  | "NOTE";

export interface LeadActivityUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  type: LeadActivityType;
  remark: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  /** When it happened (ISO). Falls back to createdAt for older responses. */
  occurredAt?: string;
  createdById: string;
  createdBy?: LeadActivityUser | null;
  /** When it was logged (ISO). */
  createdAt: string;
  /** Set when it was logged well after it happened. */
  loggedLateMinutes?: number | null;
  isEdited?: boolean;
  /** Whether the current user may still edit / delete it. */
  canEdit?: boolean;
  canDelete?: boolean;
}

