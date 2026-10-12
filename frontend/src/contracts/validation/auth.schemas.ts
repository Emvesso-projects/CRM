import { z } from "zod";
import {
  passwordRegex,
  passwordRuleMessage,
  mobileRegex,
} from "../constants";
import { OrganizationFields } from "./organization.schemas";

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address").min(1, "Email is required"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters long"),
});

/** An optional signup field: trimmed, and either left blank ("") or valid. */
const optionalField = <T extends z.ZodType<string, string>>(schema: T) =>
  z.string().trim().pipe(z.union([z.literal(""), schema])).optional();

/** yyyy-mm-dd for tomorrow (UTC) — one day of slack so "today" in IST is never "future". */
const latestRegistrationDate = () =>
  new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

/**
 * Signup step 1 — the organization. Mirrors the backend contract; rules come
 * from OrganizationFields so signup matches the super-admin form.
 */
export const SignupOrganizationSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(2, "Organization name must be at least 2 characters long")
    .max(120, "Organization name cannot exceed 120 characters"),
  orgType: OrganizationFields.orgType,
  address: z
    .string()
    .trim()
    .min(2, "Office address is required")
    .max(500, "Address cannot exceed 500 characters"),
  orgMobile: z.string().trim().pipe(OrganizationFields.mobile),
  orgEmail: optionalField(OrganizationFields.email),
  authorizedPerson: optionalField(OrganizationFields.authorizedPerson),
  dateOfRegistration: optionalField(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")
      .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date")
      .refine(
        (value) => value <= latestRegistrationDate(),
        "Registration date cannot be in the future",
      ),
  ),
  gstin: optionalField(OrganizationFields.gstin),
  remark: optionalField(OrganizationFields.remark),
});

/** Signup step 2 — the admin account. The code is mailed to `email`. */
export const SignupAccountSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, "First name must be at least 2 characters long")
    .max(80, "First name cannot exceed 80 characters"),
  lastName: z
    .string()
    .trim()
    .min(2, "Last name must be at least 2 characters long")
    .max(80, "Last name cannot exceed 80 characters"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Work email is required")
    .email("Invalid work email address"),
  mobile: z
    .string()
    .trim()
    .regex(mobileRegex, "Mobile must be a valid 10-digit number"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters long")
    .regex(passwordRegex, passwordRuleMessage),
});

/** The whole signup payload, posted once at the end of step 2. */
export const SignupSchema = SignupOrganizationSchema.extend(
  SignupAccountSchema.shape,
).strict();

const mobileSchema = z
  .union([
    z.string().regex(mobileRegex, "Invalid mobile number"),
    z.string().length(0).transform(() => null),
    z.null(),
  ])
  .optional();

export const UpdateProfileSchema = z.object({
  firstName: z
    .string()
    .min(2, "First name must be at least 2 characters long")
    .optional(),
  lastName: z
    .string()
    .min(2, "Last name must be at least 2 characters long")
    .optional(),
  mobile: mobileSchema,
  profileImage: z.string().optional().nullable(),
});

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().nonempty("Current password is required"),
    newPassword: z
      .string()
      .nonempty("New password is required")
      .min(8, "New password must be at least 8 characters long")
      .regex(passwordRegex, passwordRuleMessage),
    confirmPassword: z.string().nonempty("Confirm password is required"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirm password must match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

export const ForgotPasswordSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "Email is required")
      .email("Invalid email address"),
  })
  .strict();

export const ResetPasswordSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "Email is required")
      .email("Invalid email address"),
    otp: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "OTP must be a 6-digit code"),
    newPassword: z
      .string()
      .nonempty("New password is required")
      .min(8, "New password must be at least 8 characters long")
      .max(128, "New password cannot exceed 128 characters")
      .regex(passwordRegex, passwordRuleMessage),
    confirmPassword: z
      .string()
      .nonempty("Confirm password is required")
      .max(128, "Confirm password cannot exceed 128 characters"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirm password must match",
    path: ["confirmPassword"],
  });

/**
 * Signup step 2 — the code that turns a pending signup into a real
 * organization. Mirrors the backend schema; the email travels with it because
 * there is no session yet.
 */
export const SignupVerifySchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "Email is required")
      .email("Invalid email address"),
    otp: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Verification code must be a 6-digit code"),
  })
  .strict();

export type LoginInput = z.infer<typeof LoginSchema>;
export type SignupInput = z.infer<typeof SignupSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type SignupVerifyInput = z.infer<typeof SignupVerifySchema>;
