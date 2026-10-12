import type {
  Industry,
  LeadProductPreview,
  LeadSource,
  LeadType,
} from "./lead.types";

export type ProspectStage =
  | "REQUIREMENT"
  | "FOLLOW_UP"
  | "DEMO"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "WON"
  | "LOST";

export type ProspectStatus = "ACTIVE" | "WON" | "LOST";

export type ProspectFollowUpType =
  | "IN_PERSON_MEETING"
  | "VIRTUAL_MEETING"
  | "CALL"
  | "EMAIL"
  | "TEXT"
  | "WHATSAPP"
  | "MEETING"
  | "SITE_VISIT";

export type ProspectReminder = "MINUTES_15" | "MINUTES_30" | "HOUR_1" | "DAY_1";

export type FollowUpStatus =
  | "PENDING"
  | "COMPLETED"
  | "MISSED"
  | "CANCELLED"
  | "RESCHEDULED";

export type FollowUpOutcome =
  | "SUCCESSFUL"
  | "NO_RESPONSE"
  | "NOT_INTERESTED"
  | "RESCHEDULED"
  | "OTHER";

/** Where a pending follow-up stands against the business-day clock. */
export type FollowUpDueState = "OVERDUE" | "DUE_TODAY" | "UPCOMING";

export type ProspectActivityType =
  | "CONVERSION"
  | "STAGE_CHANGE"
  | "IN_PERSON_MEETING"
  | "VIRTUAL_MEETING"
  | "CALL"
  | "EMAIL"
  | "TEXT"
  | "WHATSAPP"
  | "MEETING"
  | "SITE_VISIT"
  | "FOLLOW_UP_SET"
  | "FOLLOW_UP_RESCHEDULED"
  | "FOLLOW_UP_CANCELLED"
  | "QUOTATION_CREATED"
  | "QUOTATION_UPDATED"
  | "NOTE";

export interface ProspectLeadPreview {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  companyName?: string | null;
  gstin?: string | null;
  leadNo?: string | null;
  mobile?: string;
  alternateMobile?: string | null;
  website?: string | null;
  linkedInProfile?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pinCode?: string | null;
  source?: LeadSource | null;
  industry?: Industry | null;
  leadType?: LeadType | null;
  status?: string | null;
  productInterested?: string | null;
  productInterest?: LeadProductPreview | null;
  requiredDescription?: string | null;
  isActive?: boolean;
}

export interface ProspectAssignee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  managerId?: string | null;
}

export interface FollowUp {
  id: string;
  prospectId: string;
  scheduledDate: string;
  scheduledTime?: string | null;
  /** The instant it is due (ISO, UTC). Decide overdue / due-today from this. */
  dueAt: string;
  /** Only for PENDING follow-ups; null once it is closed. */
  health?: FollowUpDueState | null;
  type: ProspectFollowUpType;
  notes?: string | null;
  reminder?: ProspectReminder | null;
  assignedToId?: string | null;
  assignedTo?: ProspectAssignee | null;
  status: FollowUpStatus;
  completedAt?: string | null;
  completedById?: string | null;
  completedBy?: ProspectAssignee | null;
  outcome?: FollowUpOutcome | null;
  completionRemark?: string | null;
  /** @deprecated Use statusReason. */
  missedReason?: string | null;
  /** Why it was cancelled, rescheduled or missed. */
  statusReason?: string | null;
  rescheduledToId?: string | null;
  rescheduledFromId?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** @deprecated Use ProspectTimelineItem from GET /prospects/:id/activities. */
export interface ProspectActivity {
  id: string;
  type: ProspectActivityType;
  title: string;
  summary: string;
  details?: string | null;
  metadata?: Record<string, string | number | boolean | null> | null;
  createdAt: string;
  followUpHealth?: "OK" | "WARNING" | "OVERDUE" | "NONE" | "DONE";
  createdBy?: ProspectAssignee | null;
}

export type ActivityCategory = "INTERACTION" | "FOLLOW_UP" | "SYSTEM";

export interface ProspectTimelineItem {
  id: string;
  prospectId: string;
  type: ProspectActivityType;
  category: ActivityCategory;
  title: string;
  /** What was discussed, for interactions (calls, meetings, notes, …). */
  remark: string | null;
  summary: string;
  details: string | null;
  outcome: FollowUpOutcome | null;
  durationMinutes: number | null;
  metadata: Record<string, unknown> | null;
  /** When it happened (ISO). */
  occurredAt: string;
  /** When it was logged (ISO). */
  createdAt: string;
  /** Set when it was logged well after it happened. */
  loggedLateMinutes: number | null;
  isEdited: boolean;
  createdBy: ProspectAssignee | null;
  /** The follow-up this completed (interactions) or describes (follow-up events). */
  followUp: {
    id: string;
    dueAt: string;
    type: ProspectFollowUpType;
    status: FollowUpStatus;
  } | null;
  canEdit: boolean;
  canDelete: boolean;
}

export interface ProspectTimelinePage {
  items: ProspectTimelineItem[];
  nextCursor: string | null;
}

export interface LogProspectActivityResult {
  activity: ProspectTimelineItem;
  completedFollowUp: FollowUp | null;
  nextFollowUp: FollowUp | null;
  /** True when this request was a retry of one already saved. */
  duplicate: boolean;
}

export interface Prospect {
  id: string;
  prospectNo: string;
  leadId: string | null;
  organizationId: string;
  stage: ProspectStage;
  status: ProspectStatus;
  expectedValue?: number | null;
  closeDate?: string | null;
  /** When the prospect reached WON or LOST (ISO); null while it is open. */
  closedAt?: string | null;
  notes?: string | null;
  assignedToId?: string | null;
  createdAt: string;
  updatedAt: string;
  lead?: ProspectLeadPreview;
  assignedTo?: ProspectAssignee | null;
  activeFollowUp?: FollowUp | null;
  followUpCount?: number;
  /** @deprecated No longer populated; use the timeline endpoint. */
  activities?: ProspectActivity[];
  isTerminal: boolean;
  isEditable: boolean;
  followUpHealth?: "OK" | "WARNING" | "OVERDUE" | "NONE" | "DONE";
}

export interface ConvertLeadToProspectResult {
  isNew: boolean;
  prospect: Prospect;
}
