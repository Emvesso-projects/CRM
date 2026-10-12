import { Router } from "express";
import { prospectController } from "./prospect.controller";
import { allowPermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../constants/permissions";
import { requireAuth } from "../../middlewares/auth.middleware";
import { requireOrganization } from "../../middlewares/organization.middleware";
import { enforceSubscription } from "../../middlewares/subscription.middleware";
import { validateData } from "../../middlewares/validationMiddleware";
import {
  CancelFollowUpSchema,
  CompleteFollowUpSchema,
  ConvertLeadToProspectSchema as convertLeadToProspectSchema,
  EditFollowUpSchema,
  MarkMissedSchema,
  RescheduleFollowUpSchema,
  ScheduleFollowUpSchema,
  UpdateProspectSchema as updateProspectSchema,
  UpdateProspectStageSchema as updateProspectStageSchema,
} from "../../contracts/validation";
import { followUpController } from "../followUp/followUp.controller";
import prospectActivityRoutes from "../prospectActivity/prospectActivity.route";

const router = Router();

// BASE PATH: /api/prospects
router.use(requireAuth);
router.use(requireOrganization);
// Writes require a live subscription; reads are never blocked. Must come after
// requireAuth, which is what populates req.user.
router.use(enforceSubscription);

router.get(
  "/",
  allowPermission(PERMISSIONS.PROSPECT_READ),
  prospectController.getProspects
);
router.post(
  "/:id/follow-ups",
  allowPermission(PERMISSIONS.PROSPECT_UPDATE),
  validateData(ScheduleFollowUpSchema),
  followUpController.schedule,
);
router.get(
  "/:id/follow-ups",
  allowPermission(PERMISSIONS.PROSPECT_READ),
  followUpController.getHistory,
);
router.get(
  "/:id/follow-ups/active",
  allowPermission(PERMISSIONS.PROSPECT_READ),
  followUpController.getActive,
);
router.patch(
  "/:id/follow-ups/:fId/complete",
  allowPermission(PERMISSIONS.PROSPECT_UPDATE),
  validateData(CompleteFollowUpSchema),
  // DEPRECATED: the UI logs the activity with completeFollowUpId instead.
  followUpController.complete,
);
router.patch(
  "/:id/follow-ups/:fId/missed",
  allowPermission(PERMISSIONS.PROSPECT_UPDATE),
  validateData(MarkMissedSchema),
  // DEPRECATED: no UI; kept for external callers.
  followUpController.markMissed,
);
router.patch(
  "/:id/follow-ups/:fId/reschedule",
  allowPermission(PERMISSIONS.PROSPECT_UPDATE),
  validateData(RescheduleFollowUpSchema),
  followUpController.reschedule,
);
router.patch(
  "/:id/follow-ups/:fId/cancel",
  allowPermission(PERMISSIONS.PROSPECT_UPDATE),
  validateData(CancelFollowUpSchema),
  followUpController.cancel,
);
router.patch(
  "/:id/follow-ups/:fId",
  allowPermission(PERMISSIONS.PROSPECT_UPDATE),
  validateData(EditFollowUpSchema),
  followUpController.edit,
);
// Timeline, logging (optionally completing / scheduling follow-ups), edit, delete.
router.use("/:id/activities", prospectActivityRoutes);
router.get(
  "/customer-stats",
  allowPermission(PERMISSIONS.PROSPECT_READ),
  prospectController.getCustomerStats
);
router.get(
  "/:id",
  allowPermission(PERMISSIONS.PROSPECT_READ),
  prospectController.getProspectById
);
router.post(
  "/convert",
  allowPermission(PERMISSIONS.PROSPECT_CREATE),
  validateData(convertLeadToProspectSchema),
  // DEPRECATED: UI conversion now happens automatically via PATCH /leads/:id/status.
  // Kept for backward compatibility with external integrations.
  prospectController.convertLeadToProspect,
);
router.patch(
  "/:id",
  allowPermission(PERMISSIONS.PROSPECT_UPDATE),
  validateData(updateProspectSchema),
  prospectController.updateProspect,
);
router.patch(
  "/:id/stage",
  allowPermission(PERMISSIONS.PROSPECT_UPDATE),
  validateData(updateProspectStageSchema),
  prospectController.updateStage,
);
router.delete(
  "/:id",
  allowPermission(PERMISSIONS.PROSPECT_DELETE),
  prospectController.deleteProspect
);

export default router;
