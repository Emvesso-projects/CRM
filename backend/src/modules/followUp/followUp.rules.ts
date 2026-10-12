import { FOLLOW_UP_OVERDUE_GRACE_MINUTES } from "../../contracts/constants/activity.constants";
import type { Prospect } from "../../contracts/types";
import {
  businessDayBounds,
  businessToday,
  DEFAULT_FOLLOW_UP_TIME,
  fromDateOnly,
  resolveDueAt,
  toDueAt,
} from "../../utils/business/businessTime";

/**
 * Follow-up scheduling rules with no database or env access, so every screen
 * and job applies the same definitions and they can be unit-tested directly.
 * Callers pass the business timezone (env.APP_TIMEZONE).
 */

const MS_PER_MINUTE = 60 * 1000;

type ScheduledFollowUp = {
  dueAt?: Date | null;
  scheduledDate: Date;
  scheduledTime?: string | null;
};

/** Pending follow-ups due before this instant are overdue. */
export const overdueCutoff = (now: Date): Date =>
  new Date(now.getTime() - FOLLOW_UP_OVERDUE_GRACE_MINUTES * MS_PER_MINUTE);

/**
 * The stored schedule for a follow-up entered as a calendar date and an
 * optional time. A missing time means DEFAULT_FOLLOW_UP_TIME, so every row has
 * one and dueAt is always exact.
 */
export const buildFollowUpSchedule = (
  date: string,
  time: string | null | undefined,
  zone: string,
): { scheduledDate: Date; scheduledTime: string; dueAt: Date } => {
  const scheduledTime = time || DEFAULT_FOLLOW_UP_TIME;

  return {
    scheduledDate: fromDateOnly(date),
    scheduledTime,
    dueAt: toDueAt(date, scheduledTime, zone),
  };
};

/** Whether a "YYYY-MM-DD" date is today or later in the business timezone. */
export const isTodayOrLater = (date: string, now: Date, zone: string): boolean =>
  date >= businessToday(now, zone);

/**
 * Health of a prospect's pending follow-up:
 * - OVERDUE: the grace period after its due time has passed;
 * - WARNING: due today (in the business timezone) and not yet overdue;
 * - OK: due on a later day;
 * - NONE: no pending follow-up, or the prospect is closed.
 */
export const computeFollowUpHealth = (
  stage: Prospect["stage"],
  followUp: ScheduledFollowUp | null | undefined,
  now: Date,
  zone: string,
): NonNullable<Prospect["followUpHealth"]> => {
  if (stage === "WON" || stage === "LOST" || !followUp) {
    return "NONE";
  }

  const dueAt = resolveDueAt(followUp, zone);

  if (dueAt.getTime() < overdueCutoff(now).getTime()) {
    return "OVERDUE";
  }

  const { startOfTomorrow } = businessDayBounds(now, zone);
  return dueAt.getTime() < startOfTomorrow.getTime() ? "WARNING" : "OK";
};

/**
 * Where a pending follow-up due at `dueAt` stands: OVERDUE once the grace
 * period has passed, DUE_TODAY while it is due today (business timezone),
 * UPCOMING after that.
 */
export const followUpDueState = (
  dueAt: Date,
  now: Date,
  zone: string,
): "OVERDUE" | "DUE_TODAY" | "UPCOMING" => {
  if (dueAt.getTime() < overdueCutoff(now).getTime()) {
    return "OVERDUE";
  }

  const { startOfTomorrow } = businessDayBounds(now, zone);
  return dueAt.getTime() < startOfTomorrow.getTime() ? "DUE_TODAY" : "UPCOMING";
};
