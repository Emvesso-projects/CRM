import { CalendarClock, CalendarPlus, Check, Pencil, User, X } from "lucide-react";
import ActionMenu from "@/components/common/ActionMenu";
import ActivityTypeIcon from "@/components/common/activity/ActivityTypeIcon";
import FollowUpDueBadge from "@/components/common/activity/FollowUpDueBadge";
import { activityTypeLabel } from "@/components/common/activity/activityLabels";
import { Button } from "@/components/ui/button";
import { formatBusinessDateTime } from "@/utils/businessTime";
import { prospectReminderOptions } from "../../constants/options";
import type { Prospect } from "../../types";

interface NextStepCardProps {
  prospect: Prospect;
  onMarkDone: () => void;
  onReschedule: () => void;
  onEditDetails: () => void;
  onCancel: () => void;
  onSchedule: () => void;
}

/** The one planned follow-up of an open prospect, and what can be done with it. */
const NextStepCard = ({
  prospect,
  onMarkDone,
  onReschedule,
  onEditDetails,
  onCancel,
  onSchedule,
}: NextStepCardProps) => {
  if (prospect.isTerminal) return null;

  const followUp = prospect.activeFollowUp;
  const canManage = prospect.isEditable;

  if (!followUp) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border/80 bg-muted/10 px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Next step
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">No follow-up planned</p>
        </div>
        {canManage && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onSchedule}
            className="h-8 rounded-full px-3 text-xs font-bold"
          >
            <CalendarPlus className="mr-1 h-3.5 w-3.5" /> Schedule follow-up
          </Button>
        )}
      </div>
    );
  }

  const assignee = followUp.assignedTo
    ? `${followUp.assignedTo.firstName} ${followUp.assignedTo.lastName}`
    : "Unassigned";
  const reminder = prospectReminderOptions.find((option) => option.value === followUp.reminder)?.label;

  return (
    <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Next step
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground">
            <ActivityTypeIcon type={followUp.type} />
            {activityTypeLabel(followUp.type)}
            <span className="font-normal text-muted-foreground">
              · {formatBusinessDateTime(followUp.dueAt)}
            </span>
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            {assignee}
            {reminder ? ` · Reminder ${reminder}` : ""}
          </p>
        </div>
        <FollowUpDueBadge dueAt={followUp.dueAt} className="shrink-0" />
      </div>

      {followUp.notes && (
        <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">
          {followUp.notes}
        </p>
      )}

      {canManage && (
        <div className="flex items-center gap-2 border-t border-border/30 pt-3">
          <Button
            type="button"
            size="sm"
            onClick={onMarkDone}
            className="h-8 rounded-full px-3 text-xs font-bold"
          >
            <Check className="mr-1 h-3.5 w-3.5" /> Mark done
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onReschedule}
            className="h-8 rounded-full px-3 text-xs font-bold"
          >
            <CalendarClock className="mr-1 h-3.5 w-3.5" /> Reschedule
          </Button>
          <ActionMenu
            className="ml-auto"
            items={[
              {
                label: "Edit details",
                icon: Pencil,
                onClick: onEditDetails,
                tooltip: "Change the type, reminder, assignee or notes",
              },
              {
                label: "Cancel follow-up",
                icon: X,
                onClick: onCancel,
                variant: "destructive",
              },
            ]}
          />
        </div>
      )}
    </div>
  );
};

export default NextStepCard;
