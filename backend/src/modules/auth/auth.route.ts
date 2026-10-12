import { Router } from "express";
import { authController } from "./auth.controller";
import { validateData } from "../../middlewares/validationMiddleware";
import {
  LoginSchema,
  SignupSchema,
  UpdateProfileSchema,
  ChangePasswordSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  SignupVerifySchema,
} from "../../contracts/validation";
import { requireAuth } from "../../middlewares/auth.middleware";
import {
  authLimiter,
  passwordResetLimiter,
  passwordResetTokenLimiter,
  refreshLimiter,
  signupLimiter,
  signupVerifyLimiter,
} from "../../middlewares/rateLimiter";
import { uploadAuthProfileAssets } from "../../config/multerConfig";

const router = Router();

/*
 * Signup is two requests.
 *
 * The first proves the address and creates NOTHING — it stores a PendingSignup
 * row and mails a 6-digit code. The second consumes that code and creates the
 * organization. Splitting it this way is the whole reason no unverified account
 * can exist, which in turn is why there is no verification banner, no resend
 * endpoint and no middleware gating writes on a confirmed address.
 */
router.post(
  "/signup",
  signupLimiter,
  validateData(SignupSchema),
  authController.startSignup,
);
router.post(
  "/signup/verify",
  signupVerifyLimiter,
  validateData(SignupVerifySchema),
  authController.verifySignup,
);
router.post(
  "/login",
  authLimiter,
  validateData(LoginSchema),
  authController.login,
);
router.post("/refresh", refreshLimiter, authController.refresh);
router.post("/logout", authController.logout);
router.post(
  "/forgot-password/generate-otp",
  passwordResetLimiter,
  validateData(ForgotPasswordSchema),
  authController.generatePasswordResetOtp,
);
router.post(
  "/forgot-password/reset",
  passwordResetTokenLimiter,
  validateData(ResetPasswordSchema),
  authController.resetPasswordWithOtp,
);
router.get("/me", requireAuth, authController.getMe);
router.patch(
  "/profile",
  requireAuth,
  uploadAuthProfileAssets.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "companyLogo", maxCount: 1 },
    { name: "qrCode", maxCount: 1 },
    { name: "signature", maxCount: 1 },
  ]),
  validateData(UpdateProfileSchema),
  authController.updateProfile,
);
router.post(
  "/change-password",
  requireAuth,
  validateData(ChangePasswordSchema),
  authController.changePassword,
);

export default router;
