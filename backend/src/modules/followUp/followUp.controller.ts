import type { Request, Response } from "express";
import { AppError } from "../../utils/errors/appError";
import { asyncHandler } from "../../utils/middleware/asyncHandler";
import { ApiResponse } from "../../utils/response/response";
import { prospectActivityService } from "../prospectActivity/prospectActivity.service";
import { followUpService } from "./followUp.service";

const ids = (req: Request) => {
  const { id, fId } = req.params;
  if (typeof id !== "string" || !id) throw AppError.validation.badRequest("Valid Prospect ID is required");
  if (fId !== undefined && (typeof fId !== "string" || !fId)) {
    throw AppError.validation.badRequest("Valid Follow-up ID is required");
  }
  return { prospectId: id, followUpId: fId };
};

export const followUpController = {
  schedule: asyncHandler(async (req: Request, res: Response) => {
    const { prospectId } = ids(req);
    const result = await followUpService.scheduleFollowUp(prospectId, req.body, req.user!, req.organizationId!);
    return ApiResponse.created(res, result, "Follow-up scheduled successfully");
  }),

  getHistory: asyncHandler(async (req: Request, res: Response) => {
    const { prospectId } = ids(req);
    const result = await followUpService.getFollowUpHistory(prospectId, req.user!, req.organizationId!);
    return ApiResponse.ok(res, result, "Follow-up history fetched successfully");
  }),

  getActive: asyncHandler(async (req: Request, res: Response) => {
    const { prospectId } = ids(req);
    const result = await followUpService.getActiveFollowUp(prospectId, req.user!, req.organizationId!);
    return ApiResponse.ok(res, result, "Active follow-up fetched successfully");
  }),

  /**
   * Deprecated: the UI completes a follow-up by logging the activity with
   * completeFollowUpId. Kept for external callers; it does the same thing.
   */
  complete: asyncHandler(async (req: Request, res: Response) => {
    const { prospectId, followUpId } = ids(req);
    const result = await prospectActivityService.completeFollowUp(
      prospectId,
      followUpId!,
      req.body,
      req.user!,
      req.organizationId!,
    );
    return ApiResponse.ok(res, result, "Follow-up completed successfully");
  }),

  markMissed: asyncHandler(async (req: Request, res: Response) => {
    const { prospectId, followUpId } = ids(req);
    const result = await followUpService.markMissed(prospectId, followUpId!, req.body, req.user!, req.organizationId!);
    return ApiResponse.ok(res, result, "Follow-up marked as missed");
  }),

  reschedule: asyncHandler(async (req: Request, res: Response) => {
    const { prospectId, followUpId } = ids(req);
    const result = await followUpService.rescheduleFollowUp(prospectId, followUpId!, req.body, req.user!, req.organizationId!);
    return ApiResponse.ok(res, result, "Follow-up rescheduled successfully");
  }),

  cancel: asyncHandler(async (req: Request, res: Response) => {
    const { prospectId, followUpId } = ids(req);
    const result = await followUpService.cancelFollowUp(prospectId, followUpId!, req.body ?? {}, req.user!, req.organizationId!);
    return ApiResponse.ok(res, result, "Follow-up cancelled successfully");
  }),

  edit: asyncHandler(async (req: Request, res: Response) => {
    const { prospectId, followUpId } = ids(req);
    const result = await followUpService.editFollowUp(prospectId, followUpId!, req.body, req.user!, req.organizationId!);
    return ApiResponse.ok(res, result, "Follow-up updated successfully");
  }),
};
