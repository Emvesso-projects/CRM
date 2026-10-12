import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  useForm,
  Controller,
  type FieldErrors,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import FormField from "@/components/common/FormField";
import { useAppDispatch, useAppSelector } from "@/hooks/useRedux";
import { signup } from "../../store/slice";
import { selectAuthError } from "../../store/selectors";
import { authService } from "../../api/services";
import { extractApiError } from "@/utils/apiError";
import {
  SignupSchema,
  SignupVerifySchema,
  type SignupInput,
  type SignupVerifyInput,
} from "@/contracts/validation";
import { ORGANIZATION_TYPE_OPTIONS } from "@/contracts/constants";
import { DEFAULT_AUTHENTICATED_PATH } from "@/utils/orgRoutes";
import { cn } from "@/utils/cn";
import loginBg from "@/assets/images/login-bg.svg";
import logoImg from "@/assets/images/logo.svg";

const inputClassName =
  "h-10 rounded-[8px] border-[#c8d0e2] bg-white pl-3 pr-9 text-sm font-medium text-[#111827] shadow-none placeholder:text-[12px] placeholder:font-normal placeholder:text-[#a0a7b8] hover:border-[#b9c3d9] focus-visible:border-primary focus-visible:ring-primary/15 sm:h-11 sm:pl-4 sm:pr-11 sm:placeholder:text-[13px] [@media(max-height:680px)]:h-9 [@media(max-height:680px)]:text-[13px]";

const textareaClassName =
  "w-full resize-none rounded-[8px] border border-[#c8d0e2] bg-white px-3 py-2 text-sm font-medium text-[#111827] shadow-none placeholder:text-[12px] placeholder:font-normal placeholder:text-[#a0a7b8] hover:border-[#b9c3d9] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15 sm:px-4 sm:placeholder:text-[13px]";

const fieldClassName =
  "gap-1.5 [&_label]:text-[12px] [&_label]:font-semibold [&_label]:text-[#050509] sm:gap-2 sm:[&_label]:text-[13px] [@media(max-height:680px)]:gap-1";

const primaryButtonClassName =
  "h-10 rounded-[8px] bg-primary text-sm font-bold text-primary-foreground shadow-none transition-colors hover:bg-primary-hover sm:h-12 [@media(max-height:680px)]:h-9";

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * ORGANIZATION → ACCOUNT → VERIFY.
 *
 * Organization first, account second, so the work email is typed on the last
 * screen before the code is sent — and step 1 never touches the network, so the
 * server only ever sees one complete payload.
 */
type SignupStep = "ORGANIZATION" | "ACCOUNT" | "VERIFY";

const STEPS: { key: SignupStep; label: string }[] = [
  { key: "ORGANIZATION", label: "Organization" },
  { key: "ACCOUNT", label: "Account" },
  { key: "VERIFY", label: "Verify" },
];

/** The form holds "" in orgType until a type is chosen. */
type SignupFormValues = Omit<SignupInput, "orgType"> & {
  orgType: SignupInput["orgType"] | "";
};

type SignupField = keyof SignupFormValues;

const ORGANIZATION_FIELDS = [
  "companyName",
  "orgType",
  "address",
  "orgMobile",
  "orgEmail",
  "authorizedPerson",
  "dateOfRegistration",
  "gstin",
  "remark",
] as const satisfies readonly SignupField[];

const ACCOUNT_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "mobile",
  "password",
] as const satisfies readonly SignupField[];

const ALL_FIELDS: readonly SignupField[] = [
  ...ORGANIZATION_FIELDS,
  ...ACCOUNT_FIELDS,
];

const isOrganizationField = (field: string) =>
  (ORGANIZATION_FIELDS as readonly string[]).includes(field);

/** Local yyyy-mm-dd, for the date input's `max`. */
const todayLocalIso = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};

const digitsOnly = (value: string, max: number) =>
  value.replace(/\D/g, "").slice(0, max);

