import { Link, useNavigate } from "react-router-dom";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  RefreshCw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import FormField from "@/components/common/FormField";
import TooltipLabel from "@/components/common/TooltipLabel";
import {
  ForgotPasswordSchema,
  ResetPasswordSchema,
  type ForgotPasswordInput,
  type ResetPasswordInput,
} from "@/contracts/validation";
import { authService } from "../../api/services";
import { extractApiError } from "@/utils/apiError";
import AuthLayout from "../layout/AuthLayout";

const RESEND_COOLDOWN_SECONDS = 60;

type ResetStep = "EMAIL" | "RESET" | "SUCCESS";

const ForgotPasswordForm = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<ResetStep>("EMAIL");
  const [currentEmail, setCurrentEmail] = useState("");
  const [emailSubmitError, setEmailSubmitError] = useState("");
  const [resetSubmitError, setResetSubmitError] = useState("");
  const [resendStatusMessage, setResendStatusMessage] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const otpInputRef = useRef<HTMLInputElement | null>(null);

  // Form for Step 1: Email
  const {
    handleSubmit: handleEmailSubmit,
    control: emailControl,
    formState: { errors: emailErrors },
    setError: setEmailError,
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(ForgotPasswordSchema),
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: { email: "" },
  });

  // Form for Step 2: OTP + New Password
  const {
    handleSubmit: handleResetSubmit,
    control: resetControl,
    watch: watchReset,
    setValue: setResetValue,
    formState: { errors: resetErrors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(ResetPasswordSchema),
    mode: "onChange",
    defaultValues: {
      email: "",
      otp: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const watchedNewPassword = watchReset("newPassword") || "";
  const watchedConfirmPassword = watchReset("confirmPassword") || "";

  // Password criteria indicators
  const passwordChecks = {
    length: watchedNewPassword.length >= 8,
    lower: /[a-z]/.test(watchedNewPassword),
    upper: /[A-Z]/.test(watchedNewPassword),
    number: /\d/.test(watchedNewPassword),
    special: /[^A-Za-z\d\s]/.test(watchedNewPassword),
    noSpace: !/\s/.test(watchedNewPassword) && watchedNewPassword.length > 0,
  };

  const isPasswordMatching =
    watchedConfirmPassword.length > 0 &&
    watchedNewPassword === watchedConfirmPassword;
  const isPasswordMismatched =
    watchedConfirmPassword.length > 0 &&
    watchedNewPassword !== watchedConfirmPassword;

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Step 1: Request OTP
  const onSendOtp = async (data: ForgotPasswordInput) => {
    setEmailSubmitError("");
    setIsSendingOtp(true);

    try {
      const normalizedEmail = data.email.trim().toLowerCase();
      await authService.generatePasswordResetOtp({ email: normalizedEmail });
      setCurrentEmail(normalizedEmail);
      setResetValue("email", normalizedEmail);
      setStep("RESET");
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setResendStatusMessage(
        `A 6-digit verification code has been sent to ${normalizedEmail}`,
      );
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 150);
    } catch (error) {
      const parsed = extractApiError(error);
      const message =
        parsed.message || "Failed to send reset code. Please try again.";
      setEmailSubmitError(message);
      if (parsed.status === 404) {
        setEmailError("email", {
          type: "manual",
          message,
        });
      }
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Step 2: Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isSendingOtp || !currentEmail) return;

    setIsSendingOtp(true);
    setResetSubmitError("");
    setResendStatusMessage("");

    try {
      await authService.generatePasswordResetOtp({ email: currentEmail });
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setResendStatusMessage(
        `A new 6-digit code has been dispatched to ${currentEmail}`,
      );
    } catch (error) {
      const parsed = extractApiError(error);
      setResetSubmitError(
        parsed.message || "Failed to resend code. Please try again later.",
      );
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Step 2: Reset Password
  const onResetPassword = async (data: ResetPasswordInput) => {
    setResetSubmitError("");
    setIsResetting(true);

    try {
      await authService.resetPasswordWithOtp({
        ...data,
        email: currentEmail,
      });
      setStep("SUCCESS");
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 2500);
    } catch (error) {
      const parsed = extractApiError(error);
      setResetSubmitError(
        parsed.message ||
          "Password reset failed. Please check your OTP and try again.",
      );
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <AuthLayout>

            {/* ======================================================= */}
            {/* STEP 1: REQUEST OTP (EMAIL FORM)                        */}
            {/* ======================================================= */}
            {step === "EMAIL" && (
              <form onSubmit={handleEmailSubmit(onSendOtp)}>
                <div className="mb-6 space-y-2 text-center lg:mb-7">
                  <h2 className="text-[30px] font-bold leading-none text-[#050509] sm:text-[34px]">
                    Forgot Password?
                  </h2>
                  <p className="text-[13px] font-medium leading-relaxed text-[#6f7788]">
                    Enter your registered email to receive a verification code
                  </p>
                </div>

                <div className="space-y-3 lg:space-y-4">
                  <FormField
                    id="email"
                    label="Work Email Address"
                    error={emailErrors.email?.message}
                    className="gap-2 [&_label]:text-[13px] [&_label]:font-semibold [&_label]:text-[#050509]"
                  >
                    <Controller
                      name="email"
                      control={emailControl}
                      render={({ field }) => (
                        <div className="relative">
                          <Mail className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa3b6]" />
                          <Input
                            {...field}
                            id="email"
                            type="email"
                            placeholder="Enter Email Address"
                            autoComplete="email"
                            autoFocus
                            aria-invalid={emailErrors.email ? true : undefined}
                            className="h-11 rounded-[8px] border-[#c8d0e2] bg-white pl-4 pr-11 text-sm font-medium text-[#111827] shadow-none placeholder:text-[13px] placeholder:font-normal placeholder:text-[#a0a7b8] hover:border-[#b9c3d9] focus-visible:border-primary focus-visible:ring-primary/15"
                          />
                        </div>
                      )}
                    />
                  </FormField>

                  {emailSubmitError && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm leading-relaxed text-destructive min-w-0 break-words"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 break-words">
                        {emailSubmitError}
                      </span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isSendingOtp}
                    className="mt-3 h-12 w-full rounded-[8px] bg-primary text-sm font-bold text-primary-foreground shadow-none transition-colors hover:bg-primary-hover"
                  >
                    {isSendingOtp ? (
                      <span className="flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Sending verification code...
                      </span>
                    ) : (
                      "Send Verification Code"
                    )}
                  </Button>

                  <p className="pt-0.5 text-center text-[13px] font-medium text-[#8b94a7]">
                    Remember your password?{" "}
                    <Link
                      to="/"
                      className="text-primary-hover font-semibold hover:underline"
                    >
                      Back to Login
                    </Link>
                  </p>
                </div>
              </form>
            )}

            {/* ======================================================= */}
            {/* STEP 2: VERIFY OTP & SET NEW PASSWORD                   */}
            {/* ======================================================= */}
            {step === "RESET" && (
              <form onSubmit={handleResetSubmit(onResetPassword)}>
                <div className="mb-4 space-y-1.5 text-center lg:mb-5">
                  <h2 className="text-[26px] font-bold leading-none text-[#050509] sm:text-[30px]">
                    Create New Password
                  </h2>
                  <p className="text-[13px] font-medium leading-relaxed text-[#6f7788]">
                    Verify the code sent to your email to reset your password
                  </p>
                </div>

                {/* Email Context Banner */}
                <div className="mb-3 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-[#1e293b]">
                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate font-medium">
                      Code sent to:{" "}
                      <strong className="text-primary">{currentEmail}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("EMAIL");
                      setResetSubmitError("");
                      setResendStatusMessage("");
                    }}
                    className="ml-2 shrink-0 text-xs font-bold text-primary underline transition-colors hover:text-primary-hover"
                  >
                    Change
                  </button>
                </div>

                {/* Feedback banner */}
                {resendStatusMessage && (
                  <div
                    role="status"
                    className="mb-3 flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-800"
                  >
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <span className="min-w-0 flex-1">{resendStatusMessage}</span>
                  </div>
                )}

                <div className="space-y-2.5 sm:space-y-3">
                  {/* OTP Field */}
                  <FormField
                    id="otp"
                    label="6-Digit Verification Code"
                    error={resetErrors.otp?.message}
                    className="gap-1.5 [&_label]:text-[13px] [&_label]:font-semibold [&_label]:text-[#050509]"
                  >
                    <div className="flex gap-2">
                      <div className="relative min-w-0 flex-1">
                        <KeyRound className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa3b6]" />
                        <Controller
                          name="otp"
                          control={resetControl}
                          render={({ field }) => (
                            <Input
                              {...field}
                              ref={otpInputRef}
                              id="otp"
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={6}
                              placeholder="Enter 6 digits"
                              autoComplete="one-time-code"
                              aria-invalid={resetErrors.otp ? true : undefined}
                              className="h-11 rounded-[8px] border-[#c8d0e2] bg-white pl-4 pr-11 text-center font-mono text-base font-bold tracking-widest text-[#111827] shadow-none placeholder:font-sans placeholder:text-[13px] placeholder:font-normal placeholder:tracking-normal placeholder:text-[#a0a7b8] hover:border-[#b9c3d9] focus-visible:border-primary focus-visible:ring-primary/15"
                              onChange={(e) => {
                                const cleanDigits = e.target.value
                                  .replace(/\D/g, "")
                                  .slice(0, 6);
                                field.onChange(cleanDigits);
                              }}
                            />
                          )}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={
                          resendCooldown > 0 || isSendingOtp || isResetting
                        }
                        onClick={handleResendOtp}
                        className="h-11 shrink-0 rounded-[8px] border-[#c8d0e2] bg-white px-3 text-xs font-bold text-primary transition-all hover:bg-primary/5 hover:text-primary-hover"
                      >
                        {isSendingOtp ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : resendCooldown > 0 ? (
                          `Resend in ${resendCooldown}s`
                        ) : (
                          "Resend Code"
                        )}
                      </Button>
                    </div>
                  </FormField>

                  {/* New Password */}
                  <FormField
                    id="newPassword"
                    label="New Password"
                    error={resetErrors.newPassword?.message}
                    className="gap-1.5 [&_label]:text-[13px] [&_label]:font-semibold [&_label]:text-[#050509]"
                  >
                    <div className="relative">
                      <Controller
                        name="newPassword"
                        control={resetControl}
                        render={({ field }) => (
                          <Input
                            {...field}
                            id="newPassword"
                            type={showPassword ? "text" : "password"}
                            placeholder="Create new password"
                            autoComplete="new-password"
                            aria-invalid={
                              resetErrors.newPassword ? true : undefined
                            }
                            className="h-11 rounded-[8px] border-[#c8d0e2] bg-white pl-4 pr-12 text-sm font-medium text-[#111827] shadow-none placeholder:text-[13px] placeholder:font-normal placeholder:text-[#a0a7b8] hover:border-[#b9c3d9] focus-visible:border-primary focus-visible:ring-primary/15"
                          />
                        )}
                      />
                      <TooltipLabel
                        label={showPassword ? "Hide password" : "Show password"}
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-md text-[#9aa3b6] hover:bg-transparent hover:text-[#111827]"
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipLabel>
                    </div>

                    {/* Compact real-time password criteria checklist */}
                    {watchedNewPassword.length > 0 && (
                      <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-md border border-slate-200 bg-slate-50/80 p-2 text-[11px] text-[#475569]">
                        <div
                          className={`flex items-center gap-1 ${
                            passwordChecks.length
                              ? "font-semibold text-emerald-600"
                              : "text-slate-500"
                          }`}
                        >
                          {passwordChecks.length ? (
                            <Check className="h-3 w-3 stroke-[3]" />
                          ) : (
                            <span className="ml-1 mr-0.5 inline-block h-1.5 w-1.5 rounded-full bg-slate-300" />
                          )}
                          8+ characters
                        </div>
                        <div
                          className={`flex items-center gap-1 ${
                            passwordChecks.upper && passwordChecks.lower
                              ? "font-semibold text-emerald-600"
                              : "text-slate-500"
                          }`}
                        >
                          {passwordChecks.upper && passwordChecks.lower ? (
                            <Check className="h-3 w-3 stroke-[3]" />
                          ) : (
                            <span className="ml-1 mr-0.5 inline-block h-1.5 w-1.5 rounded-full bg-slate-300" />
                          )}
                          Upper & lower case
                        </div>
                        <div
                          className={`flex items-center gap-1 ${
                            passwordChecks.number
                              ? "font-semibold text-emerald-600"
                              : "text-slate-500"
                          }`}
                        >
                          {passwordChecks.number ? (
                            <Check className="h-3 w-3 stroke-[3]" />
                          ) : (
                            <span className="ml-1 mr-0.5 inline-block h-1.5 w-1.5 rounded-full bg-slate-300" />
                          )}
                          At least 1 number
                        </div>
                        <div
                          className={`flex items-center gap-1 ${
                            passwordChecks.special && passwordChecks.noSpace
                              ? "font-semibold text-emerald-600"
                              : "text-slate-500"
                          }`}
                        >
                          {passwordChecks.special && passwordChecks.noSpace ? (
                            <Check className="h-3 w-3 stroke-[3]" />
                          ) : (
                            <span className="ml-1 mr-0.5 inline-block h-1.5 w-1.5 rounded-full bg-slate-300" />
                          )}
                          Special symbol, no spaces
                        </div>
                      </div>
                    )}
                  </FormField>

                  {/* Confirm Password */}
                  <FormField
                    id="confirmPassword"
                    label="Confirm New Password"
                    error={resetErrors.confirmPassword?.message}
                    className="gap-1.5 [&_label]:text-[13px] [&_label]:font-semibold [&_label]:text-[#050509]"
                  >
                    <div className="relative">
                      <Controller
                        name="confirmPassword"
                        control={resetControl}
                        render={({ field }) => (
                          <Input
                            {...field}
                            id="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Re-enter new password"
                            autoComplete="new-password"
                            aria-invalid={
                              resetErrors.confirmPassword ? true : undefined
                            }
                            className="h-11 rounded-[8px] border-[#c8d0e2] bg-white pl-4 pr-12 text-sm font-medium text-[#111827] shadow-none placeholder:text-[13px] placeholder:font-normal placeholder:text-[#a0a7b8] hover:border-[#b9c3d9] focus-visible:border-primary focus-visible:ring-primary/15"
                          />
                        )}
                      />
                      <TooltipLabel
                        label={
                          showConfirmPassword
                            ? "Hide password"
                            : "Show password"
                        }
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                          className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-md text-[#9aa3b6] hover:bg-transparent hover:text-[#111827]"
                          aria-label={
                            showConfirmPassword
                              ? "Hide password"
                              : "Show password"
                          }
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipLabel>
                    </div>

                    {isPasswordMatching && (
                      <div className="flex items-center gap-1 pt-1 text-[11px] font-semibold text-emerald-600">
                        <Check className="h-3 w-3 stroke-[3]" />
                        Passwords match
                      </div>
                    )}
                    {isPasswordMismatched && (
                      <div className="flex items-center gap-1 pt-1 text-[11px] font-medium text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        Passwords do not match
                      </div>
                    )}
                  </FormField>

                  {/* Error Banner */}
                  {resetSubmitError && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm leading-relaxed text-destructive min-w-0 break-words"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 break-words">
                        {resetSubmitError}
                      </span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={isResetting || isSendingOtp}
                    className="mt-2 h-12 w-full rounded-[8px] bg-primary text-sm font-bold text-primary-foreground shadow-none transition-colors hover:bg-primary-hover"
                  >
                    {isResetting ? (
                      <span className="flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Updating password...
                      </span>
                    ) : (
                      "Reset Password"
                    )}
                  </Button>

                  <p className="pt-0.5 text-center text-[13px] font-medium text-[#8b94a7]">
                    Remember your password?{" "}
                    <Link
                      to="/"
                      className="text-primary-hover font-semibold hover:underline"
                    >
                      Back to Login
                    </Link>
                  </p>
                </div>
              </form>
            )}

            {/* ======================================================= */}
            {/* STEP 3: SUCCESS STATE                                   */}
            {/* ======================================================= */}
            {step === "SUCCESS" && (
              <div className="flex flex-col items-center justify-center space-y-4 py-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-sm animate-in zoom-in-75 duration-300">
                  <CheckCircle2 className="h-10 w-10" />
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-[26px] font-bold text-[#050509] sm:text-[30px]">
                    Password Reset Complete!
                  </h2>
                  <p className="text-[13px] font-medium leading-relaxed text-[#6f7788]">
                    Your password has been successfully updated. All active
                    sessions have been terminated for your security.
                  </p>
                </div>

                <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  Redirecting to login in a few moments...
                </div>

                <Button
                  type="button"
                  onClick={() => navigate("/", { replace: true })}
                  className="h-12 w-full rounded-[8px] bg-primary text-sm font-bold text-primary-foreground shadow-none transition-colors hover:bg-primary-hover"
                >
                  Log In Now
                </Button>
              </div>
            )}
    </AuthLayout>
  );
};

export default ForgotPasswordForm;
