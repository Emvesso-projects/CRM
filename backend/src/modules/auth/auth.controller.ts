import crypto from "crypto";
import { Request, Response } from "express";
import { authService } from "./auth.service";
import { authRepository } from "./auth.repository";
import { ApiResponse } from "../../utils/response/response";
import { asyncHandler } from "../../utils/middleware/asyncHandler";
import { AppError } from "../../utils/errors/appError";
import { COOKIE_CONFIG } from "../../constants";
import { logger } from "../../config/logger";
import { 
  LoginSchema, 
  SignupSchema,
  UpdateProfileSchema, 
  ChangePasswordSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  SignupVerifySchema,
} from "../../contracts/validation";
import { mapUserToContract } from "./auth.service";
import { extractIp, getRefreshToken } from "../../utils/request";
import { recordAudit } from "../../utils/audit/recordAudit";
import { deleteStoredAsset, trackUploadedKey } from "../../utils/uploads/assetFiles";
import { storageService } from "../../config/storage/storage.service";
import { validateFileSignature } from "../../utils/uploads/fileSignature";

// private helpers
const setCookies = (
  res: Response,
  refreshToken: string,
) => {
  res.cookie("refresh_token", refreshToken, {
    httpOnly: COOKIE_CONFIG.HTTP_ONLY,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: COOKIE_CONFIG.REFRESH_TOKEN_MAX_AGE,
    path: "/api/v1/auth", // Restricted to auth routes only
  });
};

const clearCookies = (res: Response) => {
  res.clearCookie("refresh_token", {
    httpOnly: COOKIE_CONFIG.HTTP_ONLY,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/api/v1/auth",
  });
};

const ORGANIZATION_ASSET_FIELDS = [
  "companyLogo",
  "qrCode",
  "signature",
] as const;

type OrganizationAssetField = (typeof ORGANIZATION_ASSET_FIELDS)[number];

type AuthProfileUploadFiles = Partial<
  Record<"profileImage" | OrganizationAssetField, Express.Multer.File[]>
>;

const getUploadedProfileImage = async (
  req: Request,
  organizationId?: string,
) => {
  const files = req.files as AuthProfileUploadFiles | undefined;
  const file = files?.profileImage?.[0];
  if (!file) return undefined;

  const check = validateFileSignature(file.buffer, file.mimetype);
  if (!check.valid) {
    throw AppError.validation.badRequest(check.error || "Invalid profile image");
  }

  const uploadResult = await storageService.upload(
    file.buffer,
    file.originalname,
    {
      folder: "public/users",
      organizationId: organizationId || "users",
      filenamePrefix: "avatar",
      mimeType: file.mimetype,
      isPublic: true,
    },
  );

  trackUploadedKey(req, uploadResult.key);
  return uploadResult.publicUrl || uploadResult.key;
};

const getUploadedOrganizationAssets = async (
  req: Request,
  organizationId?: string,
) => {
  const files = req.files as AuthProfileUploadFiles | undefined;
  const assets: Partial<Record<OrganizationAssetField, string>> = {};
  if (!files) return assets;

  for (const fieldName of ORGANIZATION_ASSET_FIELDS) {
    const file = files[fieldName]?.[0];
    if (file) {
      const check = validateFileSignature(file.buffer, file.mimetype);
      if (!check.valid) {
        throw AppError.validation.badRequest(
          check.error || `Invalid file content for ${fieldName}`,
        );
      }

      const isPublic = true;
      const folder =
        fieldName === "companyLogo"
          ? "public/logos"
          : fieldName === "signature"
          ? "public/signatures"
          : "public/qr-codes";

      const uploadResult = await storageService.upload(
        file.buffer,
        file.originalname,
        {
          folder,
          organizationId: organizationId || "org",
          filenamePrefix: fieldName,
          mimeType: file.mimetype,
          isPublic,
        },
      );

      trackUploadedKey(req, uploadResult.key);
      assets[fieldName] = uploadResult.publicUrl || uploadResult.key;
    }
  }

  return assets;
};

