import { z } from "zod";

export const prospectSchema = z.object({
  firstName: z.string().trim().min(1, "First Name is required").max(100),
  lastName: z.string().trim().min(1, "Last Name is required").max(100),
  email: z.string().trim().email("Invalid email address").min(1, "Email is required"),
  mobile: z
    .string()
    .trim()
    .min(10, "Mobile number is required")
    .regex(/^[0-9]{10}$/, "Enter a valid 10-digit mobile number"),
  alternateMobile: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  state: z.string().optional().or(z.literal("")),
  pinCode: z.string().optional().or(z.literal("")),
  companyName: z.string().trim().min(1, "Company Name is required"),
  gstin: z.string().optional().or(z.literal("")),
  leadSource: z.string().optional().or(z.literal("")),
  industry: z.string().optional().or(z.literal("")),
  customIndustry: z.string().optional().or(z.literal("")),
  leadType: z.string().optional().or(z.literal("")),
  leadDate: z.string().optional().or(z.literal("")),
  productInterested: z.string().optional().or(z.literal("")),
  expectedValue: z.string().optional().or(z.literal("")),
  assignedToId: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export const updateProspectSchema = prospectSchema.partial();

export type ProspectFormValues = z.infer<typeof prospectSchema>;

