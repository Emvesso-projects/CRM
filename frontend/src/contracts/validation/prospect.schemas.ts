import { z } from "zod";
import {
  LOGGABLE_ACTIVITY_TYPE_VALUES,
  PROSPECT_FOLLOW_UP_TYPE_VALUES,
  PROSPECT_REMINDER_VALUES,
  PROSPECT_STAGE_VALUES,
  FOLLOW_UP_OUTCOME_VALUES,
} from "../constants";

const ProspectStageEnum = z.enum(PROSPECT_STAGE_VALUES);
const ProspectFollowUpTypeEnum = z.enum(PROSPECT_FOLLOW_UP_TYPE_VALUES);
const ProspectReminderEnum = z.enum(PROSPECT_REMINDER_VALUES);
const LoggableActivityTypeEnum = z.enum(LOGGABLE_ACTIVITY_TYPE_VALUES);
const FollowUpOutcomeEnum = z.enum(FOLLOW_UP_OUTCOME_VALUES);
const FollowUpStatusFilterEnum = z.enum([
  "OVERDUE",
  "DUE_TODAY",
  "UPCOMING",
  "NO_FOLLOWUP",
]);

const OptionalDateString = z.string().datetime().optional().nullable();
const OptionalText = z.string().trim().optional().nullable();
const OptionalUuid = z.string().uuid().optional().nullable();
const FollowUpTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be in HH:MM format");
const Reason = z.string().trim().max(500, "Max 500 characters").optional().nullable();
/** An instant with an explicit offset or Z, e.g. new Date().toISOString(). */
const IsoDateTime = z
  .string()
  .datetime({ offset: true, message: "Must be an ISO date and time" });
const ActivityRemark = z
  .string()
  .trim()
  .min(1, "Notes are required")
  .max(1000, "Max 1000 characters");

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

export const ProspectFilterSchema = z.object({
  stage: z.preprocess(
    parseQueryArray,
    z.union([ProspectStageEnum, z.array(ProspectStageEnum)]).optional(),
  ),
  assignedToId: z.preprocess(
    parseQueryArray,
    z.union([z.string().uuid(), z.array(z.string().uuid())]).optional(),
  ),
  search: z.string().trim().min(3).optional(),
  createdFrom: z.string().date().optional(),
  createdTo: z.string().date().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).optional().default(10),
  status: z.preprocess(
    parseQueryArray,
    z.union([z.enum(["ACTIVE", "INACTIVE"]), z.array(z.enum(["ACTIVE", "INACTIVE"]))]).optional(),
  ),
  followUpStatus: z.preprocess(
    parseQueryArray,
    z.union([FollowUpStatusFilterEnum, z.array(FollowUpStatusFilterEnum)]).optional(),
  ),
});

export const ProspectFollowUpSchema = z.object({
  date: z.string().date().optional().nullable(),
  time: FollowUpTime.optional().nullable(),
  type: ProspectFollowUpTypeEnum.optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  reminder: ProspectReminderEnum.optional().nullable(),
  assignedToId: OptionalUuid,
});

const ProspectBaseFieldsSchema = z.object({
  stage: ProspectStageEnum.optional().default("REQUIREMENT"),
  expectedValue: z.number().min(0).optional().nullable(),
  closeDate: OptionalDateString,
  notes: OptionalText,
  assignedToId: OptionalUuid,
  followUp: ProspectFollowUpSchema.optional().nullable(),
});

export const ConvertLeadToProspectSchema = ProspectBaseFieldsSchema.extend({
  leadId: z.string().uuid(),
});

export const ConvertLeadToProspectFromLeadSchema =
  ProspectBaseFieldsSchema;

export const UpdateProspectSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email(),
  mobile: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{10,15}$/, "Phone number must be 10-15 digits"),
  companyName: z.string().trim().min(1).max(150),
  expectedValue: z.number().min(0).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  assignedToId: OptionalUuid,
});

