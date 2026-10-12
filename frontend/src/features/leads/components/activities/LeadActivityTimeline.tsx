import { Activity, Pencil, Trash2 } from "lucide-react";
import ActionMenu from "@/components/common/ActionMenu";
import ActivityTypeIcon from "@/components/common/activity/ActivityTypeIcon";
import LoggedLateHint from "@/components/common/activity/LoggedLateHint";
import { activityTypeLabel } from "@/components/common/activity/activityLabels";
import type { LeadActivity } from "@/contracts/types";
import {
  businessDayLabel,
  formatBusinessDateTime,
  formatBusinessTime,
  toBusinessParts,
} from "@/utils/businessTime";

interface LeadActivityTimelineProps {
  activities?: LeadActivity[];
  isLoading?: boolean;
  title?: string;
  isLeadStageView?: boolean;
  /** Shown only for activities the current user may still change. */
  onEdit?: (activity: LeadActivity) => void;
  onDelete?: (activity: LeadActivity) => void;
}

const statusLabel = (status: string) =>
  status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const titleOf = (activity: LeadActivity) => {
  if (activity.type !== "STATUS_CHANGE") return activityTypeLabel(activity.type);
  if (activity.previousStatus && activity.newStatus) {
    return `Status: ${statusLabel(activity.previousStatus)} → ${statusLabel(activity.newStatus)}`;
  }
  return activity.newStatus
    ? `Status changed to ${statusLabel(activity.newStatus)}`
    : "Status changed";
};

/** When it happened; older responses only carry createdAt. */
const occurredAtOf = (activity: LeadActivity) => activity.occurredAt ?? activity.createdAt;

const LeadActivityTimeline = ({
  activities = [],
  isLoading = false,
  title = "Activity Timeline",
  isLeadStageView = false,
  onEdit,
  onDelete,
}: LeadActivityTimelineProps) => {
  const sorted = [...activities].sort(
    (a, b) =>
      new Date(occurredAtOf(b)).getTime() - new Date(occurredAtOf(a)).getTime() ||
      b.id.localeCompare(a.id),
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
          {sorted.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {sorted.length}
            </span>
          )}
          {isLeadStageView && (
            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              Lead Stage
            </span>
          )}
        </div>
      </div>

      {isLoading && sorted.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">Loading activity…</p>
      ) : sorted.length > 0 ? (
        <div className="flex flex-col pt-1">
          {sorted.map((activity, index) => {
            const occurredAt = occurredAtOf(activity);
            const day = toBusinessParts(occurredAt).date;
            const startsDay =
              index === 0 || toBusinessParts(occurredAtOf(sorted[index - 1])).date !== day;
            const isLast = index === sorted.length - 1;
            const canEdit = Boolean(activity.canEdit && onEdit);
            const canDelete = Boolean(activity.canDelete && onDelete);

            return (
              <div key={activity.id}>
                {startsDay && (
                  <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {businessDayLabel(occurredAt)}
                  </h4>
                )}
                <div className="flex gap-3">
                  {/* Timeline node & connector line */}
                  <div className="flex flex-col items-center">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/80 bg-card shadow-xs">
                      <ActivityTypeIcon type={activity.type} />
                    </div>
                    {!isLast && <div className="mt-1 min-h-[24px] w-px flex-1 bg-border/70" />}
                  </div>

                  {/* Content */}
                  <div className={`min-w-0 flex-1 ${isLast ? "" : "pb-5"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground">{titleOf(activity)}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
                          <span title={formatBusinessDateTime(occurredAt)}>
                            {formatBusinessTime(occurredAt)}
                          </span>
                          {activity.createdBy && (
                            <span>
                              · {activity.createdBy.firstName} {activity.createdBy.lastName}
                            </span>
                          )}
                          {activity.loggedLateMinutes ? (
                            <>
                              <span>·</span>
                              <LoggedLateHint
                                minutes={activity.loggedLateMinutes}
                                loggedAt={activity.createdAt}
                              />
                            </>
                          ) : null}
                          {activity.isEdited && <span>· edited</span>}
                        </p>
                      </div>
                      {(canEdit || canDelete) && (
                        <ActionMenu
                          buttonClassName="h-7 w-7"
                          items={[
                            {
                              label: "Edit",
                              icon: Pencil,
                              onClick: () => onEdit?.(activity),
                              show: canEdit,
                            },
                            {
                              label: "Delete",
                              icon: Trash2,
                              onClick: () => onDelete?.(activity),
                              show: canDelete,
                              variant: "destructive",
                            },
                          ]}
                        />
                      )}
                    </div>

                    {activity.remark && (
                      <div className="mt-1.5 whitespace-pre-wrap break-words rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2.5 text-xs leading-relaxed text-foreground shadow-xs">
                        {activity.remark}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-1 rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">
          <Activity className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
          <p className="text-xs font-medium text-foreground">No activity logged yet</p>
          <p className="text-xs text-muted-foreground">
            Record calls, meetings, emails and notes with the Log Activity button.
          </p>
        </div>
      )}
    </div>
  );
};

export default LeadActivityTimeline;
