import { useMemo } from "react";
import { Clock } from "lucide-react";
import FormField from "@/components/common/FormField";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TimePicker } from "@/components/ui/time-picker";
import { useAssignableUsers } from "@/features/leads";
import { businessToday, followUpPresets } from "@/utils/businessTime";
import { cn } from "@/utils/cn";
import { prospectFollowUpTypeOptions, prospectReminderOptions } from "../../constants/options";
import type { FollowUpDraft } from "./followUpDraft";

const textareaClassName =
  "w-full resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-sm shadow-sm outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/20";

interface FollowUpScheduleFieldsProps {
  draft: FollowUpDraft;
  onChange: (next: FollowUpDraft) => void;
  /** Date and time shown read-only: changing them is a reschedule. */
  lockSchedule?: boolean;
  scheduleError?: string | null;
  disabled?: boolean;
}

const FollowUpScheduleFields = ({
  draft,
  onChange,
  lockSchedule = false,
  scheduleError,
  disabled = false,
}: FollowUpScheduleFieldsProps) => {
  const { data: users = [] } = useAssignableUsers();
  const assigneeOptions = useMemo(
    () => users.map((user) => ({ value: user.id, label: `${user.firstName} ${user.lastName}` })),
    [users],
  );
  const presets = useMemo(() => followUpPresets(), []);

  const set = <K extends keyof FollowUpDraft>(field: K, value: FollowUpDraft[K]) =>
    onChange({ ...draft, [field]: value });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {!lockSchedule && (
        <div className="sm:col-span-2">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Quick pick
          </p>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => {
              const active = draft.date === preset.date && draft.time === preset.time;
              return (
                <button
                  key={preset.label}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ ...draft, date: preset.date, time: preset.time })}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all disabled:opacity-60",
                    active
                      ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground",
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <FormField label="Date" required>
        <Input
          type="date"
          value={draft.date}
          min={lockSchedule ? undefined : businessToday()}
          onChange={(event) => set("date", event.target.value)}
          disabled={disabled || lockSchedule}
          aria-invalid={Boolean(scheduleError)}
        />
      </FormField>
      <FormField label="Time" required>
        <TimePicker
          value={draft.time}
          onChange={(value) => set("time", value)}
          disabled={disabled || lockSchedule}
          error={Boolean(scheduleError)}
          placeholder="Select time"
        />
      </FormField>
      {scheduleError && (
        <p className="-mt-2 text-xs font-medium text-destructive sm:col-span-2">{scheduleError}</p>
      )}
      {lockSchedule && (
        <p className="-mt-2 text-xs text-muted-foreground sm:col-span-2">
          To change the date or time, use Reschedule so the original stays in the history.
        </p>
      )}

      <FormField label="Type" required>
        <Select
          value={draft.type}
          onValueChange={(value) => set("type", value as FollowUpDraft["type"])}
          options={prospectFollowUpTypeOptions}
          placeholder="Select type"
          disabled={disabled}
        />
      </FormField>
      <FormField label="Reminder">
        <Select
          value={draft.reminder}
          onValueChange={(value) => set("reminder", value as FollowUpDraft["reminder"])}
          options={[{ value: "", label: "No reminder" }, ...prospectReminderOptions]}
          disabled={disabled}
        />
      </FormField>
      <FormField label="Assigned to" className="sm:col-span-2">
        <Select
          value={draft.assignedToId}
          onValueChange={(value) => set("assignedToId", value)}
          options={assigneeOptions}
          placeholder="Select assignee"
          disabled={disabled}
        />
      </FormField>
      <FormField label="Notes" className="sm:col-span-2">
        <textarea
          value={draft.notes}
          onChange={(event) => set("notes", event.target.value)}
          maxLength={500}
          rows={2}
          disabled={disabled}
          className={textareaClassName}
          placeholder="What should happen on this follow-up?"
        />
      </FormField>
    </div>
  );
};

export default FollowUpScheduleFields;
