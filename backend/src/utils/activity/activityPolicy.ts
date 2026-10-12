import {
  ACTIVITY_CLOCK_SKEW_MS,
  ACTIVITY_EDIT_WINDOW_HOURS,
  INTERACTION_ACTIVITY_TYPE_VALUES,
  LATE_LOG_THRESHOLD_MINUTES,
} from "../../contracts/constants/activity.constants";
import { AppError } from "../errors/appError";

/**
 * Rules for activities people log (calls, meetings, notes, …), shared by
 * prospect and lead activities. No database or env access.
 */

const MS_PER_MINUTE = 60 * 1000;
const INTERACTION_TYPES = new Set<string>(INTERACTION_ACTIVITY_TYPE_VALUES);
const ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN"]);

/** Interactions are logged by people; everything else is a system entry. */
export const isInteractionType = (type: string): boolean => INTERACTION_TYPES.has(type);

/**
 * When an activity says it happened. Any past time is fine; the future is not
 * (beyond a small allowance for a client clock running ahead).
 *
 * - closedAt: a won/lost prospect accepts only activities from before it closed.
 * - notBefore: completing a follow-up cannot be dated before the follow-up existed.
 */
export const assertOccurredAt = ({
  occurredAt,
  now,
  closedAt,
  notBefore,
}: {
  occurredAt: Date;
  now: Date;
  closedAt?: Date | null;
  notBefore?: Date | null;
}) => {
  if (Number.isNaN(occurredAt.getTime())) {
    throw AppError.validation.badRequest("Enter a valid date and time for when it happened");
  }
  if (occurredAt.getTime() > now.getTime() + ACTIVITY_CLOCK_SKEW_MS) {
    throw AppError.validation.badRequest("When it happened can't be in the future");
  }
  if (closedAt && occurredAt.getTime() > closedAt.getTime()) {
    throw AppError.business.ruleViolation(
      "This prospect was closed before that time. Only activities from before it was closed can be logged.",
    );
  }
  if (notBefore && occurredAt.getTime() < notBefore.getTime() - ACTIVITY_CLOCK_SKEW_MS) {
    throw AppError.business.ruleViolation(
      "This happened before the follow-up was scheduled. Log it without completing the follow-up.",
    );
  }
};

/** Minutes between happening and being logged, when that is long enough to show. */
export const loggedLateMinutes = (occurredAt: Date, createdAt: Date): number | null => {
  const minutes = Math.floor((createdAt.getTime() - occurredAt.getTime()) / MS_PER_MINUTE);
  return minutes > LATE_LOG_THRESHOLD_MINUTES ? minutes : null;
};

/**
 * Who may edit or delete an activity: its creator for 24 hours after logging
 * it, and admins at any time. System entries are never editable.
 */
export const canModifyActivity = (
  user: { id: string; role: string },
  activity: {
    type: string;
    createdById: string | null;
    createdAt: Date;
    deletedAt?: Date | null;
  },
  now: Date,
): boolean => {
  if (activity.deletedAt || !isInteractionType(activity.type)) {
    return false;
  }
  if (ADMIN_ROLES.has(user.role)) {
    return true;
  }
  return (
    activity.createdById === user.id &&
    now.getTime() - activity.createdAt.getTime() <=
      ACTIVITY_EDIT_WINDOW_HOURS * 60 * MS_PER_MINUTE
  );
};
