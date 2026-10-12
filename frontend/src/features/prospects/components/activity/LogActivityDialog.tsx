import { useState } from "react";
import { Info } from "lucide-react";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import ActivityTypeChips from "@/components/common/activity/ActivityTypeChips";
import ActivityTypeIcon from "@/components/common/activity/ActivityTypeIcon";
import ChoiceCard from "@/components/common/activity/ChoiceCard";
import FollowUpDueBadge from "@/components/common/activity/FollowUpDueBadge";
import OccurredAtField from "@/components/common/activity/OccurredAtField";
import OutcomeChips from "@/components/common/activity/OutcomeChips";
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
import { ROLES } from "@/constants/roles";
import { LOGGABLE_ACTIVITY_TYPE_VALUES } from "@/contracts/constants";
import type {
  FollowUpOutcome,
  LogProspectActivityResult,
  ProspectActivityType,
  ProspectTimelineItem,
} from "@/contracts/types";
import type {
  LogProspectActivityInput,
  UpdateProspectActivityInput,
} from "@/contracts/validation";
import { useAuth } from "@/features/auth";
import {
  businessNow,
  followUpDueState,
  followUpScheduleProblem,
  formatBusinessDateTime,
  formatBusinessTime,
  isEarlierToday,
  isPast,
  occurredAtPresets,
  occurredAtProblem,
  toApiInstant,
  toBusinessParts,
  type DateTimeParts,
  type TimePreset,
} from "@/utils/businessTime";
import { cn } from "@/utils/cn";
import { newRequestId } from "@/utils/requestId";
import { toast } from "@/utils/toast";
import {
  useLogProspectActivity,
  useUpdateProspectActivity,
} from "../../hooks/useProspectActivities";
import type { FollowUp, Prospect } from "../../types";
import FollowUpScheduleFields from "../followup/FollowUpScheduleFields";
import {
  emptyFollowUpDraft,
  toScheduleInput,
  type FollowUpDraft,
} from "../followup/followUpDraft";

export type LogActivityMode = "log" | "complete" | "edit";

type LoggableType = (typeof LOGGABLE_ACTIVITY_TYPE_VALUES)[number];
/** Legacy MEETING rows can still be edited, but new activities never use it. */
type TypeChoice = LoggableType | "MEETING";
type NextStep = "schedule" | "none" | null;

const REMARK_MAX = 1000;

const textareaClassName =
  "w-full resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-sm shadow-xs outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:opacity-60";

const isLoggable = (type: string): type is LoggableType =>
  (LOGGABLE_ACTIVITY_TYPE_VALUES as readonly string[]).includes(type);

const toTypeChoice = (type: ProspectActivityType): TypeChoice =>
  isLoggable(type) ? type : type === "MEETING" ? "MEETING" : "NOTE";

/** The interaction a follow-up of this type becomes when it is done. */
const typeForFollowUp = (followUp: FollowUp): LoggableType =>
  isLoggable(followUp.type) ? followUp.type : "IN_PERSON_MEETING";

const partsKey = (parts: DateTimeParts) => `${parts.date}T${parts.time}`;

type InitialState = {
  type: TypeChoice;
  when: DateTimeParts;
  outcome: FollowUpOutcome | null;
  remark: string;
  completes: boolean;
  /** Exact instants for times shown to the minute, so an unchanged time is sent as it was. */
  anchors: Record<string, string>;
};

const buildInitialState = ({
  mode,
  activity,
  pending,
  closedAt,
}: {
  mode: LogActivityMode;
  activity: ProspectTimelineItem | null;
  pending: FollowUp | null;
  closedAt: string | null;
}): InitialState => {
  const anchors: Record<string, string> = {};
  const anchor = (iso: string) => {
    const parts = toBusinessParts(iso);
    anchors[partsKey(parts)] = iso;
    return parts;
  };

  if (mode === "edit" && activity) {
    return {
      type: toTypeChoice(activity.type),
      when: anchor(activity.occurredAt),
      outcome: activity.outcome,
      remark: activity.remark ?? activity.summary,
      completes: false,
      anchors,
    };
  }

  if (pending) anchor(pending.dueAt);
  if (closedAt) anchor(closedAt);

  const dueState = pending ? followUpDueState(pending.dueAt) : null;
  // Nothing completes silently: completing is preselected only when asked to
  // (Mark done) or when the follow-up is due today or overdue, and it is shown.
  const completes = Boolean(pending) && (mode === "complete" || dueState !== "UPCOMING");

  let when: DateTimeParts;
  if (closedAt) {
    when = toBusinessParts(closedAt);
  } else if (pending && completes && isEarlierToday(pending.dueAt)) {
    // Due earlier today: most likely it happened at the planned time.
    when = toBusinessParts(pending.dueAt);
  } else {
    when = toBusinessParts(businessNow());
  }

  return {
    type: pending && completes ? typeForFollowUp(pending) : "CALL",
    when,
    outcome: null,
    remark: "",
    completes,
    anchors,
  };
};

