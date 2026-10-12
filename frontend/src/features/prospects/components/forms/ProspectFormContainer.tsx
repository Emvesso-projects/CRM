import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import FormField from "@/components/common/FormField";
import FormHeader from "@/components/common/FormHeader";
import StatusBadge from "@/components/common/StatusBadge";
import { PROSPECT_STAGE_LABELS } from "@/constants/labels";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import type { ProspectTimelineItem } from "@/contracts/types";
import { LeadProfilePhoto, getProfilePicUrl } from "@/features/leads";
import { withSuperAdminOrganizationScope } from "@/utils/orgRoutes";
import { Activity, Lock, Pencil, Plus, RefreshCw, Users } from "lucide-react";
import { prospectStageOptions } from "../../constants/options";
import {
  useUpdateProspectStage,
} from "../../hooks/useProspectMutations";
import { useProspectForm } from "../../hooks/useProspectForm";
import { ProspectFormSections } from "./ProspectFormSections";
import type { Prospect, ProspectStage } from "../../types";
import ActivityTimeline from "../activity/ActivityTimeline";
import LogActivityDialog, { type LogActivityMode } from "../activity/LogActivityDialog";
import NextStepCard from "../activity/NextStepCard";
import CancelFollowUpDialog from "../followup/CancelFollowUpDialog";
import RescheduleFollowUpDialog from "../followup/RescheduleFollowUpDialog";
import ScheduleFollowUpDialog from "../followup/ScheduleFollowUpDialog";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const textareaClassName =
  "w-full resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-sm shadow-sm outline-none transition-all hover:border-primary/50 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/20";

type StageValues = {
  stage: ProspectStage;
  comment: string;
};

type LogDialogState = {
  mode: LogActivityMode;
  activity?: ProspectTimelineItem;
};

// ─── Main Component ────────────────────────────────────────────────────────────

interface ProspectFormContainerProps {
  mode: "view" | "edit";
  prospect: Prospect;
  onCancel: () => void;
  hideHeader?: boolean;
}

