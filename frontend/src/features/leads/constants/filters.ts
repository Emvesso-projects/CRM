import type { FilterConfigItem } from "@/types/filter.types";
import {
  INDUSTRY_LABELS,
  LEAD_SOURCE_LABELS,
  LEAD_STATUS_LABELS,
} from "@/constants/labels";

const toOptions = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

export const LEAD_FILTER_CONFIG: FilterConfigItem[] = [
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
    name: "status",
    label: "Status",
    options: toOptions(LEAD_STATUS_LABELS),
  },
  {
    type: "checkbox-group",
    name: "source",
    label: "Source",
    options: toOptions(LEAD_SOURCE_LABELS),
  },
  {
    type: "checkbox-group",
    name: "industry",
    label: "Industry",
    options: toOptions(INDUSTRY_LABELS),
  },
];
