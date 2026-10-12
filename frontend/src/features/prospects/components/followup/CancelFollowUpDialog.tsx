import { useState } from "react";
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
import { formatBusinessDateTime } from "@/utils/businessTime";
import { useCancelFollowUp } from "../../hooks/useFollowUp";
import type { FollowUp } from "../../types";

interface CancelFormProps {
  prospectId: string;
  followUp: FollowUp;
  onDone: () => void;
}

const CancelForm = ({ prospectId, followUp, onDone }: CancelFormProps) => {
  const [reason, setReason] = useState("");
  const cancel = useCancelFollowUp();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await cancel.mutateAsync({
        prospectId,
        followUpId: followUp.id,
        data: { reason: reason.trim() || null },
      });
      onDone();
    } catch {
      // The mutation shows the error; keep the dialog open.
    }
  };

  return (
    <form onSubmit={submit}>
      <DialogHeader className="border-b border-border px-6 py-5">
        <DialogTitle>Cancel this follow-up?</DialogTitle>
        <DialogDescription>
          {activityTypeLabel(followUp.type)} due {formatBusinessDateTime(followUp.dueAt)} will be
          cancelled. It stays in the timeline.
        </DialogDescription>
      </DialogHeader>
      <div className="px-6 py-5">
        <FormField label="Reason (optional)">
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={3}
            disabled={cancel.isPending}
            className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-sm shadow-sm outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/20"
            placeholder="e.g. Customer already decided, no longer needed"
          />
        </FormField>
      </div>
      <DialogFooter className="border-t border-border px-6 py-4">
        <Button type="button" variant="outline" onClick={onDone} disabled={cancel.isPending}>
          Keep it
        </Button>
        <Button type="submit" variant="destructive" disabled={cancel.isPending}>
          {cancel.isPending ? "Cancelling..." : "Cancel follow-up"}
        </Button>
      </DialogFooter>
    </form>
  );
};

interface CancelFollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospectId: string;
  followUp: FollowUp | null | undefined;
}

const CancelFollowUpDialog = ({ open, onOpenChange, prospectId, followUp }: CancelFollowUpDialogProps) => (
  <Dialog open={open && Boolean(followUp)} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md p-0">
      {followUp && (
        <CancelForm
          key={followUp.id}
          prospectId={prospectId}
          followUp={followUp}
          onDone={() => onOpenChange(false)}
        />
      )}
    </DialogContent>
  </Dialog>
);

export default CancelFollowUpDialog;
