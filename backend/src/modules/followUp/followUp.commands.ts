import {
  ProspectActivityType,
  Role,
  type ProspectFollowUpType,
  type ProspectReminder,
} from "@prisma/client";
import { env } from "../../config/env";
import type { DB } from "../../config/db";
import type { SafeUser } from "../../types/user.types";
import { formatBusinessDateTime } from "../../utils/business/businessTime";
import { AppError } from "../../utils/errors/appError";
import { validateLeadAssignee } from "../lead/lead.validation";
import { prospectRepository } from "../prospect/prospect.repository";
import { followUpRepository } from "./followUp.repository";
import { buildFollowUpSchedule, isTodayOrLater } from "./followUp.rules";

/**
 * Database steps shared by the follow-up and activity services. Always called
 * inside the caller's transaction.
 */

/** A follow-up may be saved this long after its due time (a slow form submit). */
const PAST_TOLERANCE_MS = 60 * 1000;

export type FollowUpScheduleData = {
  date?: string | null;
  time?: string | null;
  type?: string | null;
  notes?: string | null;
  reminder?: string | null;
  assignedToId?: string | null;
};

/** A due time as people read it, e.g. "Sat 12 Sep, 10:00 AM" in APP_TIMEZONE. */
export const formatDue = (dueAt: Date) =>
  formatBusinessDateTime(dueAt, env.APP_TIMEZONE);

/**
 * Creates the prospect's next pending follow-up. Only one PENDING follow-up is
 * allowed per prospect (partial unique index), so callers close the previous
 * one first; a concurrent attempt surfaces as a unique-constraint error.
 *
 * `when`: "future" for anything a person schedules now (its due time must not
 * have passed); "today" keeps the looser rule used by lead conversion.
 */
export const createPendingFollowUp = async (
  tx: DB,
  input: {
    prospectId: string;
    organizationId: string;
    data: FollowUpScheduleData;
    user: SafeUser;
    defaultAssigneeId?: string | null;
    when?: "future" | "today";
  },
) => {
  const { prospectId, organizationId, data, user, defaultAssigneeId, when = "future" } = input;

  if (!data.date) {
    throw AppError.validation.fieldRequired("Follow-up date");
  }
  if (!data.type) {
    throw AppError.validation.fieldRequired("Follow-up type");
  }

  let schedule: ReturnType<typeof buildFollowUpSchedule>;
  try {
    schedule = buildFollowUpSchedule(data.date, data.time, env.APP_TIMEZONE);
  } catch {
    throw AppError.validation.badRequest("Enter a valid follow-up date and time");
  }

  const now = new Date();
  if (when === "future" && schedule.dueAt.getTime() < now.getTime() - PAST_TOLERANCE_MS) {
    throw AppError.validation.badRequest("Choose a follow-up date and time in the future");
  }
  if (when === "today" && !isTodayOrLater(data.date, now, env.APP_TIMEZONE)) {
    throw AppError.validation.badRequest("Follow-up date must be today or in the future");
  }

  // A super admin working inside an organization is not one of its members, so
  // never becomes a follow-up's assignee.
  const isOutsider = (id: string | null) => id === user.id && user.role === Role.SUPER_ADMIN;

  const requested = data.assignedToId || null;
  // The default (the assignee carried over, or the prospect's owner) was accepted
  // when it was set; only a different person is checked.
  if (requested && requested !== defaultAssigneeId && !isOutsider(requested)) {
    await validateLeadAssignee(requested, organizationId, user);
  }
  const assignee = requested ?? defaultAssigneeId ?? null;

  return followUpRepository.create(
    {
      prospectId,
      organizationId,
      ...schedule,
      type: data.type as ProspectFollowUpType,
      notes: data.notes?.trim() || null,
      reminder: (data.reminder as ProspectReminder | null | undefined) ?? null,
      // Without an assignee nobody gets a reminder.
      assignedToId: isOutsider(assignee) ? null : assignee,
      createdById: user.id,
    },
    tx,
  );
};

type FollowUpEventType =
  | "FOLLOW_UP_SET"
  | "FOLLOW_UP_RESCHEDULED"
  | "FOLLOW_UP_CANCELLED";

/** Timeline entry describing a change to a follow-up. */
export const logFollowUpEvent = (
  tx: DB,
  event: {
    prospectId: string;
    followUpId: string;
    userId: string | null;
    type: FollowUpEventType;
    title: string;
    summary: string;
    details?: string | null;
    metadata?: Record<string, string | null>;
  },
) =>
  prospectRepository.createActivity(
    {
      prospectId: event.prospectId,
      followUpId: event.followUpId,
      type: ProspectActivityType[event.type],
      title: event.title,
      summary: event.summary,
      details: event.details ?? null,
      ...(event.metadata ? { metadata: event.metadata } : {}),
      occurredAt: new Date(),
      createdById: event.userId,
    },
    tx,
  );
