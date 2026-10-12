/**
 * Mirrors backend/src/contracts/constants/activity.constants.ts — keep the two in sync.
 */

/**
 * Interaction types a person can log by hand. Everything else (conversion,
 * stage changes, follow-up events, quotations) is written by the system.
 */
export const LOGGABLE_ACTIVITY_TYPE_VALUES = [
  "CALL",
  "IN_PERSON_MEETING",
  "VIRTUAL_MEETING",
  "EMAIL",
  "WHATSAPP",
  "TEXT",
  "SITE_VISIT",
  "NOTE",
] as const;

/** Every interaction type, including legacy MEETING, which older rows still use. */
export const INTERACTION_ACTIVITY_TYPE_VALUES = [
  ...LOGGABLE_ACTIVITY_TYPE_VALUES,
  "MEETING",
] as const;

export const ACTIVITY_TYPE_LABELS: Record<
  (typeof INTERACTION_ACTIVITY_TYPE_VALUES)[number],
  string
> = {
  CALL: "Call",
  IN_PERSON_MEETING: "In-person meeting",
  VIRTUAL_MEETING: "Virtual meeting",
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
  TEXT: "SMS / Text",
  SITE_VISIT: "Site visit",
  NOTE: "Note",
  MEETING: "Meeting",
};

/** How long the person who logged an activity may still edit or delete it. */
export const ACTIVITY_EDIT_WINDOW_HOURS = 24;

/** An activity logged more than this long after it happened shows as "logged late". */
export const LATE_LOG_THRESHOLD_MINUTES = 30;

/** Tolerance for a client clock slightly ahead of the server when refusing future times. */
export const ACTIVITY_CLOCK_SKEW_MS = 2 * 60 * 1000;

/** A pending follow-up counts as overdue this long after it was due. */
export const FOLLOW_UP_OVERDUE_GRACE_MINUTES = 5;

/** Time a follow-up gets when saved without one. */
export const DEFAULT_FOLLOW_UP_TIME = "09:00";
