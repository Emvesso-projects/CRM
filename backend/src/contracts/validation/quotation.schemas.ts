import { z } from "zod";

const MAX_LINE_ITEMS = 100;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_TAX_RATES = [0, 0.25, 3, 5, 12, 18, 28, 40] as const;

const QuotationStatusEnum = z.enum(["APPROVED", "PENDING", "REJECTED"]);

const requiredText = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);

const isValidDateOnly = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const DateOnlySchema = z.string().refine(isValidDateOnly, {
  message: "Date must be a valid calendar date in YYYY-MM-DD format",
});

export const AttachmentMetadataSchema = z.object({
  key: z.string().min(1, "Attachment key is required"),
  originalName: requiredText("Original name", 255),
  mimeType: z.string().min(1, "Mime type is required"),
  size: z.number().int().nonnegative(),
  type: z.enum(["IMAGE", "DOCUMENT"]),
});

export type AttachmentMetadataInput = z.infer<typeof AttachmentMetadataSchema>;

const QuotationLineItemSchema = z.object({
  itemId: z.string().uuid("Invalid item ID"),
  itemName: requiredText("Item name", 255),
  code: requiredText("HSN/SAC code", 50),
  quantity: z.number().finite().positive("Quantity must be positive").max(1_000_000),
  unit: requiredText("Unit", 30),
  price: z.number().finite().nonnegative("Price must be non-negative").max(1_000_000_000_000),
  discountPercent: z.number().finite().min(0).max(100),
  discountAmount: z.number().finite().nonnegative().max(1_000_000_000_000),
  taxPercent: z
    .number()
    .finite()
    .refine((value) => ALLOWED_TAX_RATES.includes(value as (typeof ALLOWED_TAX_RATES)[number]), {
      message: "Unsupported tax rate",
    }),
  taxAmount: z.number().finite().nonnegative().max(1_000_000_000_000),
  amount: z.number().finite().nonnegative().max(1_000_000_000_000),
});

const QuotationDetailsSchema = z
  .object({
    partyAddress: requiredText("Party address", 1000),
    partyPostalCode: requiredText("Postal code", 20),
    stateOfSupply: requiredText("State of supply", 100),
    refNoSuffix: requiredText("Reference suffix", 100),
    items: z
      .array(QuotationLineItemSchema)
      .min(1, "At least one item is required")
      .max(MAX_LINE_ITEMS, `A quotation cannot exceed ${MAX_LINE_ITEMS} line items`),
    // These client totals are accepted for backwards compatibility but are
    // always recalculated and overwritten by the server.
    subtotal: z.number().finite().nonnegative(),
    taxTotal: z.number().finite().nonnegative(),
    tdsPercent: z.number().finite().min(0).max(100),
    tdsAmount: z.number().finite().nonnegative(),
    roundOff: z.number().finite().min(-1000).max(1000),
    grandTotal: z.number().finite().nonnegative(),
    description: z.string().trim().max(5000).optional().nullable(),
    termsAndConditions: z
      .union([
        z.string().trim().max(10_000),
        z.array(z.string().trim().min(1).max(1000)).max(50),
      ])
      .optional()
      .nullable(),
    gstCategory: z
      .enum(["GST", "IGST", "EXEMPTED", "NOT_APPLICABLE"])
      .default("GST"),
  })
  .superRefine((details, ctx) => {
    if (
      details.gstCategory === "EXEMPTED" &&
      details.items.some((item) => item.taxPercent !== 0)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: "Exempted quotations cannot contain a non-zero tax rate",
      });
    }
  });

export const CreateQuotationSchema = z
  .object({
    partyName: requiredText("Party name", 255).refine((value) => value.length >= 2, {
      message: "Party name must be at least 2 characters",
    }),
    contactPerson: requiredText("Contact person", 255).refine(
      (value) => value.length >= 2,
      { message: "Contact person must be at least 2 characters" },
    ),
    refNo: requiredText("Reference number", 100).refine((value) => value.length >= 2, {
      message: "Reference number must be at least 2 characters",
    }),
    date: DateOnlySchema,
    // Creation is always forced to PENDING by the service.
    status: QuotationStatusEnum.default("PENDING"),
    assignedToId: z.string().uuid().optional().nullable().or(z.literal("")),
    prospectId: z.string().uuid().optional().nullable().or(z.literal("")),
    details: QuotationDetailsSchema,
    attachments: z.array(AttachmentMetadataSchema).max(10).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.attachments && data.attachments.length > 0) {
      const totalBytes = data.attachments.reduce((sum, att) => sum + att.size, 0);
      if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
        ctx.addIssue({
          code: "custom",
          path: ["attachments"],
          message: "Combined attachments cannot exceed 10 MB",
        });
      }
    }
  });

export const UpdateQuotationSchema = z
  .object({
    partyName: requiredText("Party name", 255).optional(),
    contactPerson: requiredText("Contact person", 255).optional(),
    refNo: requiredText("Reference number", 100).optional(),
    date: DateOnlySchema.optional(),
    status: QuotationStatusEnum.optional(),
    statusReason: z.string().trim().min(2).max(1000).optional(),
    assignedToId: z.string().uuid().optional().nullable().or(z.literal("")),
    prospectId: z.string().uuid().optional().nullable().or(z.literal("")),
    details: QuotationDetailsSchema.optional(),
    expectedVersion: z.number().int().positive().optional(),
    attachments: z.array(AttachmentMetadataSchema).max(10).optional(),
  })
  .refine((data) => Object.keys(data).some((key) => data[key as keyof typeof data] !== undefined), {
    message: "At least one field is required",
  })
  .superRefine((data, ctx) => {
    if (data.attachments && data.attachments.length > 0) {
      const totalBytes = data.attachments.reduce((sum, att) => sum + att.size, 0);
      if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
        ctx.addIssue({
          code: "custom",
          path: ["attachments"],
          message: "Combined attachments cannot exceed 10 MB",
        });
      }
    }
  });


const parseArrayQuery = (value: unknown) => {
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

export const QuotationFilterSchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.preprocess(
    parseArrayQuery,
    z.union([QuotationStatusEnum, z.array(QuotationStatusEnum).max(3)]).optional(),
  ),
  assignedToId: z.preprocess(
    parseArrayQuery,
    z.union([z.string().uuid(), z.array(z.string().uuid()).max(100)]).optional(),
  ),
  createdFrom: DateOnlySchema.optional(),
  createdTo: DateOnlySchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export type CreateQuotationInput = z.infer<typeof CreateQuotationSchema>;
export type UpdateQuotationInput = z.infer<typeof UpdateQuotationSchema>;
export type QuotationFilterInput = z.infer<typeof QuotationFilterSchema>;