export const UpdateProspectStageSchema = z.object({
  stage: ProspectStageEnum,
  comment: z.string().trim().min(10).max(500),
});

/** A new pending follow-up. A missing time means 09:00 (business timezone). */
export const ScheduleFollowUpSchema = ProspectFollowUpSchema.superRefine(
  (value, ctx) => {
    if (!value.date) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Follow-up date is required", path: ["date"] });
    }
    if (!value.type) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Follow-up type is required", path: ["type"] });
    }
  },
);

/** Deprecated server route; the UI logs the activity with completeFollowUpId. */
export const CompleteFollowUpSchema = z.object({
  outcome: FollowUpOutcomeEnum,
  remark: ActivityRemark,
  occurredAt: IsoDateTime.optional(),
  nextFollowUp: ScheduleFollowUpSchema.optional(),
});

export const MarkMissedSchema = z.object({
  reason: Reason,
  reschedule: ScheduleFollowUpSchema.optional(),
});

/** New date and time; type, notes, reminder and assignee carry over unless given. */
export const RescheduleFollowUpSchema = ProspectFollowUpSchema.extend({
  reason: Reason,
}).superRefine((value, ctx) => {
  if (!value.date) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "New follow-up date is required", path: ["date"] });
  }
});

export const CancelFollowUpSchema = z.object({ reason: Reason });

/** Details of a pending follow-up; date and time change only through a reschedule. */
export const EditFollowUpSchema = ProspectFollowUpSchema;

export const LogProspectActivitySchema = z
  .object({
    type: LoggableActivityTypeEnum,
    occurredAt: IsoDateTime,
    remark: ActivityRemark,
    outcome: FollowUpOutcomeEnum.optional().nullable(),
    durationMinutes: z.number().int().min(0).max(1440).optional().nullable(),
    completeFollowUpId: z.string().uuid().optional().nullable(),
    nextFollowUp: ScheduleFollowUpSchema.optional().nullable(),
    clientRequestId: z.string().uuid().optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.completeFollowUpId && value.type === "NOTE") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["type"],
        message: "A note can't complete a follow-up. Choose what happened instead.",
      });
    }
    if (value.completeFollowUpId && !value.outcome) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["outcome"],
        message: "Choose an outcome to complete the follow-up",
      });
    }
  });

export const UpdateProspectActivitySchema = z.object({
  type: LoggableActivityTypeEnum.optional(),
  occurredAt: IsoDateTime.optional(),
  remark: ActivityRemark.optional(),
  outcome: FollowUpOutcomeEnum.optional().nullable(),
  durationMinutes: z.number().int().min(0).max(1440).optional().nullable(),
});

export type TimelineCategoryFilter = "ALL" | "INTERACTIONS" | "FOLLOW_UPS" | "SYSTEM";

export type ProspectFilterInput = z.infer<typeof ProspectFilterSchema>;
export type ConvertLeadToProspectInput = z.infer<
  typeof ConvertLeadToProspectSchema
>;
export type ConvertLeadToProspectFromLeadInput = z.infer<
  typeof ConvertLeadToProspectFromLeadSchema
>;
export type UpdateProspectInput = z.infer<typeof UpdateProspectSchema>;
export type UpdateProspectStageInput = z.infer<
  typeof UpdateProspectStageSchema
>;

export type ScheduleFollowUpInput = z.infer<typeof ScheduleFollowUpSchema>;
export type CompleteFollowUpInput = z.infer<typeof CompleteFollowUpSchema>;
export type MarkMissedInput = z.infer<typeof MarkMissedSchema>;
export type RescheduleFollowUpInput = z.infer<typeof RescheduleFollowUpSchema>;
export type CancelFollowUpInput = z.infer<typeof CancelFollowUpSchema>;
export type EditFollowUpInput = z.infer<typeof EditFollowUpSchema>;
export type LogProspectActivityInput = z.infer<typeof LogProspectActivitySchema>;
export type UpdateProspectActivityInput = z.infer<
  typeof UpdateProspectActivitySchema
>;
