import { ACTIVITY_TYPE_LABELS } from "@/contracts/constants";
import type { FollowUpOutcome } from "@/contracts/types";

export const OUTCOME_LABELS: Record<FollowUpOutcome, string> = {
  SUCCESSFUL: "Connected",
  NO_RESPONSE: "No answer",
  RESCHEDULED: "Asked to follow up later",
  NOT_INTERESTED: "Not interested",
  OTHER: "Other",
};

export const OUTCOME_OPTIONS = (Object.keys(OUTCOME_LABELS) as FollowUpOutcome[]).map(
  (value) => ({ value, label: OUTCOME_LABELS[value] }),
);

/** "Call", "Site visit", "Status change", … for any activity or follow-up type. */
export const activityTypeLabel = (type: string) =>
  (ACTIVITY_TYPE_LABELS as Record<string, string>)[type] ??
  type
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
