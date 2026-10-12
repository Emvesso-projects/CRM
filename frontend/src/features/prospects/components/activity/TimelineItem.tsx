import { CheckCircle2, Pencil, Trash2 } from "lucide-react";
import ActionMenu from "@/components/common/ActionMenu";
import ActivityTypeIcon from "@/components/common/activity/ActivityTypeIcon";
import LoggedLateHint from "@/components/common/activity/LoggedLateHint";
import {
  OUTCOME_LABELS,
  activityTypeLabel,
} from "@/components/common/activity/activityLabels";
import { PROSPECT_STAGE_LABELS } from "@/constants/labels";
import type { ProspectTimelineItem } from "@/contracts/types";
import { formatBusinessDateTime, formatBusinessTime } from "@/utils/businessTime";
import { cn } from "@/utils/cn";

const stageLabel = (value: unknown) =>
  typeof value === "string"
    ? ((PROSPECT_STAGE_LABELS as Record<string, string>)[value] ?? value)
    : null;

/** The main text of an entry: what was said for interactions, a readable summary otherwise. */
const bodyOf = (item: ProspectTimelineItem) => {
  if (item.category === "INTERACTION") return item.remark ?? item.summary;

  if (item.type === "STAGE_CHANGE") {
    const from = stageLabel(item.metadata?.previousStage);
    const to = stageLabel(item.metadata?.newStage);
    if (from && to) return `${from} → ${to}`;
  }
  // Older follow-up events describe dates in their own format; the linked follow-up is exact.
  if (item.type === "FOLLOW_UP_SET" && item.followUp) {
    return `${activityTypeLabel(item.followUp.type)} due ${formatBusinessDateTime(item.followUp.dueAt)}`;
  }
  return item.summary;
};

interface TimelineItemProps {
  item: ProspectTimelineItem;
  isLast: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

const TimelineItem = ({ item, isLast, onEdit, onDelete }: TimelineItemProps) => {
  const isInteraction = item.category === "INTERACTION";
  const author = item.createdBy
    ? `${item.createdBy.firstName} ${item.createdBy.lastName}`
    : "System";
  const completed =
    isInteraction && item.followUp?.status === "COMPLETED" ? item.followUp : null;
  const body = bodyOf(item);
  // Extra detail (a stage comment, a reschedule reason) unless the main text already says it.
  const extra =
    !isInteraction && item.details && !(body ?? "").includes(item.details.trim())
      ? item.details
      : null;

  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card shadow-xs">
          <ActivityTypeIcon type={item.type} />
        </div>
        {!isLast && <div className="mt-1 min-h-[16px] w-px flex-1 bg-border/70" />}
      </div>

      <div className={cn("min-w-0 flex-1", !isLast && "pb-4")}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">
              {isInteraction ? activityTypeLabel(item.type) : item.title}
              {isInteraction && item.outcome && (
                <span className="font-medium text-muted-foreground">
                  {" "}
                  · {OUTCOME_LABELS[item.outcome]}
                </span>
              )}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
              <span title={formatBusinessDateTime(item.occurredAt)}>
                {formatBusinessTime(item.occurredAt)}
              </span>
              <span>· {author}</span>
              {item.loggedLateMinutes ? (
                <>
                  <span>·</span>
                  <LoggedLateHint minutes={item.loggedLateMinutes} loggedAt={item.createdAt} />
                </>
              ) : null}
              {item.isEdited && <span>· edited</span>}
            </p>
          </div>
          {(item.canEdit || item.canDelete) && (
            <ActionMenu
              buttonClassName="h-7 w-7"
              items={[
                { label: "Edit", icon: Pencil, onClick: onEdit, show: item.canEdit },
                {
                  label: "Delete",
                  icon: Trash2,
                  onClick: onDelete,
                  show: item.canDelete,
                  variant: "destructive",
                },
              ]}
            />
          )}
        </div>

        {completed && (
          <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" /> Completed the follow-up due{" "}
            {formatBusinessDateTime(completed.dueAt)}
          </p>
        )}

        {body && (
          <div className="mt-1.5 whitespace-pre-wrap break-words rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-xs leading-relaxed text-foreground">
            {body}
          </div>
        )}
        {extra && (
          <p className="mt-1.5 whitespace-pre-wrap break-words text-xs text-muted-foreground">
            {extra}
          </p>
        )}
      </div>
    </li>
  );
};

export default TimelineItem;