export const authController = {
  /**
   * Signup step 1 — mail the code. No cookie, no tokens, no audit row: nothing
   * has happened yet that is worth recording against an organization that does
   * not exist. The service logs SIGNUP_CODE_SENT for operations.
   */
  startSignup: asyncHandler(async (req: Request, res: Response) => {
    const data = SignupSchema.parse(req.body);

    const result = await authService.startSignup(
      data,
      extractIp(req),
      req.get("user-agent"),
    );

    return ApiResponse.ok(res, { email: result.email }, result.message);
  }),

  /** Signup step 2 — the code is good, so the account now exists and is live. */
  verifySignup: asyncHandler(async (req: Request, res: Response) => {
    const data = SignupVerifySchema.parse(req.body);

    const ip = extractIp(req);
    const userAgent = req.get("user-agent");

    const { user, accessToken, refreshToken } = await authService.verifySignup(
      data,
      ip,
      userAgent,
    );
    setCookies(res, refreshToken);

    const emailHash = crypto
      .createHash("sha256")
      .update(user.email.toLowerCase().trim())
      .digest("hex")
      .slice(0, 12);

    logger.info("SIGNUP_SUCCESS", {
      event: "SIGNUP_SUCCESS",
      userId: user.id,
      emailHash,
      role: user.role,
      organizationId: user.organizationId,
      organizationName: user.organization?.name ?? null,
      ip,
      userAgent,
    });

    await recordAudit(req, {
      action: "SELF_SERVICE_SIGNUP",
      entityType: "AUTH",
      entityId: user.id,
      actor: { id: user.id, email: user.email, role: user.role },
      organizationId: user.organizationId ?? null,
      after: {
        userId: user.id,
        organizationId: user.organizationId ?? null,
        organizationName: user.organization?.name ?? null,
        organizationSlug: user.organization?.slug ?? null,
        organizationType: user.organization?.orgType ?? null,
        role: user.role,
      },
    });

    return ApiResponse.created(res, { user, accessToken }, "Signup successful");
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const data = LoginSchema.parse(req.body);
    
    const ip = extractIp(req);
    const userAgent = req.get("user-agent");
 
    let result: Awaited<ReturnType<typeof authService.login>>;
    try {
      result = await authService.login(data, ip, userAgent);
    } catch (error) {
      // Record the attempt, then rethrow so the original error still reaches the
      // client unchanged. Only the attempted email is captured — never the
      // submitted password, and never the parsed login body.
      //
      // When the email belongs to a real user, stamp the row with their org so
      // that org's admin can see the failed attempt (a null-org row is
      // super-admin-only). When it does not, leave everything null — surfacing
      // "this email exists" to an org admin would leak account existence.
      const knownUser = await authRepository
        .findUserByEmail(data.email.toLowerCase().trim())
        .catch(() => null);

      await recordAudit(req, {
        action: "LOGIN_FAILED",
        entityType: "AUTH",
        entityId: knownUser?.id ?? undefined,
        actor: knownUser
          ? { id: null, email: data.email, role: knownUser.role }
          : { id: null, email: data.email, role: "UNKNOWN" },
        organizationId: knownUser?.organizationId ?? null,
        after: {
          reason: error instanceof Error ? error.message : "Unknown error",
        },
      });
      throw error;
    }

    const { user, accessToken, refreshToken } = result;
    setCookies(res, refreshToken);

    logger.info("User logged in successfully", {
      userId: user.id,
      email: user.email,
      role: user.role,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });

    await recordAudit(req, {
      action: "LOGIN_SUCCEEDED",
      entityType: "AUTH",
      entityId: user.id,
      actor: { id: user.id, email: user.email, role: user.role },
      organizationId: user.organizationId ?? null,
    });

    return ApiResponse.ok(res, { user, accessToken }, "Login successful");
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const incomingRefreshToken = getRefreshToken(req);
    if (!incomingRefreshToken) {
      logger.warn("Token refresh attempt without refresh token", {
        ip: extractIp(req),
      });
      throw AppError.authentication.tokenInvalid("No refresh token provided");
    }

    const ip = extractIp(req);
    const userAgent = req.get("user-agent");
 
    const { accessToken, refreshToken } = await authService.refresh(
      incomingRefreshToken,
      ip,
      userAgent,
    );
    setCookies(res, refreshToken);
    
    logger.debug("Token refreshed successfully", {
      ip: req.ip,
    });
    
    return ApiResponse.ok(res, { accessToken }, "Token refreshed successfully");
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    const incomingRefreshToken = getRefreshToken(req);
    await authService.logout(incomingRefreshToken);
    clearCookies(res);
    
    logger.info("User logged out", {
      ip: req.ip,
    });
    
    return ApiResponse.ok(res, null, "Logout successful");
  }),

  generatePasswordResetOtp: asyncHandler(async (req: Request, res: Response) => {
    const data = ForgotPasswordSchema.parse(req.body);
    const ip = extractIp(req);
    const userAgent = req.get("user-agent");

    try {
      const result = await authService.generatePasswordResetOtp(
        data,
        ip,
        userAgent,
      );

      await recordAudit(req, {
        action: "PASSWORD_RESET_REQUESTED",
        entityType: "AUTH",
        entityId: result.userId,
        actor: {
          id: result.userId ?? null,
          email: result.email,
          role: result.role ?? "UNKNOWN",
        },
        organizationId: result.organizationId ?? null,
        after: {
          emailSent: result.emailSent,
        },
      });

      if (result.emailSent) {
        await recordAudit(req, {
          action: "PASSWORD_RESET_EMAIL_SENT",
          entityType: "AUTH",
          entityId: result.userId,
          actor: {
            id: result.userId ?? null,
            email: result.email,
            role: result.role ?? "UNKNOWN",
          },
          organizationId: result.organizationId ?? null,
        });
      }

      return ApiResponse.ok(res, { message: result.message }, result.message);
    } catch (error) {
      await recordAudit(req, {
        action: "PASSWORD_RESET_FAILED",
        entityType: "AUTH",
        actor: {
          id: null,
          email: data.email.toLowerCase().trim(),
          role: "UNKNOWN",
        },
        organizationId: null,
        after: {
          reason: error instanceof Error ? error.message : "Unknown error",
        },
      });
      throw error;
    }
  }),

  resetPasswordWithOtp: asyncHandler(async (req: Request, res: Response) => {
    const data = ResetPasswordSchema.parse(req.body);
    const ip = extractIp(req);
    const userAgent = req.get("user-agent");

    try {
      const result = await authService.resetPasswordWithOtp(data, ip, userAgent);
      clearCookies(res);

      await recordAudit(req, {
        action: "PASSWORD_RESET_SUCCEEDED",
        entityType: "USER",
        entityId: result.userId,
        actor: {
          id: result.userId,
          email: result.email,
          role: result.role,
        },
        organizationId: result.organizationId ?? null,
        after: {
          sessionsInvalidated: true,
        },
      });

      return ApiResponse.ok(
        res,
        { message: "Password reset successfully." },
        "Password reset successfully.",
      );
    } catch (error) {
      await recordAudit(req, {
        action: "PASSWORD_RESET_FAILED",
        entityType: "AUTH",
        actor: {
          id: null,
          email: data.email.toLowerCase().trim(),
          role: "UNKNOWN",
        },
        organizationId: null,
        after: {
          reason: error instanceof Error ? error.message : "Unknown error",
        },
      });
      throw error;
    }
  }),

  getMe: asyncHandler(async (req: Request, res: Response) => {
    // `req.user` should be populated by `requireAuth` middleware
    if (!req.user) {
      return ApiResponse.ok(res, { user: null }, "No user logged in");
    }
    return ApiResponse.ok(res, { user: mapUserToContract(req.user) }, "User fetched successfully");
  }),

  updateProfile: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.authentication.required();
    const data = UpdateProfileSchema.parse(req.body);
    const profileImage = await getUploadedProfileImage(
      req,
      req.user.organizationId ?? undefined,
    );
    const uploadedAssets = await getUploadedOrganizationAssets(
      req,
      req.user.organizationId ?? undefined,
    );
    const updatedUser = await authService.updateProfile(
      req.user.id,
      profileImage ? { ...data, profileImage } : data,
      uploadedAssets,
    );

    /**
     * Record WHICH fields the user touched, never their values — a profile edit
     * can carry personal data we do not want copied into the trail.
     *
     * Uploads are named too. They arrive on req.files rather than in the parsed
     * body, so a request that only replaced an image used to audit as
     * `fields: []` — an organization signature could be swapped with nothing in
     * the trail to show it. File names and paths stay out; only the field.
     */
    const touchedFields = [
      ...Object.keys(data),
      ...(profileImage ? ["profileImage"] : []),
      ...Object.keys(uploadedAssets),
    ];

    await recordAudit(req, {
      action: "USER_PROFILE_UPDATED",
      entityType: "USER",
      entityId: req.user.id,
      organizationId: req.user.organizationId ?? null,
      after: { fields: touchedFields },
    });

    return ApiResponse.ok(res, { user: updatedUser }, "Profile updated successfully");
  }),

  changePassword: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.authentication.required();
    const data = ChangePasswordSchema.parse(req.body);
    await authService.changePassword(req.user.id, data);
    clearCookies(res);

    logger.info("User changed password", {
      userId: req.user.id,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });

    // The password itself is never in the payload we record — only the fact.
    await recordAudit(req, {
      action: "USER_PASSWORD_CHANGED",
      entityType: "USER",
      entityId: req.user.id,
      organizationId: req.user.organizationId ?? null,
    });

    return ApiResponse.ok(res, null, "Password changed successfully. Please login again");
  }),
};
