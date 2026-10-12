import { useState } from "react";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import ActivityTypeChips from "@/components/common/activity/ActivityTypeChips";
import OccurredAtField from "@/components/common/activity/OccurredAtField";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LeadActivity } from "@/contracts/types";
import type {
  CreateLeadActivityInput,
  UpdateLeadActivityInput,
} from "@/contracts/validation";
import {
  businessNow,
  occurredAtPresets,
  occurredAtProblem,
  samePartsAs,
  toApiInstant,
  toBusinessParts,
  type DateTimeParts,
} from "@/utils/businessTime";
import { newRequestId } from "@/utils/requestId";
import { useCreateLeadActivity, useUpdateLeadActivity } from "../../hooks/useLeadMutations";

type LeadActivityChoice = CreateLeadActivityInput["type"];

/** Types offered for new activities; legacy MEETING rows can still be edited. */
const NEW_ACTIVITY_TYPES = [
  "CALL",
  "IN_PERSON_MEETING",
  "VIRTUAL_MEETING",
  "EMAIL",
  "WHATSAPP",
  "TEXT",
  "SITE_VISIT",
  "NOTE",
] as const satisfies readonly LeadActivityChoice[];

const REMARK_MAX = 1000;

const headingClassName = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

interface LogLeadActivityDialogProps {
  leadId: string;
  leadName?: string;
  /** The activity to correct; a new one is logged when absent. */
  activity?: LeadActivity | null;
  onClose: () => void;
}

const LogLeadActivityDialog = ({
  leadId,
  leadName,
  activity = null,
  onClose,
}: LogLeadActivityDialogProps) => {
  const [initial] = useState(() => {
    const occurredAt = activity ? (activity.occurredAt ?? activity.createdAt) : null;
    return {
      type: (activity?.type ?? "CALL") as LeadActivityChoice,
      when: toBusinessParts(occurredAt ?? businessNow()),
      remark: activity?.remark ?? "",
      occurredAt,
    };
  });
  const [type, setType] = useState<LeadActivityChoice>(initial.type);
  const [when, setWhen] = useState<DateTimeParts>(initial.when);
  const [remark, setRemark] = useState(initial.remark);
  const [clientRequestId] = useState(newRequestId);
  const [submitted, setSubmitted] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const createActivity = useCreateLeadActivity();
  const updateActivity = useUpdateLeadActivity();
  const isSaving = createActivity.isPending || updateActivity.isPending;
  const isEdit = activity !== null;

  const typeOptions: readonly LeadActivityChoice[] = (
    NEW_ACTIVITY_TYPES as readonly string[]
  ).includes(initial.type)
    ? NEW_ACTIVITY_TYPES
    : [...NEW_ACTIVITY_TYPES, initial.type];

  const whenError = occurredAtProblem(when);
  const remarkError = remark.trim() ? null : "Add a few words about what happened";

  const isDirty =
    remark.trim() !== initial.remark.trim() ||
    type !== initial.type ||
    !samePartsAs(when, initial.when);

  const requestClose = () => {
    if (isSaving) return;
    if (isDirty) setConfirmDiscard(true);
    else onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    // An unchanged time is sent exactly as it was stored.
    const occurredAt =
      initial.occurredAt && samePartsAs(when, initial.when)
        ? initial.occurredAt
        : toApiInstant(when);
    if (whenError || remarkError || !occurredAt) return;

    try {
      if (activity) {
        const data: UpdateLeadActivityInput = {
          occurredAt,
          remark: remark.trim(),
          ...(type !== initial.type ? { type } : {}),
        };
        await updateActivity.mutateAsync({ leadId, activityId: activity.id, data });
      } else {
        await createActivity.mutateAsync({
          id: leadId,
          data: { type, remark: remark.trim(), occurredAt, clientRequestId },
        });
      }
      onClose();
    } catch {
      // The mutation shows the error; the form keeps what was entered.
    }
  };

  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) requestClose();
        }}
      >
        <DialogContent className="max-w-lg p-0">
          <form onSubmit={handleSubmit} noValidate>
            <DialogHeader className="border-b border-border px-6 py-5">
              <DialogTitle>{isEdit ? "Edit activity" : "Log activity"}</DialogTitle>
              <DialogDescription>
                {isEdit
                  ? `Correct what was recorded${leadName ? ` for ${leadName}` : ""}.`
                  : `Record what happened${leadName ? ` with ${leadName}` : ""}.`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 px-6 py-5">
              <section className="space-y-2">
                <h3 className={headingClassName}>
                  What happened? <span className="text-destructive">*</span>
                </h3>
                <ActivityTypeChips
                  value={type}
                  options={typeOptions}
                  onChange={setType}
                  disabled={isSaving}
                />
              </section>

              <section className="space-y-2">
                <div>
                  <h3 className={headingClassName}>
                    When did it happen? <span className="text-destructive">*</span>
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    The real time, even if you are logging it later.
                  </p>
                </div>
                <OccurredAtField
                  value={when}
                  onChange={setWhen}
                  presets={occurredAtPresets()}
                  error={submitted ? whenError : null}
                  disabled={isSaving}
                />
              </section>

              <section className="space-y-2">
                <h3 className={headingClassName}>
                  Notes <span className="text-destructive">*</span>
                </h3>
                <textarea
                  className="min-h-[100px] w-full resize-y rounded-xl border border-input bg-card px-3 py-2.5 text-sm shadow-xs outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:opacity-60"
                  placeholder="What happened? e.g. Called, discussed pricing, asked for the catalogue by email."
                  value={remark}
                  onChange={(event) => setRemark(event.target.value)}
                  maxLength={REMARK_MAX}
                  disabled={isSaving}
                />
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-medium text-destructive">
                    {submitted ? remarkError : null}
                  </span>
                  <span className="text-muted-foreground">
                    {remark.length}/{REMARK_MAX}
                  </span>
                </div>
              </section>
            </div>

            <DialogFooter className="border-t border-border px-6 py-4">
              <Button type="button" variant="outline" onClick={requestClose} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : isEdit ? "Save changes" : "Log activity"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard this activity?"
        description="What you entered hasn't been saved and will be lost."
        confirmText="Discard"
        cancelText="Keep editing"
        variant="destructive"
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
      />
    </>
  );
};

export default LogLeadActivityDialog;
