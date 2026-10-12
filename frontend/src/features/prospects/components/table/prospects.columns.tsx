import { type ColumnDef } from "@tanstack/react-table";
import {
  CalendarClock,
  CalendarPlus,
  Check,
  Eye,
  NotebookPen,
  Pencil,
  RefreshCw,
  Trash,
} from "lucide-react";
import ActionMenu from "@/components/common/ActionMenu";
import TooltipLabel from "@/components/common/TooltipLabel";
import FollowUpHealthBadge from "@/components/common/FollowUpHealthBadge";
import StatusBadge from "@/components/common/StatusBadge";
import { activityTypeLabel } from "@/components/common/activity/activityLabels";
import { PROSPECT_STAGE_LABELS } from "@/constants/labels";
import { formatBusinessDateTime } from "@/utils/businessTime";
import type { Prospect } from "../../types";

export interface ProspectRowActions {
  onView: (prospect: Prospect) => void;
  onEdit: (prospect: Prospect) => void;
  onChangeStage: (prospect: Prospect) => void;
  onDelete: (prospect: Prospect) => void;
  onLogActivity: (prospect: Prospect) => void;
  onMarkDone: (prospect: Prospect) => void;
  onReschedule: (prospect: Prospect) => void;
  onScheduleFollowUp: (prospect: Prospect) => void;
}

const formatDate = (value?: string | null) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-IN");
};

const quickActionClassName =
  "flex h-7 w-7 items-center justify-center rounded-lg border bg-card text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary";

export const getProspectsColumns = ({
  onView,
  onEdit,
  onChangeStage,
  onDelete,
  onLogActivity,
  onMarkDone,
  onReschedule,
  onScheduleFollowUp,
}: ProspectRowActions): ColumnDef<Prospect>[] => [
  {
    header: "Prospect No",
    accessorKey: "prospectNo",
    meta: {
      className:
        "whitespace-nowrap text-xs font-semibold uppercase text-muted-foreground",
    },
    cell: ({ row }) => {
      const prospect = row.original;
      return (
        <TooltipLabel label="View prospect details">
          <button
            type="button"
            onClick={() => onView(prospect)}
            className="text-blue-500 underline bg-transparent py-0.5 text-left font-semibold transition-all hover:border-foreground cursor-pointer"
          >
            {prospect.prospectNo}
          </button>
        </TooltipLabel>
      );
    },
  },
  {
    header: "Company Name",
    id: "companyName",
    meta: {
      className: "min-w-[220px]",
    },
    cell: ({ row }) => {
      const prospect = row.original;
      return (
        <div className="space-y-1">
          <p className="font-medium text-foreground">
            {prospect.lead?.companyName || "-"}
          </p>
          <p className="text-xs text-muted-foreground">
            {[prospect.lead?.firstName, prospect.lead?.lastName]
              .filter(Boolean)
              .join(" ") || "No contact"}
          </p>
        </div>
      );
    },
  },
  {
    header: "Stage",
    accessorKey: "stage",
    meta: {
      className: "whitespace-nowrap",
    },
    cell: ({ row }) => (
      <StatusBadge
        status={row.original.stage}
        label={PROSPECT_STAGE_LABELS[row.original.stage]}
      />
    ),
  },
  {
    header: "Assigned To",
    accessorKey: "assignedTo",
    meta: {
      className: "whitespace-nowrap",
    },
    cell: ({ row }) => {
      const user = row.original.assignedTo;
      return user ? `${user.firstName} ${user.lastName}` : "Unassigned";
    },
  },
  {
    header: "Created Date",
    accessorKey: "createdAt",
    meta: {
      className: "whitespace-nowrap",
    },
    cell: ({ row }) => formatDate(row.original.createdAt),
  },
  {
    header: "Next Follow-up",
    id: "nextFollowUp",
    meta: {
      className: "whitespace-nowrap min-w-[220px]",
    },
    cell: ({ row }) => {
      const prospect = row.original;
      const active = prospect.isTerminal ? null : prospect.activeFollowUp;

      return (
        <div className="flex items-center gap-2">
          <div className="space-y-0.5">
            <FollowUpHealthBadge prospect={prospect} />
            {active ? (
              <p className="text-[11px] text-muted-foreground">
                {activityTypeLabel(active.type)} · {formatBusinessDateTime(active.dueAt)}
              </p>
            ) : null}
          </div>
          {prospect.isEditable && (
            <div className="ml-auto">
              {active ? (
                <TooltipLabel label="Mark follow-up done">
                  <button
                    type="button"
                    aria-label="Mark follow-up done"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkDone(prospect);
                    }}
                    className={`${quickActionClassName} border-border/80`}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </TooltipLabel>
              ) : (
                <TooltipLabel label="Schedule follow-up">
                  <button
                    type="button"
                    aria-label="Schedule follow-up"
                    onClick={(e) => {
                      e.stopPropagation();
                      onScheduleFollowUp(prospect);
                    }}
                    className={`${quickActionClassName} border-dashed border-border`}
                  >
                    <CalendarPlus className="h-3.5 w-3.5" />
                  </button>
                </TooltipLabel>
              )}
            </div>
          )}
        </div>
      );
    },
  },
  {
    id: "actions",
    header: "Actions",
    meta: {
      headerClassName: "text-center",
      className: "text-center",
    },
    cell: ({ row }) => {
      const prospect = row.original;
      const canEdit = prospect.isEditable;
      const hasActive = Boolean(prospect.activeFollowUp) && !prospect.isTerminal;

      return (
        <ActionMenu
          items={[
            {
              label: "View Details",
              icon: Eye,
              onClick: () => onView(prospect),
              tooltip: "View prospect details",
            },
            {
              label: "Log Activity",
              icon: NotebookPen,
              onClick: () => onLogActivity(prospect),
              tooltip: "Record a call, meeting or note, at the time it happened",
            },
            {
              label: "Mark Follow-up Done",
              icon: Check,
              onClick: () => onMarkDone(prospect),
              show: canEdit && hasActive,
              tooltip: "Log what happened and complete the follow-up",
            },
            {
              label: "Reschedule Follow-up",
              icon: CalendarClock,
              onClick: () => onReschedule(prospect),
              show: canEdit && hasActive,
              tooltip: "Move the follow-up to a new date and time",
            },
            {
              label: "Schedule Follow-up",
              icon: CalendarPlus,
              onClick: () => onScheduleFollowUp(prospect),
              show: canEdit && !hasActive,
              tooltip: "Plan the next touchpoint",
            },
            {
              label: "Edit",
              icon: Pencil,
              onClick: () => onEdit(prospect),
              show: canEdit,
              tooltip: "Edit prospect",
            },
            {
              label: "Change Stage",
              icon: RefreshCw,
              onClick: () => onChangeStage(prospect),
              show: canEdit,
              tooltip: "Update prospect stage",
            },
            {
              label: "Delete",
              icon: Trash,
              onClick: () => onDelete(prospect),
              show: canEdit,
              tooltip: "Delete prospect",
              variant: "destructive",
            },
          ]}
        />
      );
    },
  },
];
