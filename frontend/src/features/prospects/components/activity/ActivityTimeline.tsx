import { useMemo, useState } from "react";
import { Activity } from "lucide-react";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import type { ProspectTimelineItem } from "@/contracts/types";
import type { TimelineCategoryFilter } from "@/contracts/validation";
import { businessDayLabel, toBusinessParts } from "@/utils/businessTime";
import { cn } from "@/utils/cn";
import {
  useDeleteProspectActivity,
  useProspectTimeline,
} from "../../hooks/useProspectActivities";
import TimelineItem from "./TimelineItem";

const FILTERS: Array<{ value: TimelineCategoryFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "INTERACTIONS", label: "Interactions" },
  { value: "FOLLOW_UPS", label: "Follow-ups" },
  { value: "SYSTEM", label: "Stage & system" },
];

const EMPTY_MESSAGES: Record<TimelineCategoryFilter, string> = {
  ALL: "Nothing recorded yet. Log calls, meetings and notes with Log activity.",
  INTERACTIONS: "No calls, meetings or notes logged yet.",
  FOLLOW_UPS: "No follow-ups scheduled yet.",
  SYSTEM: "No stage changes or system entries yet.",
};

/** Consecutive items (already newest first) grouped by the business day they happened. */
const groupByDay = (items: ProspectTimelineItem[]) => {
  const groups: Array<{ key: string; label: string; items: ProspectTimelineItem[] }> = [];
  for (const item of items) {
    const key = toBusinessParts(item.occurredAt).date;
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(item);
    } else {
      groups.push({ key, label: businessDayLabel(item.occurredAt), items: [item] });
    }
  }
  return groups;
};

interface ActivityTimelineProps {
  prospectId: string;
  onEdit: (item: ProspectTimelineItem) => void;
}

const ActivityTimeline = ({ prospectId, onEdit }: ActivityTimelineProps) => {
  const [category, setCategory] = useState<TimelineCategoryFilter>("ALL");
  const [deleting, setDeleting] = useState<ProspectTimelineItem | null>(null);
  const timeline = useProspectTimeline(prospectId, category);
  const deleteActivity = useDeleteProspectActivity();

  const groups = useMemo(
    () => groupByDay(timeline.data?.pages.flatMap((page) => page.items) ?? []),
    [timeline.data],
  );

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteActivity.mutateAsync({ prospectId, activityId: deleting.id });
      setDeleting(null);
    } catch {
      // The mutation shows the error.
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Filter the timeline" className="flex flex-wrap gap-1.5">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            role="tab"
            aria-selected={category === filter.value}
            onClick={() => setCategory(filter.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-[11px] font-semibold transition-all",
              category === filter.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {timeline.isLoading ? (
        <p className="py-8 text-center text-xs text-muted-foreground">Loading activity…</p>
      ) : timeline.isError ? (
        <div className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-center text-xs text-muted-foreground">
          <p>The timeline couldn't be loaded.</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2 h-7 rounded-full text-xs"
            onClick={() => timeline.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : groups.length === 0 ? (
        <div className="space-y-1 rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-8 text-center">
          <Activity className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">{EMPTY_MESSAGES[category]}</p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key} aria-label={group.label}>
            <h5 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </h5>
            <ol className="flex flex-col">
              {group.items.map((item, index) => (
                <TimelineItem
                  key={item.id}
                  item={item}
                  isLast={index === group.items.length - 1}
                  onEdit={() => onEdit(item)}
                  onDelete={() => setDeleting(item)}
                />
              ))}
            </ol>
          </section>
        ))
      )}

      {timeline.hasNextPage && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="self-center rounded-full text-xs"
          onClick={() => timeline.fetchNextPage()}
          disabled={timeline.isFetchingNextPage}
        >
          {timeline.isFetchingNextPage ? "Loading…" : "Load older activity"}
        </Button>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete this activity?"
        description="It will be removed from the timeline. The deletion is kept in the audit log."
        confirmText="Delete"
        variant="destructive"
        loading={deleteActivity.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default ActivityTimeline;
