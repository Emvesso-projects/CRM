import type { Request, Response } from "express";
import { ProspectTimelineQuerySchema } from "../../contracts/validation";
import { recordAudit } from "../../utils/audit/recordAudit";
import { AppError } from "../../utils/errors/appError";
import { asyncHandler } from "../../utils/middleware/asyncHandler";
import { ApiResponse } from "../../utils/response/response";
import { prospectActivityService } from "./prospectActivity.service";

const params = (req: Request) => {
  const { id, activityId } = req.params;
  if (typeof id !== "string" || !id) {
    throw AppError.validation.badRequest("Valid Prospect ID is required");
  }
  if (activityId !== undefined && (typeof activityId !== "string" || !activityId)) {
    throw AppError.validation.badRequest("Valid Activity ID is required");
  }
  return { prospectId: id, activityId };
};

export const prospectActivityController = {
  timeline: asyncHandler(async (req: Request, res: Response) => {
    const { prospectId } = params(req);
    const query = ProspectTimelineQuerySchema.parse(req.query);
    const page = await prospectActivityService.timeline(
      prospectId,
      query,
      req.user!,
      req.organizationId!,
    );
    return ApiResponse.ok(res, page, "Timeline fetched successfully");
  }),

  log: asyncHandler(async (req: Request, res: Response) => {
    const { prospectId } = params(req);
    const result = await prospectActivityService.log(
      prospectId,
      req.body,
      req.user!,
      req.organizationId!,
    );
    return result.duplicate
      ? ApiResponse.ok(res, result, "Activity was already logged")
      : ApiResponse.created(res, result, "Activity logged successfully");
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const { prospectId, activityId } = params(req);
    const organizationId = req.organizationId!;
    const { item, before, after } = await prospectActivityService.update(
      prospectId,
      activityId!,
      req.body,
      req.user!,
      organizationId,
    );

    await recordAudit(req, {
      action: "PROSPECT_ACTIVITY_UPDATED",
      entityType: "PROSPECT",
      entityId: prospectId,
      organizationId,
      before,
      after,
    });

    return ApiResponse.ok(res, item, "Activity updated successfully");
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const { prospectId, activityId } = params(req);
    const organizationId = req.organizationId!;
    const before = await prospectActivityService.remove(
      prospectId,
      activityId!,
      req.user!,
      organizationId,
    );

    await recordAudit(req, {
      action: "PROSPECT_ACTIVITY_DELETED",
      entityType: "PROSPECT",
      entityId: prospectId,
      organizationId,
      before,
    });

    return ApiResponse.ok(res, null, "Activity deleted successfully");
  }),
};
