import type { FilterConfigItem } from "@/types/filter.types";
import { PROSPECT_STAGE_LABELS } from "@/constants/labels";

const toOptions = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

export const PROSPECT_FILTER_CONFIG: FilterConfigItem[] = [
  {
    type: "text",
    name: "createdFrom",
    label: "From Date",
    inputType: "date",
  },
  {
    type: "text",
    name: "createdTo",
    label: "To Date",
    inputType: "date",
  },
  {
    type: "checkbox-group",
    name: "stage",
    label: "Stage",
    options: toOptions(PROSPECT_STAGE_LABELS),
  },
  {
    type: "checkbox-group",
    name: "followUpStatus",
    label: "Follow-Up Status",
    options: [
      { value: "OVERDUE", label: "Overdue" },
      { value: "DUE_TODAY", label: "Due Today" },
      { value: "UPCOMING", label: "Upcoming" },
      { value: "NO_FOLLOWUP", label: "No Follow-up" },
    ],
  },
];