const StepIndicator = ({ step }: { step: SignupStep }) => {
  const currentIndex = STEPS.findIndex((entry) => entry.key === step);

  return (
    <ol
      aria-label="Signup progress"
      className="mb-4 flex items-center justify-center gap-1.5 sm:mb-6 sm:gap-2 [@media(max-height:680px)]:mb-2"
    >
      {STEPS.map((entry, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <li
            key={entry.key}
            className="flex items-center gap-1.5 sm:gap-2"
            aria-current={isCurrent ? "step" : undefined}
          >
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold",
                isDone && "bg-primary text-primary-foreground",
                isCurrent && "bg-primary/15 text-primary ring-2 ring-primary",
                !isDone && !isCurrent && "bg-[#eef1f6] text-[#8b94a7]",
              )}
            >
              {isDone ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : index + 1}
            </span>
            <span
              className={cn(
                "text-[12px] font-semibold sm:text-[13px]",
                isCurrent ? "text-[#050509]" : "text-[#8b94a7]",
              )}
            >
              {entry.label}
            </span>
            {index < STEPS.length - 1 && (
              <span
                className="h-px w-4 bg-[#d6dce8] sm:w-8"
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
};

const ErrorBanner = ({ message }: { message: string }) => (
  <div
    role="alert"
    className="flex min-w-0 items-start gap-2 break-words rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm leading-relaxed text-destructive"
  >
    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
    <span className="min-w-0 flex-1 break-words">{message}</span>
  </div>
);

/**
 * Self-service signup: organization details, then the admin account, then the
 * emailed code. Nothing exists server-side until the code is confirmed.
 */
const SignUpForm = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [step, setStep] = useState<SignupStep>("ORGANIZATION");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendNotice, setResendNotice] = useState("");
  const otpInputRef = useRef<HTMLInputElement | null>(null);

  // Verify goes through the signup thunk, so its error lives in the slice.
  const verifyError = useAppSelector(selectAuthError);

  /*
   * ONE form across the organization and account steps, so Back can never lose
   * a value. Continue validates only the organization fields; submit validates
   * the whole schema.
   */
  const {
    handleSubmit,
    control,
    register,
    trigger,
    getValues,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    // Cast: the schema's optional fields are trimmed through `pipe`, so its
    // input and output types differ slightly from the form's string values.
    resolver: zodResolver(SignupSchema) as unknown as Resolver<SignupFormValues>,
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      companyName: "",
      orgType: "",
      address: "",
      orgMobile: "",
      orgEmail: "",
      authorizedPerson: "",
      dateOfRegistration: "",
      gstin: "",
      remark: "",
      firstName: "",
      lastName: "",
      email: "",
      mobile: "",
      password: "",
    },
  });

  const {
    handleSubmit: handleVerifySubmit,
    control: verifyControl,
    setValue: setVerifyValue,
    formState: { errors: verifyErrors, isSubmitting: isVerifying },
  } = useForm<SignupVerifyInput>({
    resolver: zodResolver(SignupVerifySchema),
    mode: "onChange",
    defaultValues: { email: "", otp: "" },
  });

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const goToAccount = async () => {
    setFormError("");
    const valid = await trigger([...ORGANIZATION_FIELDS]);
    if (!valid) return;

    // Most admins share the organization's number; offer it, keep it editable.
    if (!getValues("mobile")) {
      setValue("mobile", getValues("orgMobile"));
    }
    setStep("ACCOUNT");
  };

  /**
   * Put a server error where the user can fix it: a taken email on the email
   * field, a rejected organization field back on step 1, anything else in the
   * banner.
   */
  const applyServerError = (error: unknown) => {
    const parsed = extractApiError(error);

    if (parsed.status === 409) {
      setError("email", { type: "server", message: parsed.message });
      setStep("ACCOUNT");
      return;
    }

    const details = Array.isArray(parsed.details)
      ? (parsed.details as Array<{ field?: unknown; message?: unknown }>)
      : [];
    const fieldErrors = details.filter(
      (detail): detail is { field: SignupField; message: string } =>
        typeof detail.field === "string" &&
        ALL_FIELDS.includes(detail.field as SignupField) &&
        typeof detail.message === "string",
    );

    if (fieldErrors.length > 0) {
      for (const detail of fieldErrors) {
        setError(detail.field, { type: "server", message: detail.message });
      }
      setStep(
        fieldErrors.some((detail) => isOrganizationField(detail.field))
          ? "ORGANIZATION"
          : "ACCOUNT",
      );
      return;
    }

    setFormError(parsed.message);
  };

  /** Mail a code. Creates nothing server-side until the code is redeemed. */
  const requestCode = async (
    values: SignupFormValues,
    { isResend }: { isResend: boolean },
  ) => {
    setFormError("");
    setResendNotice("");
    setIsSendingCode(true);

    try {
      // orgType is non-empty here: the whole schema has already validated.
      const { email } = await authService.startSignup(values as SignupInput);
      setVerifyValue("email", email);
      setStep("VERIFY");
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      if (isResend) setResendNotice(`A new code is on its way to ${email}.`);
      setTimeout(() => otpInputRef.current?.focus(), 150);
    } catch (error) {
      applyServerError(error);
    } finally {
      setIsSendingCode(false);
    }
  };

  const onCreateAccount = (values: SignupFormValues) =>
    requestCode(values, { isResend: false });

  // Step-1 fields cannot be edited on step 2, so a failure there means the user
  // needs to go back to see it.
  const onInvalid = (invalid: FieldErrors<SignupFormValues>) => {
    if (ORGANIZATION_FIELDS.some((field) => invalid[field])) {
      setStep("ORGANIZATION");
    }
  };

  const onResend = () => {
    if (resendCooldown > 0 || isSendingCode) return;
    void requestCode(getValues(), { isResend: true });
  };

  const onSubmitVerify = async (values: SignupVerifyInput) => {
    try {
      await dispatch(signup(values)).unwrap();
      navigate(DEFAULT_AUTHENTICATED_PATH, { replace: true });
    } catch {
      // Stored in the slice and rendered as verifyError.
    }
  };

  const heading: Record<SignupStep, { title: string; subtitle: string }> = {
    ORGANIZATION: {
      title: "Create Account",
      subtitle:
        "Start with your organization. These details appear on every quotation you send.",
    },
    ACCOUNT: {
      title: "Your account",
      subtitle:
        "You'll be the administrator. We'll email a code to confirm your address.",
    },
    VERIFY: {
      title: "Check your email",
      subtitle: `Enter the 6-digit code we sent to ${getValues("email")} to finish creating your account.`,
    },
  };

  return (
    <div
      className="h-[100svh] max-h-[100svh] overflow-hidden bg-cover bg-[30%_center] text-foreground sm:bg-left lg:h-[100vh] lg:max-h-[100vh] lg:bg-left"
      style={{ backgroundImage: `url(${loginBg})` }}
    >
      <main className="flex h-full w-full items-center justify-center overflow-hidden px-4 py-3 sm:px-8 md:px-10 lg:justify-end lg:py-5 lg:pr-[4.7vw] xl:pr-[4.8vw] 2xl:pr-[5vw]">
        <section className="flex max-h-[calc(100svh-24px)] w-full max-w-[420px] flex-col overflow-x-hidden overflow-y-auto rounded-[24px] border border-white/80 bg-white px-4 py-4 shadow-[0_22px_60px_rgba(25,38,95,0.15)] sm:max-w-[560px] sm:px-8 sm:py-7 lg:mr-[clamp(2rem,6vw,6rem)] lg:h-auto lg:max-h-[calc(100vh-40px)] lg:w-[clamp(480px,40vw,600px)] lg:max-w-none lg:rounded-[28px] lg:px-10 lg:py-8 [@media(max-height:680px)]:py-3">
          <div className="flex min-h-0 flex-1 flex-col justify-start">
            <div className="mb-3 flex items-center justify-center gap-2 sm:mb-5 [@media(max-height:680px)]:mb-2">
              <img
                src={logoImg}
                alt="CRM Logo"
                className="h-5 w-5 shrink-0 object-contain [@media(max-height:680px)]:h-4 [@media(max-height:680px)]:w-4 lg:h-6 lg:w-6"
              />
              <span className="text-[13px] font-bold leading-none text-primary sm:text-sm">
                EMVESSO CRM
              </span>
            </div>

            <StepIndicator step={step} />

            <div className="mb-3 space-y-1.5 text-center sm:mb-5 [@media(max-height:680px)]:mb-2">
              <h2 className="text-[24px] font-bold leading-none text-[#050509] sm:text-[30px] [@media(max-height:680px)]:text-[20px]">
                {heading[step].title}
              </h2>
              <p className="break-words text-[12px] font-medium leading-snug text-[#6f7788] sm:text-[13px] sm:leading-relaxed [@media(max-height:680px)]:text-[11px]">
                {heading[step].subtitle}
              </p>
            </div>

            {step !== "VERIFY" && (
              <form
                onSubmit={handleSubmit(onCreateAccount, onInvalid)}
                noValidate
                className="space-y-3 sm:space-y-4 [@media(max-height:680px)]:space-y-2"
              >
                {step === "ORGANIZATION" && (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 [@media(max-height:680px)]:gap-2">
                      <div className="sm:col-span-2">
                        <FormField
                          id="companyName"
                          label="Organization Name"
                          required
                          error={errors.companyName?.message}
                          className={fieldClassName}
                        >
                          <Input
                            id="companyName"
                            autoComplete="organization"
                            placeholder="e.g. Acme Steel Works Pvt Ltd"
                            className={inputClassName}
                            {...register("companyName")}
                          />
                        </FormField>
                      </div>

                      <FormField
                        id="orgType"
                        label="Organization Type"
                        required
                        error={errors.orgType?.message}
                        className={fieldClassName}
                      >
                        <Controller
                          name="orgType"
                          control={control}
                          render={({ field }) => (
                            <Select
                              options={ORGANIZATION_TYPE_OPTIONS}
                              value={field.value || undefined}
                              onValueChange={(value) => {
                                field.onChange(value);
                                void trigger("orgType");
                              }}
                              placeholder="Select type"
                              triggerClassName="h-10 rounded-[8px] border-[#c8d0e2] text-sm font-medium sm:h-11 [@media(max-height:680px)]:h-9"
                            />
                          )}
                        />
                      </FormField>

                      <FormField
                        id="orgMobile"
                        label="Organization Mobile"
                        required
                        error={errors.orgMobile?.message}
                        className={fieldClassName}
                      >
                        <Controller
                          name="orgMobile"
                          control={control}
                          render={({ field }) => (
                            <Input
                              id="orgMobile"
                              name={field.name}
                              ref={field.ref}
                              value={field.value}
                              onBlur={field.onBlur}
                              onChange={(e) =>
                                field.onChange(digitsOnly(e.target.value, 10))
                              }
                              inputMode="numeric"
                              autoComplete="tel"
                              placeholder="10-digit mobile number"
                              className={inputClassName}
                            />
                          )}
                        />
                      </FormField>

                      <FormField
                        id="orgEmail"
                        label="Organization Email"
                        error={errors.orgEmail?.message}
                        className={fieldClassName}
                      >
                        <Input
                          id="orgEmail"
                          type="email"
                          autoComplete="email"
                          placeholder="Defaults to your work email"
                          className={inputClassName}
                          {...register("orgEmail")}
                        />
                      </FormField>

                      <FormField
                        id="dateOfRegistration"
                        label="Registration Date"
                        error={errors.dateOfRegistration?.message}
                        className={fieldClassName}
                      >
                        <Input
                          id="dateOfRegistration"
                          type="date"
                          max={todayLocalIso()}
                          className={inputClassName}
                          {...register("dateOfRegistration")}
                        />
                      </FormField>

                      <FormField
                        id="gstin"
                        label="GSTIN"
                        error={errors.gstin?.message}
                        className={fieldClassName}
                      >
                        <Controller
                          name="gstin"
                          control={control}
                          render={({ field }) => (
                            <Input
                              id="gstin"
                              name={field.name}
                              ref={field.ref}
                              value={field.value ?? ""}
                              onBlur={field.onBlur}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value.toUpperCase().slice(0, 15),
                                )
                              }
                              autoComplete="off"
                              placeholder="e.g. 27AAAAA0000A1Z5"
                              className={inputClassName}
                            />
                          )}
                        />
                      </FormField>

                      <FormField
                        id="authorizedPerson"
                        label="Authorized Person"
                        error={errors.authorizedPerson?.message}
                        className={fieldClassName}
                      >
                        <Input
                          id="authorizedPerson"
                          autoComplete="name"
                          placeholder="Defaults to your name"
                          className={inputClassName}
                          {...register("authorizedPerson")}
                        />
                      </FormField>

                      <div className="sm:col-span-2">
                        <FormField
                          id="address"
                          label="Office Address"
                          required
                          error={errors.address?.message}
                          className={fieldClassName}
                        >
                          <textarea
                            id="address"
                            rows={2}
                            autoComplete="street-address"
                            placeholder="Street, area, city, state and PIN code"
                            className={textareaClassName}
                            {...register("address")}
                          />
                        </FormField>
                      </div>

                      <div className="sm:col-span-2">
                        <FormField
                          id="remark"
                          label="Remarks"
                          error={errors.remark?.message}
                          className={fieldClassName}
                        >
                          <textarea
                            id="remark"
                            rows={2}
                            placeholder="Anything else about your business"
                            className={textareaClassName}
                            {...register("remark")}
                          />
                        </FormField>
                      </div>
                    </div>

                    <Button
                      type="button"
                      onClick={goToAccount}
                      className={cn("mt-1 w-full", primaryButtonClassName)}
                    >
                      Continue
                    </Button>
                  </>
                )}

                {step === "ACCOUNT" && (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 [@media(max-height:680px)]:gap-2">
                      <FormField
                        id="firstName"
                        label="First Name"
                        required
                        error={errors.firstName?.message}
                        className={fieldClassName}
                      >
                        <Input
                          id="firstName"
                          autoComplete="given-name"
                          placeholder="Enter first name"
                          className={inputClassName}
                          {...register("firstName")}
                        />
                      </FormField>

                      <FormField
                        id="lastName"
                        label="Last Name"
                        required
                        error={errors.lastName?.message}
                        className={fieldClassName}
                      >
                        <Input
                          id="lastName"
                          autoComplete="family-name"
                          placeholder="Enter last name"
                          className={inputClassName}
                          {...register("lastName")}
                        />
                      </FormField>

                      <FormField
                        id="email"
                        label="Work Email"
                        required
                        error={errors.email?.message}
                        className={fieldClassName}
                      >
                        <Input
                          id="email"
                          type="email"
                          autoComplete="email"
                          placeholder="We'll send your code here"
                          className={inputClassName}
                          {...register("email")}
                        />
                      </FormField>

                      <FormField
                        id="mobile"
                        label="Mobile"
                        required
                        error={errors.mobile?.message}
                        className={fieldClassName}
                      >
                        <Controller
                          name="mobile"
                          control={control}
                          render={({ field }) => (
                            <Input
                              id="mobile"
                              name={field.name}
                              ref={field.ref}
                              value={field.value}
                              onBlur={field.onBlur}
                              onChange={(e) =>
                                field.onChange(digitsOnly(e.target.value, 10))
                              }
                              inputMode="numeric"
                              autoComplete="tel"
                              placeholder="10-digit mobile number"
                              className={inputClassName}
                            />
                          )}
                        />
                      </FormField>

                      <div className="sm:col-span-2">
                        <FormField
                          id="password"
                          label="Password"
                          required
                          error={errors.password?.message}
                          className={fieldClassName}
                        >
                          <div className="relative">
                            <Input
                              id="password"
                              type={showPassword ? "text" : "password"}
                              autoComplete="new-password"
                              placeholder="Create a password"
                              className={inputClassName}
                              {...register("password")}
                            />
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => setShowPassword((shown) => !shown)}
                              aria-label={
                                showPassword ? "Hide password" : "Show password"
                              }
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a0a7b8] transition-colors hover:text-[#6f7788]"
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </FormField>
                      </div>
                    </div>

                    {formError && <ErrorBanner message={formError} />}

                    <div className="mt-1 flex gap-2 sm:gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setFormError("");
                          setStep("ORGANIZATION");
                        }}
                        disabled={isSubmitting || isSendingCode}
                        className="h-10 rounded-[8px] px-4 text-sm font-semibold sm:h-12 [@media(max-height:680px)]:h-9"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSubmitting || isSendingCode}
                        className={cn("flex-1", primaryButtonClassName)}
                      >
                        {isSubmitting || isSendingCode
                          ? "Sending code..."
                          : "Create account"}
                      </Button>
                    </div>
                  </>
                )}

                <p className="pt-0.5 text-center text-[12px] font-medium text-[#8b94a7] sm:text-[13px] [@media(max-height:680px)]:pt-0">
                  Already have an account?{" "}
                  <Link to="/" className="text-primary-hover hover:underline">
                    Sign In
                  </Link>
                </p>
              </form>
            )}

            {step === "VERIFY" && (
              <form
                onSubmit={handleVerifySubmit(onSubmitVerify)}
                className="space-y-3 sm:space-y-4 [@media(max-height:680px)]:space-y-2"
              >
                <FormField
                  id="otp"
                  label="6-Digit Code"
                  error={verifyErrors.otp?.message}
                  className={fieldClassName}
                >
                  <Controller
                    name="otp"
                    control={verifyControl}
                    render={({ field }) => (
                      <div className="relative">
                        <Input
                          {...field}
                          id="otp"
                          ref={otpInputRef}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          autoComplete="one-time-code"
                          placeholder="Enter 6 digits"
                          onChange={(e) =>
                            field.onChange(digitsOnly(e.target.value, 6))
                          }
                          className={`${inputClassName} text-center font-mono text-base font-bold tracking-widest`}
                        />
                        <KeyRound className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a0a7b8]" />
                      </div>
                    )}
                  />
                </FormField>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("ACCOUNT");
                      setResendNotice("");
                    }}
                    className="text-[12px] font-semibold text-primary-hover hover:underline sm:text-[13px]"
                  >
                    Change email
                  </button>
                  <button
                    type="button"
                    onClick={onResend}
                    disabled={resendCooldown > 0 || isSendingCode}
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary-hover hover:underline disabled:cursor-not-allowed disabled:text-[#a0a7b8] disabled:no-underline sm:text-[13px]"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : "Resend code"}
                  </button>
                </div>

                {resendNotice && (
                  <p className="text-[12px] font-medium text-[#6f7788]">
                    {resendNotice}
                  </p>
                )}

                {(verifyError || formError) && (
                  <ErrorBanner message={verifyError || formError} />
                )}

                <Button
                  type="submit"
                  disabled={isVerifying}
                  className={cn("mt-2 w-full", primaryButtonClassName)}
                >
                  {isVerifying ? "Creating account..." : "Verify & create account"}
                </Button>
              </form>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default SignUpForm;
