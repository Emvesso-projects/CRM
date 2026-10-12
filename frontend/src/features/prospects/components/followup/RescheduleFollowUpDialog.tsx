import { useMemo, useState } from "react";
import { Clock } from "lucide-react";
import FormField from "@/components/common/FormField";
import { activityTypeLabel } from "@/components/common/activity/activityLabels";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TimePicker } from "@/components/ui/time-picker";
import {
  businessToday,
  followUpPresets,
  followUpScheduleProblem,
  formatBusinessDateTime,
  toBusinessParts,
  type DateTimeParts,
} from "@/utils/businessTime";
import { cn } from "@/utils/cn";
import { useRescheduleFollowUp } from "../../hooks/useFollowUp";
import type { FollowUp } from "../../types";

const REASONS = ["Customer asked", "I couldn't make it", "Other"] as const;
type Reason = (typeof REASONS)[number];

const chipClassName = (active: boolean) =>
  cn(
    "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all disabled:opacity-60",
    active
      ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30"
      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
  );

/** "Customer asked: wants to talk after the budget meeting" */
const reasonText = (reason: Reason | null, note: string) => {
  const detail = note.trim();
  const label = reason && reason !== "Other" ? reason : null;
  if (label && detail) return `${label}: ${detail}`;
  return label || detail || (reason === "Other" ? "Other" : null);
};

interface RescheduleFormProps {
  prospectId: string;
  followUp: FollowUp;
  onDone: () => void;
}

const RescheduleForm = ({ prospectId, followUp, onDone }: RescheduleFormProps) => {
  const [when, setWhen] = useState<DateTimeParts>(() => ({
    date: "",
    time: toBusinessParts(followUp.dueAt).time,
  }));
  const [reason, setReason] = useState<Reason | null>(null);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const reschedule = useRescheduleFollowUp();
  const presets = useMemo(() => followUpPresets(), []);
  const problem = followUpScheduleProblem(when);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (followUpScheduleProblem(when)) return;
    try {
      await reschedule.mutateAsync({
        prospectId,
        followUpId: followUp.id,
        data: { date: when.date, time: when.time, reason: reasonText(reason, note) },
      });
      onDone();
    } catch {
      // The mutation shows the error; keep the form open.
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader className="border-b border-border px-6 py-5">
        <DialogTitle>Reschedule follow-up</DialogTitle>
        <DialogDescription>
          {activityTypeLabel(followUp.type)} due {formatBusinessDateTime(followUp.dueAt)}. The
          original stays in the history.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5 px-6 py-5">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> New date and time
          </p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                disabled={reschedule.isPending}
                onClick={() => setWhen({ date: preset.date, time: preset.time })}
                className={chipClassName(preset.date === when.date && preset.time === when.time)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="date"
              aria-label="New date"
              value={when.date}
              min={businessToday()}
              onChange={(event) => setWhen({ ...when, date: event.target.value })}
              disabled={reschedule.isPending}
              aria-invalid={submitted && Boolean(problem)}
            />
            <TimePicker
              value={when.time}
              onChange={(time) => setWhen({ ...when, time })}
              disabled={reschedule.isPending}
              error={submitted && Boolean(problem)}
            />
          </div>
          {submitted && problem && (
            <p className="mt-2 text-xs font-medium text-destructive">{problem}</p>
          )}
        </div>

        <FormField label="Why is it moving? (optional)">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {REASONS.map((option) => (
              <button
                key={option}
                type="button"
                disabled={reschedule.isPending}
                onClick={() => setReason(reason === option ? null : option)}
                className={chipClassName(reason === option)}
              >
                {option}
              </button>
            ))}
          </div>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={400}
            rows={2}
            disabled={reschedule.isPending}
            className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-sm shadow-sm outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/20"
            placeholder="Add a note (optional)"
          />
        </FormField>
      </div>

      <DialogFooter className="border-t border-border px-6 py-4">
        <Button type="button" variant="outline" onClick={onDone} disabled={reschedule.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={reschedule.isPending}>
          {reschedule.isPending ? "Saving..." : "Reschedule"}
        </Button>
      </DialogFooter>
    </form>
  );
};

interface RescheduleFollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospectId: string;
  followUp: FollowUp | null | undefined;
}

const RescheduleFollowUpDialog = ({
  open,
  onOpenChange,
  prospectId,
  followUp,
}: RescheduleFollowUpDialogProps) => (
  <Dialog open={open && Boolean(followUp)} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg p-0">
      {followUp && (
        <RescheduleForm
          key={followUp.id}
          prospectId={prospectId}
          followUp={followUp}
          onDone={() => onOpenChange(false)}
        />
      )}
    </DialogContent>
  </Dialog>
);

export default RescheduleFollowUpDialog;
