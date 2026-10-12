import { Router } from "express";
import { PERMISSIONS } from "../../constants/permissions";
import {
  LogProspectActivitySchema,
  UpdateProspectActivitySchema,
} from "../../contracts/validation";
import { allowPermission } from "../../middlewares/permission.middleware";
import { validateData } from "../../middlewares/validationMiddleware";
import { prospectActivityController } from "./prospectActivity.controller";

// Mounted by prospect.route.ts at /:id/activities, after authentication,
// organization scoping and subscription enforcement; :id is the prospect.
const router = Router({ mergeParams: true });

router.get(
  "/",
  allowPermission(PERMISSIONS.PROSPECT_READ),
  prospectActivityController.timeline,
);
router.post(
  "/",
  allowPermission(PERMISSIONS.PROSPECT_UPDATE),
  validateData(LogProspectActivitySchema),
  prospectActivityController.log,
);
router.patch(
  "/:activityId",
  allowPermission(PERMISSIONS.PROSPECT_UPDATE),
  validateData(UpdateProspectActivitySchema),
  prospectActivityController.update,
);
router.delete(
  "/:activityId",
  allowPermission(PERMISSIONS.PROSPECT_UPDATE),
  prospectActivityController.remove,
);

export default router;