const ProspectFormContainer = ({
  mode,
  prospect,
  onCancel,
  hideHeader = false,
}: ProspectFormContainerProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const scopedPath = (path: string) =>
    withSuperAdminOrganizationScope(path, location.pathname);

  const isView = mode === "view";
  const isEdit = mode === "edit";

  const {
    form,
    items,
    assignableUsers,
    isSubmitting,
    onSubmit: originalOnSubmit,
  } = useProspectForm({
    mode,
    prospect,
    onSuccess: () => {
      navigate(scopedPath(`/prospects/${prospect.id}`));
    },
  });

  const { mutateAsync: updateStage, isPending: isUpdatingStage } =
    useUpdateProspectStage();

  const activeFollowUp = prospect.isTerminal ? null : (prospect.activeFollowUp ?? null);

  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [logDialog, setLogDialog] = useState<LogDialogState | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editFollowUpOpen, setEditFollowUpOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelFollowUpOpen, setCancelFollowUpOpen] = useState(false);

  const stageForm = useForm<StageValues>({
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: { stage: prospect.stage, comment: "" },
  });

  const selectedStage = useWatch({ control: stageForm.control, name: "stage" });

  const handleEditClick = () => {
    if (!prospect) return;
    navigate(scopedPath(`/prospects/${prospect.id}?mode=edit`));
  };

  const onSubmit = (e: React.FormEvent) => {
    if (isView) {
      e.preventDefault();
      return;
    }
    originalOnSubmit(e);
  };

  const handleStageSubmit = stageForm.handleSubmit(async (values) => {
    if (values.stage === prospect.stage) return;
    if (values.comment.trim().length < 10) {
      stageForm.setError("comment", {
        type: "manual",
        message: "Comment must be at least 10 characters",
      });
      return;
    }
    await updateStage({
      id: prospect.id,
      data: { stage: values.stage, comment: values.comment.trim() },
    });
    setStageDialogOpen(false);
  });

  const leadFullName = [prospect.lead?.firstName, prospect.lead?.lastName]
    .filter(Boolean)
    .join(" ");
  const companyOrName =
    prospect.lead?.companyName || leadFullName || prospect.prospectNo;
  const headerTitle = isEdit
    ? `Edit Prospect: ${companyOrName}`
    : `Prospect Details: ${companyOrName}`;

  const leadProfilePic = (prospect.lead as { profilePicture?: string | null } | undefined)?.profilePicture ?? null;
  const resolvedProfilePic = getProfilePicUrl(leadProfilePic);

  return (
    <div className="flex w-full flex-col h-full min-h-0 overflow-hidden">
      {/* ── Page header ── */}
      {!hideHeader && (
        <div className="shrink-0 px-1">
          <FormHeader
            title={headerTitle}
            icon={Users}
            avatarSrc={resolvedProfilePic ?? undefined}
            onBack={onCancel}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  status={prospect.stage}
                  label={PROSPECT_STAGE_LABELS[prospect.stage]}
                />
                {/* Closed prospects still accept activities from before they closed. */}
                <Button
                  type="button"
                  onClick={() => setLogDialog({ mode: "log" })}
                  className="flex items-center gap-2 h-10 px-5 rounded-full bg-primary text-primary-foreground hover:bg-primary-hover font-bold shadow-sm transition-all"
                >
                  <Plus className="h-4 w-4" />
                  <span>Log Activity</span>
                </Button>
                {prospect.isEditable && isView && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStageDialogOpen(true)}
                      className="flex items-center gap-2 h-10 px-5 rounded-full border-border/50 font-bold shadow-sm transition-all"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span>Change Stage</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleEditClick}
                      className="flex items-center gap-2 h-10 px-6 rounded-full border-border/50 font-bold shadow-sm transition-all"
                    >
                      <Pencil className="h-4 w-4" />
                      <span>Edit Prospect</span>
                    </Button>
                  </>
                )}
              </div>
            }
          />
        </div>
      )}

      {/* ── Read-only banner ── */}
      {!prospect.isEditable ? (
        <div className="shrink-0 mx-1 mt-3 mb-1 flex items-center gap-2 rounded-xl border border-border/60 bg-muted/10 px-4 py-2.5 text-xs">
          <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="font-semibold text-foreground">
            {PROSPECT_STAGE_LABELS[prospect.stage]}:
          </span>
          <span className="text-muted-foreground">
            Details are read-only. You can still log activities from before it closed.
          </span>
        </div>
      ) : null}

      {/* ── Two-column layout with Independent Column Scrolling ── */}
      <div
        className={`flex-1 min-h-0 ${
          hideHeader ? "mt-0" : "mt-4"
        } pb-1 overflow-hidden flex flex-col`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0 h-full">
          {/* ── LEFT: Prospect Information Panel (7/12 width) ── */}
          <div className="lg:col-span-7 xl:col-span-7 h-full flex flex-col min-h-0 overflow-hidden">
            <Card className="border-border/60 bg-card p-4 sm:p-5 lg:p-6 shadow-sm flex flex-col flex-1 h-full min-h-0 overflow-y-auto">
              <form className="space-y-3" onSubmit={onSubmit}>
                <LeadProfilePhoto
                  watchProfilePic={leadProfilePic}
                  disabled={true}
                  title="Prospect Profile Photo"
                  description="Profile photo for this prospect."
                />

                <div className="mt-6 sm:mt-8">
                  <ProspectFormSections
                    form={form}
                    items={items}
                    assignableUsers={assignableUsers}
                    prospect={prospect}
                    mode={mode}
                  />
                </div>

                {isEdit && prospect.isEditable && (
                  <div className="mt-5 flex flex-col-reverse items-stretch gap-3 border-t border-border/30 pt-5 animate-in fade-in slide-in-from-bottom-2 duration-300 sm:flex-row sm:items-center sm:justify-end">
                    <Button
                      variant="outline"
                      type="button"
                      onClick={onCancel}
                      className="h-10 px-6 rounded-full font-bold shadow-sm"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="h-10 px-8 rounded-full font-bold bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm transform active:scale-95 transition-all"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                )}
              </form>
            </Card>
          </div>

          {/* ── RIGHT: Next step + timeline (5/12 width) ── */}
          <div className="lg:col-span-5 xl:col-span-5 h-full flex flex-col min-h-0 overflow-hidden">
            <Card className="border-border/60 bg-card p-4 sm:p-5 lg:p-6 shadow-sm flex flex-col flex-1 h-full min-h-0 overflow-y-auto">
              <div className="mb-4 flex items-center justify-between gap-2 shrink-0">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-primary" /> Activity
                </h4>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setLogDialog({ mode: "log" })}
                  className="h-7 rounded-full px-3 text-xs font-bold"
                >
                  <Plus className="mr-1 h-3 w-3" /> Log
                </Button>
              </div>

              {!prospect.isTerminal && (
                <div className="mb-5 shrink-0">
                  <NextStepCard
                    prospect={prospect}
                    onMarkDone={() => setLogDialog({ mode: "complete" })}
                    onReschedule={() => setRescheduleOpen(true)}
                    onEditDetails={() => setEditFollowUpOpen(true)}
                    onCancel={() => setCancelFollowUpOpen(true)}
                    onSchedule={() => setScheduleOpen(true)}
                  />
                </div>
              )}

              <div className="border-t border-border/40 pt-4">
                <ActivityTimeline
                  prospectId={prospect.id}
                  onEdit={(activity) => setLogDialog({ mode: "edit", activity })}
                />
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* ── Dialogs ── */}

      {logDialog && (
        <LogActivityDialog
          prospect={prospect}
          mode={logDialog.mode}
          activity={logDialog.activity}
          onClose={() => setLogDialog(null)}
        />
      )}

      <ScheduleFollowUpDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        prospectId={prospect.id}
        defaultAssigneeId={prospect.assignedToId}
      />

      {activeFollowUp && (
        <ScheduleFollowUpDialog
          key={`edit-${activeFollowUp.id}`}
          open={editFollowUpOpen}
          onOpenChange={setEditFollowUpOpen}
          prospectId={prospect.id}
          followUp={activeFollowUp}
        />
      )}

      <RescheduleFollowUpDialog
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        prospectId={prospect.id}
        followUp={activeFollowUp}
      />

      <CancelFollowUpDialog
        open={cancelFollowUpOpen}
        onOpenChange={setCancelFollowUpOpen}
        prospectId={prospect.id}
        followUp={activeFollowUp}
      />

      {/* Change Stage Dialog */}
      <Dialog open={stageDialogOpen} onOpenChange={setStageDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className="border-b border-border px-6 py-5">
            <DialogTitle>Change Stage</DialogTitle>
            <DialogDescription>
              Transition this prospect to {PROSPECT_STAGE_LABELS[selectedStage] || "a new stage"}.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4 px-6 py-5" onSubmit={handleStageSubmit}>
            <FormField label="New Stage" required>
              <Select
                name="stage"
                value={selectedStage}
                onValueChange={(val) =>
                  stageForm.setValue("stage", val as ProspectStage)
                }
                options={prospectStageOptions}
              />
            </FormField>

            {(selectedStage === "WON" || selectedStage === "LOST") && activeFollowUp && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                The scheduled follow-up will be cancelled, and the prospect becomes read-only.
              </p>
            )}

            <FormField
              label="Stage Transition Comment"
              required
              error={stageForm.formState.errors.comment?.message}
            >
              <textarea
                {...stageForm.register("comment", {
                  required: "Comment is required",
                  minLength: {
                    value: 10,
                    message: "Comment must be at least 10 characters",
                  },
                })}
                rows={3}
                className={textareaClassName}
                placeholder="Why is this prospect moving to this stage? (Min 10 characters)"
              />
            </FormField>

            <DialogFooter className="border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStageDialogOpen(false)}
                className="rounded-full font-bold px-6"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isUpdatingStage}
                className="rounded-full font-bold px-7 bg-primary text-primary-foreground hover:bg-primary-hover"
              >
                {isUpdatingStage ? "Updating..." : "Update Stage"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProspectFormContainer;
