import { useState } from "react";
import { useLeadForm } from "../../hooks/useLeadForm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UserCircle, Pencil, Plus } from "lucide-react";
import { LeadFormSections } from "./LeadFormSections";
import LeadProfilePhoto from "../shared/LeadProfilePhoto";
import FormHeader from "@/components/common/FormHeader";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import type { LeadActivity } from "@/contracts/types";
import type { Lead } from "../../types";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth";
import { ROLES } from "@/constants/roles";
import { withSuperAdminOrganizationScope } from "@/utils/orgRoutes";
import { useLeadActivities } from "../../hooks/useLeadActivities";
import { useDeleteLeadActivity } from "../../hooks/useLeadMutations";
import LeadActivityTimeline from "../activities/LeadActivityTimeline";
import LogLeadActivityDialog from "../dialogs/LogLeadActivityDialog";

interface LeadFormContainerProps {
  mode: "view" | "edit" | "create";
  lead?: Lead;
  onCancel: () => void;
  hideHeader?: boolean;
}

const LeadFormContainer = ({
  mode,
  lead,
  onCancel,
  hideHeader = false,
}: LeadFormContainerProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const scopedPath = (path: string) =>
    withSuperAdminOrganizationScope(path, location.pathname);

  const isView = mode === "view";
  const isEdit = mode === "edit";
  const isCreate = mode === "create";
  // null: closed · { activity: null }: log a new one · { activity }: edit it
  const [activityDialog, setActivityDialog] = useState<{ activity: LeadActivity | null } | null>(null);
  const [deletingActivity, setDeletingActivity] = useState<LeadActivity | null>(null);

  const { user: currentUser } = useAuth();
  const isAdmin =
    currentUser?.role === ROLES.ADMIN ||
    currentUser?.role === ROLES.SUPER_ADMIN;
  const isConverted = !!lead?.isConverted;
  const isDisabled = isView || (isConverted && !isAdmin);

  // The activities endpoint says which entries this user may still edit or delete.
  const { data: activities, isLoading: activitiesLoading } = useLeadActivities(lead?.id);
  const deleteActivity = useDeleteLeadActivity();

  const {
    form,
    items,
    assignableUsers,
    profilePicPreview,
    isExecutive,
    isSubmitting,
    handleImageChange,
    onSubmit: originalOnSubmit,
    isAdding,
  } = useLeadForm({ mode: isView ? "edit" : mode, lead });

  const handleEditClick = () => {
    if (!lead) return;
    navigate(scopedPath(`/leads/${lead.id}?mode=edit`));
  };

  const onSubmit = (e: React.FormEvent) => {
    if (isView) {
      e.preventDefault();
      return;
    }
    originalOnSubmit(e);
  };

  const handleConfirmDelete = async () => {
    if (!lead || !deletingActivity) return;
    try {
      await deleteActivity.mutateAsync({ leadId: lead.id, activityId: deletingActivity.id });
      setDeletingActivity(null);
    } catch {
      // handled in mutation hook
    }
  };

  const fullName = [lead?.firstName, lead?.lastName].filter(Boolean).join(" ");
  const headerTitle = isCreate
    ? "Add Lead"
    : isEdit
      ? `Edit Lead: ${fullName}`
      : `Lead Details: ${fullName}`;

  return (
    <div className="flex w-full flex-col h-full min-h-0 overflow-hidden">
      {!hideHeader && (
        <div className="shrink-0 px-1">
          <FormHeader
            title={headerTitle}
            icon={UserCircle}
            avatarSrc={profilePicPreview ?? undefined}
            onBack={onCancel}
            action={
              lead ? (
                <div className="flex items-center gap-2">
                  {!isConverted && (
                    <Button
                      type="button"
                      onClick={() => setActivityDialog({ activity: null })}
                      className="flex items-center gap-2 h-10 px-5 rounded-full bg-primary text-primary-foreground hover:bg-primary-hover font-bold shadow-sm transition-all"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Log Activity</span>
                    </Button>
                  )}
                  {isView && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleEditClick}
                      className="flex items-center gap-2 h-10 px-6 rounded-full border-border/50 font-bold shadow-sm transition-all"
                    >
                      <Pencil className="h-4 w-4" />
                      <span>Edit Lead</span>
                    </Button>
                  )}
                </div>
              ) : null
            }
          />
        </div>
      )}

      <div
        className={`flex-1 min-h-0 ${
          hideHeader ? "mt-0" : "mt-4"
        } pb-1 overflow-hidden flex flex-col`}
      >
        {lead ? (
          /* Two-column layout for Lead Details (View & Edit modes) with independent scrolling */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0 h-full">
            {/* Left Column: Lead Information */}
            <div className="lg:col-span-7 xl:col-span-7 h-full flex flex-col min-h-0 overflow-hidden">
              <Card className="border-border/60 bg-card p-4 sm:p-5 lg:p-6 shadow-sm flex flex-col flex-1 h-full min-h-0 overflow-y-auto">
                <form className="space-y-3" onSubmit={onSubmit}>
                  <LeadProfilePhoto
                    watchProfilePic={profilePicPreview}
                    onImageChange={handleImageChange}
                    disabled={isDisabled}
                  />

                  <div className="mt-6 sm:mt-8">
                    <LeadFormSections
                      form={form}
                      items={items}
                      assignableUsers={assignableUsers}
                      lead={lead}
                      isAdding={isAdding}
                      isExecutive={isExecutive}
                      mode={mode}
                    />
                  </div>

                  {!isDisabled && (
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

            {/* Right Column: Activity Timeline / Activity Logs */}
            <div className="lg:col-span-5 xl:col-span-5 h-full flex flex-col min-h-0 overflow-hidden">
              <Card className="border-border/60 bg-card p-4 sm:p-5 lg:p-6 shadow-sm flex flex-col flex-1 h-full min-h-0 overflow-y-auto">
                <LeadActivityTimeline
                  activities={activities ?? lead.activities}
                  isLoading={activitiesLoading}
                  onEdit={isConverted ? undefined : (activity) => setActivityDialog({ activity })}
                  onDelete={isConverted ? undefined : setDeletingActivity}
                />
              </Card>
            </div>
          </div>
        ) : (
          /* Full-width Card Layout for Create Lead mode */
          <div className="w-full h-full flex flex-col flex-1 min-h-0 overflow-hidden">
            <Card className="border-border/60 bg-card p-4 sm:p-5 lg:p-6 shadow-sm flex flex-col flex-1 h-full min-h-0 overflow-y-auto">
              <form className="space-y-3" onSubmit={onSubmit}>
                <LeadProfilePhoto
                  watchProfilePic={profilePicPreview}
                  onImageChange={handleImageChange}
                  disabled={isDisabled}
                />

                <div className="mt-6 sm:mt-8">
                  <LeadFormSections
                    form={form}
                    items={items}
                    assignableUsers={assignableUsers}
                    lead={lead}
                    isAdding={isAdding}
                    isExecutive={isExecutive}
                    mode={mode}
                  />
                </div>

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
                    {isSubmitting ? "Creating..." : "Create Lead"}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>

      {lead && activityDialog && (
        <LogLeadActivityDialog
          leadId={lead.id}
          leadName={fullName || lead.companyName || "Lead"}
          activity={activityDialog.activity}
          onClose={() => setActivityDialog(null)}
        />
      )}

      <ConfirmDialog
        open={deletingActivity !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingActivity(null);
        }}
        title="Delete this activity?"
        description="It will be removed from the timeline. The deletion is kept in the audit log."
        confirmText="Delete"
        variant="destructive"
        loading={deleteActivity.isPending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default LeadFormContainer;
