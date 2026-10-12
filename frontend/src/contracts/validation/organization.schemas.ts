import { z } from "zod";
import {
  ORGANIZATION_STATUS_VALUES,
  ORGANIZATION_TYPE_VALUES,
  passwordRegex,
  passwordRuleMessage,
} from "../constants";

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const OrganizationStatusEnum = z.enum(ORGANIZATION_STATUS_VALUES);
const OrganizationTypeEnum = z.enum(ORGANIZATION_TYPE_VALUES);

export const OrganizationSlugSchema = z
  .string()
  .trim()
  .min(2, "Slug must be at least 2 characters")
  .regex(
    /^[a-z0-9-]+$/,
    "Slug can only contain lowercase letters, numbers, and hyphens",
  );

const parseQueryArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.flatMap((entry) =>
      typeof entry === "string"
        ? entry.split(",").map((part) => part.trim()).filter(Boolean)
        : [],
    );
  }

  if (typeof value === "string" && value.includes(",")) {
    return value.split(",").map((part) => part.trim()).filter(Boolean);
  }

  return value;
};

/**
 * Field rules shared by super-admin create/update, Settings → Company and
 * self-service signup. Mirrors the backend `OrganizationFields`.
 */
export const OrganizationFields = {
  name: z.string().min(2, "Organization name is required"),
  authorizedPerson: z.string().min(2, "Authorized person is required"),
  orgType: z.enum(ORGANIZATION_TYPE_VALUES, {
    message: "Select an organization type",
  }),
  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Mobile must be a valid 10-digit number"),
  /** Blank is allowed — not every business is GST registered. */
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine(
      (val) => val === "" || GSTIN_REGEX.test(val),
      "GSTIN format is invalid",
    ),
  address: z.string().min(2, "Address is required"),
  dateOfRegistration: z.coerce.date(),
  email: z.string().email("Invalid email"),
  remark: z.string().max(500, "Remark cannot exceed 500 characters"),
};

const OrganizationBaseSchema = z.object({
  name: OrganizationFields.name,
  slug: OrganizationSlugSchema,
  prefix: z
    .string()
    .min(2, "Prefix must be at least 2 characters")
    .max(10, "Prefix cannot exceed 10 characters")
    .regex(
      /^[A-Z0-9]+$/,
      "Prefix can only contain uppercase letters and numbers",
    )
    .transform((val) => val.toUpperCase()),
  status: OrganizationStatusEnum.optional(),
  authorizedPerson: OrganizationFields.authorizedPerson,
  orgType: OrganizationFields.orgType,
  mobile: OrganizationFields.mobile,
  gstin: OrganizationFields.gstin.optional(),
  address: OrganizationFields.address,
  dateOfRegistration: OrganizationFields.dateOfRegistration,
  email: OrganizationFields.email,
  remark: OrganizationFields.remark.optional(),
  bankName: z.string().trim().min(2).max(100).optional().nullable(),
  accountHolderName: z.string().trim().min(2).max(100).optional().nullable(),
  accountNumber: z
    .string()
    .trim()
    .min(6)
    .max(35)
    .regex(/^[A-Za-z0-9]+$/, "Account number must be alphanumeric")
    .optional()
    .nullable(),
  ifscCode: z
    .string()
    .trim()
    .min(4)
    .max(15)
    .transform((val) => val.toUpperCase())
    .optional()
    .nullable(),
  branchName: z.string().trim().max(100).optional().nullable(),
  accountType: z.string().trim().max(50).optional().nullable(),
});

const OrganizationAdminSchema = z.object({
  adminEmail: z.string().email("Invalid admin email"),
  adminPassword: z
    .string()
    .min(8, "Admin password must be at least 8 characters long")
    .regex(passwordRegex, passwordRuleMessage),
  adminFirstName: z.string().min(2, "Admin first name is required"),
  adminLastName: z.string().min(2, "Admin last name is required"),
  adminMobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Admin mobile must be a valid 10-digit number"),
});

/**
 * Plan is chosen at creation only — a super-admin picks the plan the new
 * organization opens its subscription on. Plan CHANGES afterwards go through the
 * billing console, so this is on Create only and absent from Update. Mirrors the
 * backend contract in backend/src/contracts/validation/organization.schemas.ts.
 */
const OrganizationPlanSchema = z.object({
  planId: z.string().uuid("A valid plan must be selected"),
});

export const CreateOrganizationSchema = OrganizationBaseSchema.merge(
  OrganizationAdminSchema,
).merge(OrganizationPlanSchema);

export const UpdateOrganizationSchema = OrganizationBaseSchema.partial();

export const OrganizationSlugParamSchema = z.object({
  slug: OrganizationSlugSchema,
});

export const OrganizationFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  status: z.preprocess(
    parseQueryArray,
    z.union([OrganizationStatusEnum, z.array(OrganizationStatusEnum)]).optional(),
  ),
});

export const BankDetailsSchema = z.object({
  bankName: z.string().trim().min(2, "Bank name is required").max(100),
  accountHolderName: z
    .string()
    .trim()
    .min(2, "Account holder name is required")
    .max(100),
  accountNumber: z
    .string()
    .trim()
    .min(6, "Account number must be at least 6 characters")
    .max(35, "Account number cannot exceed 35 characters")
    .regex(/^[A-Za-z0-9]+$/, "Account number must be alphanumeric"),
  ifscCode: z
    .string()
    .trim()
    .min(4, "IFSC code is required")
    .max(15, "IFSC code cannot exceed 15 characters")
    .transform((val) => val.toUpperCase()),
  branchName: z.string().trim().max(100).optional().nullable(),
  accountType: z.string().trim().max(50).optional().nullable(),
});

/**
 * The organization fields a tenant ADMIN may edit — Settings → Company.
 *
 * Deliberately excludes slug, prefix and status: prefix drives quotation
 * numbering and status controls whether the org's users can log in at all, so
 * both are platform-owned. organizationService.updateOrganization rejects them
 * from a non-super-admin, and this schema simply does not offer them.
 *
 * orgType accepts "" because organizations created before real types existed
 * have none; this form is where an admin picks one.
 *
 * Optional fields accept "" so a user can clear one; the submit handler is
 * responsible for omitting empties, because the server's `address` (min 2) and
 * `mobile` (10-digit regex) rules have no empty-string escape.
 */
export const CompanyProfileSchema = z.object({
  name: z.string().trim().min(2, "Company name is required"),
  orgType: z.union([z.literal(""), OrganizationTypeEnum]),
  authorizedPerson: z
    .string()
    .trim()
    .min(2, "Authorized person must be at least 2 characters")
    .or(z.literal("")),
  email: z.string().trim().email("Invalid email").or(z.literal("")),
  mobile: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Mobile must be a valid 10-digit number")
    .or(z.literal("")),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine(
      (val) => val === "" || GSTIN_REGEX.test(val),
      "GSTIN format is invalid",
    ),
  address: z
    .string()
    .trim()
    .min(2, "Address must be at least 2 characters")
    .or(z.literal("")),
  dateOfRegistration: z.string().trim().or(z.literal("")),
});

export type CompanyProfileInput = z.infer<typeof CompanyProfileSchema>;

export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationSchema>;
export type OrganizationFilterInput = z.infer<typeof OrganizationFilterSchema>;
export type BankDetailsInput = z.infer<typeof BankDetailsSchema>;
