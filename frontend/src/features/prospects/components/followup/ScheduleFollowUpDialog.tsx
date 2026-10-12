import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ROLES } from "@/constants/roles";
import { useAuth } from "@/features/auth";
import { followUpScheduleProblem } from "@/utils/businessTime";
import { useEditFollowUp, useScheduleFollowUp } from "../../hooks/useFollowUp";
import type { FollowUp } from "../../types";
import FollowUpScheduleFields from "./FollowUpScheduleFields";
import {
  draftFromFollowUp,
  emptyFollowUpDraft,
  toScheduleInput,
  type FollowUpDraft,
} from "./followUpDraft";

interface ScheduleFollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospectId: string;
  /** Assignee for a new follow-up, usually the prospect's owner. */
  defaultAssigneeId?: string | null;
  /** Edit the details (type, reminder, assignee, notes) of this pending follow-up. */
  followUp?: FollowUp | null;
}

type FormProps = Omit<ScheduleFollowUpDialogProps, "open" | "onOpenChange"> & {
  onDone: () => void;
};

const ScheduleFollowUpForm = ({ prospectId, defaultAssigneeId, followUp, onDone }: FormProps) => {
  const { user } = useAuth();
  const isEdit = Boolean(followUp);
  // A super admin working inside an organization isn't one of its members.
  const selfAssigneeId = user && user.role !== ROLES.SUPER_ADMIN ? user.id : "";
  const [draft, setDraft] = useState<FollowUpDraft>(() =>
    followUp
      ? draftFromFollowUp(followUp)
      : emptyFollowUpDraft(defaultAssigneeId || selfAssigneeId),
  );
  const [submitted, setSubmitted] = useState(false);
  const schedule = useScheduleFollowUp();
  const edit = useEditFollowUp();
  const isPending = schedule.isPending || edit.isPending;
  const scheduleError = isEdit ? null : followUpScheduleProblem(draft);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!isEdit && followUpScheduleProblem(draft)) return;

    try {
      if (followUp) {
        await edit.mutateAsync({
          prospectId,
          followUpId: followUp.id,
          data: {
            type: draft.type,
            reminder: draft.reminder || null,
            assignedToId: draft.assignedToId || null,
            notes: draft.notes.trim() || null,
          },
        });
      } else {
        await schedule.mutateAsync({ prospectId, data: toScheduleInput(draft) });
      }
      onDone();
    } catch {
      // The mutation shows the error; keep the form open.
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader className="border-b border-border px-6 py-5">
        <DialogTitle>{isEdit ? "Edit follow-up details" : "Schedule follow-up"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Change the type, reminder, assignee or notes."
            : "Plan the next touchpoint with this prospect."}
        </DialogDescription>
      </DialogHeader>
      <div className="px-6 py-5">
        <FollowUpScheduleFields
          draft={draft}
          onChange={setDraft}
          lockSchedule={isEdit}
          scheduleError={submitted ? scheduleError : null}
          disabled={isPending}
        />
      </div>
      <DialogFooter className="border-t border-border px-6 py-4">
        <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : isEdit ? "Save changes" : "Schedule follow-up"}
        </Button>
      </DialogFooter>
    </form>
  );
};

const ScheduleFollowUpDialog = ({ open, onOpenChange, ...formProps }: ScheduleFollowUpDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg p-0">
      <ScheduleFollowUpForm {...formProps} onDone={() => onOpenChange(false)} />
    </DialogContent>
  </Dialog>
);

export default ScheduleFollowUpDialog;
