import type { ProspectFollowUpType, ProspectReminder } from "@/contracts/types";
import type { ScheduleFollowUpInput } from "@/contracts/validation";
import { toBusinessParts } from "@/utils/businessTime";
import type { FollowUp } from "../../types";

/** A follow-up being filled in. Date and time are read in the business timezone. */
export type FollowUpDraft = {
  date: string;
  time: string;
  type: ProspectFollowUpType;
  reminder: ProspectReminder | "";
  assignedToId: string;
  notes: string;
};

export const emptyFollowUpDraft = (
  assignedToId = "",
  type: ProspectFollowUpType = "CALL",
): FollowUpDraft => ({
  date: "",
  time: "",
  type,
  reminder: "",
  assignedToId,
  notes: "",
});

export const draftFromFollowUp = (followUp: FollowUp): FollowUpDraft => ({
  ...toBusinessParts(followUp.dueAt),
  type: followUp.type,
  reminder: followUp.reminder ?? "",
  assignedToId: followUp.assignedToId ?? "",
  notes: followUp.notes ?? "",
});

export const toScheduleInput = (draft: FollowUpDraft): ScheduleFollowUpInput => ({
  date: draft.date,
  time: draft.time,
  type: draft.type,
  reminder: draft.reminder || null,
  assignedToId: draft.assignedToId || null,
  notes: draft.notes.trim() || null,
});