const describeResult = (result: LogProspectActivityResult) => {
  if (result.duplicate) return "This activity was already saved";
  const parts = [`${activityTypeLabel(result.activity.type)} logged`];
  if (result.completedFollowUp) parts.push("follow-up completed");
  if (result.nextFollowUp) {
    parts.push(`next follow-up ${formatBusinessDateTime(result.nextFollowUp.dueAt)}`);
  }
  return parts.join(" · ");
};

const Section = ({
  label,
  hint,
  required,
  optional,
  error,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  optional?: boolean;
  error?: string | null;
  children: React.ReactNode;
}) => (
  <section className="space-y-2">
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
        {optional && <span className="ml-1 font-normal normal-case tracking-normal">(optional)</span>}
      </h3>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
    {children}
    {error && <p className="text-xs font-medium text-destructive">{error}</p>}
  </section>
);

interface LogActivityDialogProps {
  prospect: Prospect;
  /** log: header button · complete: "Mark done" on the follow-up · edit: correct an activity. */
  mode: LogActivityMode;
  activity?: ProspectTimelineItem | null;
  onClose: () => void;
}

/** One place to record what happened, finish the follow-up it fulfilled, and plan the next step. */
const LogActivityDialog = ({ prospect, mode, activity = null, onClose }: LogActivityDialogProps) => {
  const { user } = useAuth();
  const isEdit = mode === "edit" && activity !== null;
  const closedAt = prospect.isTerminal ? (prospect.closedAt ?? prospect.updatedAt) : null;

  // Captured when the dialog opens, so a refresh behind it can't change what saving does.
  const [pending] = useState<FollowUp | null>(() =>
    isEdit || closedAt ? null : (prospect.activeFollowUp ?? null),
  );
  const [initial] = useState(() =>
    buildInitialState({ mode: isEdit ? "edit" : mode, activity, pending, closedAt }),
  );
  const [type, setType] = useState<TypeChoice>(initial.type);
  const [when, setWhen] = useState<DateTimeParts>(initial.when);
  const [outcome, setOutcome] = useState<FollowUpOutcome | null>(initial.outcome);
  const [remark, setRemark] = useState(initial.remark);
  const [completes, setCompletes] = useState(initial.completes);
  const [nextStep, setNextStep] = useState<NextStep>(null);
  // The next follow-up goes to whoever had this one, else the prospect's owner,
  // else you (a super admin working inside an organization isn't a member of it).
  const [draft, setDraft] = useState<FollowUpDraft>(() =>
    emptyFollowUpDraft(
      pending?.assignedToId ||
        prospect.assignedToId ||
        (user && user.role !== ROLES.SUPER_ADMIN ? user.id : ""),
      pending?.type ?? "CALL",
    ),
  );
  const [clientRequestId] = useState(newRequestId);
  const [submitted, setSubmitted] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const logActivity = useLogProspectActivity();
  const updateActivity = useUpdateProspectActivity();
  const isSaving = logActivity.isPending || updateActivity.isPending;

  const completedFollowUp =
    isEdit && activity.followUp?.status === "COMPLETED" ? activity.followUp : null;
  const completing = pending !== null && completes;
  const outcomeRequired = completing || completedFollowUp !== null;
  const showNextStep = !isEdit && !closedAt && (pending === null || completing);
  const typeOptions: readonly TypeChoice[] =
    initial.type === "MEETING"
      ? [...LOGGABLE_ACTIVITY_TYPE_VALUES, "MEETING"]
      : LOGGABLE_ACTIVITY_TYPE_VALUES;

  const errors = {
    type:
      outcomeRequired && type === "NOTE"
        ? "An activity that completes a follow-up can't be a note. Choose what happened."
        : null,
    when: occurredAtProblem(when, {
      closedAt,
      notBefore: completing ? pending.createdAt : null,
    }),
    outcome:
      outcomeRequired && type !== "NOTE" && !outcome
        ? "Choose an outcome to complete the follow-up"
        : null,
    remark: remark.trim() ? null : "Add a few words about what happened",
    nextStep:
      showNextStep && nextStep === null ? "Choose whether to schedule a follow-up" : null,
    schedule: showNextStep && nextStep === "schedule" ? followUpScheduleProblem(draft) : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const visible = (message: string | null) => (submitted ? message : null);

  const whenPresets: TimePreset[] = closedAt
    ? [{ label: `When it closed (${formatBusinessDateTime(closedAt)})`, ...toBusinessParts(closedAt) }]
    : [
        ...occurredAtPresets(),
        ...(pending && completing && isPast(pending.dueAt)
          ? [
              {
                label: `At the scheduled time (${
                  isEarlierToday(pending.dueAt)
                    ? formatBusinessTime(pending.dueAt)
                    : formatBusinessDateTime(pending.dueAt)
                })`,
                ...toBusinessParts(pending.dueAt),
              },
            ]
          : []),
      ];

  const isDirty =
    remark.trim() !== initial.remark.trim() ||
    type !== initial.type ||
    outcome !== initial.outcome ||
    partsKey(when) !== partsKey(initial.when) ||
    nextStep !== null;

  const requestClose = () => {
    if (isSaving) return;
    if (isDirty) setConfirmDiscard(true);
    else onClose();
  };

  const handleTypeChange = (next: TypeChoice) => {
    setType(next);
    // A note can't complete a follow-up; say so in the follow-up section instead of failing on save.
    if (next === "NOTE" && pending && completes && !isEdit) setCompletes(false);
  };

  const handleOutcomeChange = (next: FollowUpOutcome | null) => {
    setOutcome(next);
    if (showNextStep && nextStep === null) {
      if (next === "NOT_INTERESTED") setNextStep("none");
      if (next === "RESCHEDULED") setNextStep("schedule");
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    const occurredAt = initial.anchors[partsKey(when)] ?? toApiInstant(when);
    if (hasErrors || !occurredAt) return;

    const noteOutcome = type === "NOTE" ? null : outcome;

    try {
      if (isEdit) {
        const data: UpdateProspectActivityInput = {
          occurredAt,
          remark: remark.trim(),
          outcome: noteOutcome,
          ...(type !== initial.type && isLoggable(type) ? { type } : {}),
        };
        await updateActivity.mutateAsync({
          prospectId: prospect.id,
          activityId: activity.id,
          data,
        });
        onClose();
        return;
      }

      const data: LogProspectActivityInput = {
        type: isLoggable(type) ? type : "IN_PERSON_MEETING",
        occurredAt,
        remark: remark.trim(),
        outcome: noteOutcome,
        completeFollowUpId: completing ? pending.id : null,
        nextFollowUp: showNextStep && nextStep === "schedule" ? toScheduleInput(draft) : null,
        clientRequestId,
      };
      const result = await logActivity.mutateAsync({ prospectId: prospect.id, data });
      toast.success(describeResult(result));
      onClose();
    } catch {
      // The mutation shows the error; the form keeps what was entered.
    }
  };

  const prospectName =
    prospect.lead?.companyName ||
    [prospect.lead?.firstName, prospect.lead?.lastName].filter(Boolean).join(" ") ||
    prospect.prospectNo;

  const title = isEdit
    ? "Edit activity"
    : mode === "complete" && pending
      ? "Mark follow-up done"
      : "Log activity";

  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) requestClose();
        }}
      >
        <DialogContent className="max-w-2xl p-0">
          <form onSubmit={handleSubmit} noValidate>
            <DialogHeader className="border-b border-border px-6 py-5">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                {isEdit
                  ? `Correct what was recorded for ${prospectName}.`
                  : `Record what happened with ${prospectName}.`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 px-6 py-5">
              {closedAt && (
                <div className="flex gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    This prospect was {prospect.stage === "WON" ? "won" : "lost"} on{" "}
                    {formatBusinessDateTime(closedAt)}. You can still log what happened before
                    then; follow-ups are closed.
                  </span>
                </div>
              )}

              <Section label="What happened?" required error={visible(errors.type)}>
                <ActivityTypeChips
                  value={type}
                  options={typeOptions}
                  onChange={handleTypeChange}
                  disabled={isSaving}
                />
              </Section>

              <Section
                label="When did it happen?"
                required
                hint="The real time, even if you are logging it later."
              >
                <OccurredAtField
                  value={when}
                  onChange={setWhen}
                  presets={whenPresets}
                  maxDate={closedAt ? toBusinessParts(closedAt).date : undefined}
                  error={visible(errors.when)}
                  disabled={isSaving}
                />
              </Section>

              {type !== "NOTE" && (
                <Section
                  label="Outcome"
                  required={outcomeRequired}
                  optional={!outcomeRequired}
                  error={visible(errors.outcome)}
                >
                  <OutcomeChips
                    value={outcome}
                    onChange={handleOutcomeChange}
                    required={outcomeRequired}
                    disabled={isSaving}
                  />
                  {outcome === "NOT_INTERESTED" && !closedAt && (
                    <p className="text-xs text-muted-foreground">
                      If the deal is off, move the prospect to Lost with Change Stage.
                    </p>
                  )}
                </Section>
              )}

              <Section label="Notes" required error={visible(errors.remark)}>
                <textarea
                  value={remark}
                  onChange={(event) => setRemark(event.target.value)}
                  rows={3}
                  maxLength={REMARK_MAX}
                  disabled={isSaving}
                  className={textareaClassName}
                  placeholder="What was discussed? What was agreed?"
                />
                <p className="text-right text-[11px] text-muted-foreground">
                  {remark.length}/{REMARK_MAX}
                </p>
              </Section>

              {pending && (
                <Section label="Scheduled follow-up">
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <ActivityTypeIcon type={pending.type} />
                      <span className="font-semibold text-foreground">
                        {activityTypeLabel(pending.type)}
                      </span>
                      <span className="text-muted-foreground">
                        · {formatBusinessDateTime(pending.dueAt)}
                      </span>
                      <FollowUpDueBadge dueAt={pending.dueAt} />
                    </div>
                    {pending.notes && (
                      <p className="mt-1.5 whitespace-pre-wrap text-xs text-muted-foreground">
                        {pending.notes}
                      </p>
                    )}
                    <div
                      role="radiogroup"
                      aria-label="Does this complete the follow-up?"
                      className="mt-3 grid gap-2 sm:grid-cols-2"
                    >
                      <ChoiceCard
                        selected={completes}
                        disabled={isSaving || type === "NOTE"}
                        onSelect={() => setCompletes(true)}
                        title="Yes, this completes it"
                        description={
                          type === "NOTE"
                            ? "A note can't complete a follow-up"
                            : "The follow-up is marked done"
                        }
                      />
                      <ChoiceCard
                        selected={!completes}
                        disabled={isSaving}
                        onSelect={() => setCompletes(false)}
                        title="No, keep it scheduled"
                        description="Log this on its own"
                      />
                    </div>
                  </div>
                </Section>
              )}

              {showNextStep && (
                <Section label="Next step" required error={visible(errors.nextStep)}>
                  <div
                    role="radiogroup"
                    aria-label="Next step"
                    className="grid gap-2 sm:grid-cols-2"
                  >
                    <ChoiceCard
                      selected={nextStep === "schedule"}
                      disabled={isSaving}
                      onSelect={() => setNextStep("schedule")}
                      title="Schedule a follow-up"
                      description="Plan the next touchpoint now"
                    />
                    <ChoiceCard
                      selected={nextStep === "none"}
                      disabled={isSaving}
                      onSelect={() => setNextStep("none")}
                      title="No follow-up for now"
                      description="You can schedule one later"
                    />
                  </div>
                  {nextStep === "schedule" && (
                    <div className="mt-3 rounded-xl border border-border/60 p-4">
                      <FollowUpScheduleFields
                        draft={draft}
                        onChange={setDraft}
                        scheduleError={visible(errors.schedule)}
                        disabled={isSaving}
                      />
                    </div>
                  )}
                </Section>
              )}
            </div>

            <DialogFooter className="items-center border-t border-border px-6 py-4">
              {submitted && hasErrors && (
                <p className={cn("text-xs font-medium text-destructive sm:mr-auto")}>
                  Check the highlighted fields.
                </p>
              )}
              <Button type="button" variant="outline" onClick={requestClose} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : isEdit ? "Save changes" : "Save"}
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

export default LogActivityDialog;
