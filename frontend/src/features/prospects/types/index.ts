import type { PaginationMeta } from "@/types/api";
import type {
  Prospect as ProspectContract,
  ProspectActivity as ProspectActivityContract,
  ProspectActivityType as ProspectActivityTypeContract,
  ProspectAssignee as ProspectAssigneeContract,
  FollowUp as FollowUpContract,
  FollowUpOutcome as FollowUpOutcomeContract,
  FollowUpStatus as FollowUpStatusContract,
  ProspectFollowUpType as ProspectFollowUpTypeContract,
  ProspectLeadPreview as ProspectLeadPreviewContract,
  ProspectReminder as ProspectReminderContract,
  ProspectStage as ProspectStageContract,
  ProspectStatus as ProspectStatusContract,
} from "@/contracts/types";

export type ProspectStage = ProspectStageContract;
export type ProspectStatus = ProspectStatusContract;
export type ProspectFollowUpType = ProspectFollowUpTypeContract;
export type ProspectReminder = ProspectReminderContract;
export type ProspectActivityType = ProspectActivityTypeContract;
export type ProspectLeadPreview = ProspectLeadPreviewContract;
export type ProspectAssignee = ProspectAssigneeContract;
export type FollowUp = FollowUpContract;
export type FollowUpStatus = FollowUpStatusContract;
export type FollowUpOutcome = FollowUpOutcomeContract;
export type ProspectActivity = ProspectActivityContract;
export type Prospect = ProspectContract;

export interface ProspectFormValues {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  alternateMobile?: string;
  address?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  companyName: string;
  gstin?: string;
  leadSource?: string;
  industry?: string;
  customIndustry?: string;
  leadType?: string;
  leadDate?: string;
  productInterested?: string;
  expectedValue: string;
  assignedToId: string;
  notes: string;
}

export type ProspectFilterValues = {
  stage?: ProspectStage | ProspectStage[];
  assignedToId?: string | string[];
  createdFrom?: string;
  createdTo?: string;
  search?: string;
  page?: number;
  limit?: number;
  status?: string | string[];
  followUpStatus?: "OVERDUE" | "DUE_TODAY" | "UPCOMING" | "NO_FOLLOWUP" | Array<"OVERDUE" | "DUE_TODAY" | "UPCOMING" | "NO_FOLLOWUP">;
};

export interface ProspectsListResult {
  data: Prospect[];
  meta: PaginationMeta;
}
