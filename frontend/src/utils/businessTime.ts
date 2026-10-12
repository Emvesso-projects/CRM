import { DateTime } from "luxon";
import {
  ACTIVITY_CLOCK_SKEW_MS,
  FOLLOW_UP_OVERDUE_GRACE_MINUTES,
} from "@/contracts/constants";
import type { FollowUpDueState } from "@/contracts/types";

/**
 * Every date and time a person enters or reads is in the business timezone
 * (the backend's APP_TIMEZONE), whatever timezone the browser is in, so a
 * follow-up "due 10:00 AM" is the same moment on every screen.
 */
export const BUSINESS_TIMEZONE =
  import.meta.env.VITE_APP_TIMEZONE?.trim() || "Asia/Kolkata";

const LOCALE = "en-US";
const MS_PER_MINUTE = 60_000;

/** A date ("yyyy-MM-dd") and time ("HH:mm") as a form holds them. */
export type DateTimeParts = { date: string; time: string };

export type TimePreset = DateTimeParts & { label: string };

const inBusinessZone = (value: string | Date | number | DateTime) => {
  const dt =
    typeof value === "string"
      ? DateTime.fromISO(value)
      : typeof value === "number"
        ? DateTime.fromMillis(value)
        : value instanceof Date
          ? DateTime.fromJSDate(value)
          : value;
  return dt.setZone(BUSINESS_TIMEZONE).setLocale(LOCALE);
};

/** The current moment in the business timezone. */
export const businessNow = (now: number = Date.now()) => inBusinessZone(now);

/** Today's business date as "yyyy-MM-dd", for date inputs. */
export const businessToday = (now: number = Date.now()) =>
  businessNow(now).toISODate() ?? "";

/** The business date and "HH:mm" time of an instant. */
export const toBusinessParts = (
  value: string | Date | number | DateTime,
): DateTimeParts => {
  const dt = inBusinessZone(value);
  return dt.isValid
    ? { date: dt.toISODate() ?? "", time: dt.toFormat("HH:mm") }
    : { date: "", time: "" };
};

/** A form's date and time read in the business timezone; null when incomplete. */
export const fromBusinessParts = ({ date, time }: DateTimeParts) => {
  if (!date || !time) return null;
  const dt = DateTime.fromISO(`${date}T${time}`, { zone: BUSINESS_TIMEZONE });
  return dt.isValid ? dt : null;
};

export const samePartsAs = (a: DateTimeParts, b: DateTimeParts) =>
  a.date === b.date && a.time === b.time;

/**
 * The instant to send for a form's date and time (UTC ISO). A time in the
 * current minute is sent as the exact current instant, so "just now" is never
 * earlier than something that happened seconds ago.
 */
export const toApiInstant = (
  parts: DateTimeParts,
  now: number = Date.now(),
): string | null => {
  const dt = fromBusinessParts(parts);
  if (!dt) return null;
  const moment = samePartsAs(parts, toBusinessParts(now))
    ? DateTime.fromMillis(now)
    : dt;
  return moment.toUTC().toISO();
};

const formatWith = (
  value: string | Date | null | undefined,
  pattern: string,
  fallback: string,
) => {
  if (!value) return fallback;
  const dt = inBusinessZone(value);
  return dt.isValid ? dt.toFormat(pattern) : fallback;
};

/** "12 Sep 2026" */
export const formatBusinessDate = (value?: string | Date | null, fallback = "-") =>
  formatWith(value, "d LLL yyyy", fallback);

/** "10:00 AM" */
export const formatBusinessTime = (value?: string | Date | null, fallback = "-") =>
  formatWith(value, "hh:mm a", fallback);

/** "Sat 12 Sep, 10:00 AM", with the year when it isn't this year. */
export const formatBusinessDateTime = (
  value?: string | Date | null,
  fallback = "-",
) => {
  if (!value) return fallback;
  const dt = inBusinessZone(value);
  if (!dt.isValid) return fallback;
  return dt.toFormat(
    dt.year === businessNow().year ? "ccc d LLL, hh:mm a" : "ccc d LLL yyyy, hh:mm a",
  );
};

/** "Today", "Yesterday", "Tomorrow" or "Mon 8 Sep" for the business day of an instant. */
export const businessDayLabel = (value: string | Date, now: number = Date.now()) => {
  const day = inBusinessZone(value).startOf("day");
  const today = businessNow(now).startOf("day");
  const offset = Math.round(day.diff(today, "days").days);
  if (offset === 0) return "Today";
  if (offset === -1) return "Yesterday";
  if (offset === 1) return "Tomorrow";
  return day.toFormat(day.year === today.year ? "ccc d LLL" : "ccc d LLL yyyy");
};

/** "45m", "2h 15m", "8h", "1d 4h", "6d". */
export const formatDuration = (minutes: number) => {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total}m`;
  const hours = Math.floor(total / 60);
  if (hours < 24) {
    const rest = total % 60;
    return hours < 3 && rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return days < 3 && restHours > 0 ? `${days}d ${restHours}h` : `${days}d`;
};

export const isPast = (value: string, now: number = Date.now()) =>
  inBusinessZone(value).toMillis() <= now;

/** Due (or done) earlier today, in business days. */
export const isEarlierToday = (value: string, now: number = Date.now()) => {
  const dt = inBusinessZone(value);
  return dt.toMillis() <= now && dt.hasSame(businessNow(now), "day");
};

/**
 * Where a pending follow-up stands; the backend applies the same rule. It is
 * overdue once the grace period after its due time has passed.
 */
export const followUpDueState = (
  dueAt: string,
  now: number = Date.now(),
): FollowUpDueState => {
  const due = inBusinessZone(dueAt);
  if (due.toMillis() < now - FOLLOW_UP_OVERDUE_GRACE_MINUTES * MS_PER_MINUTE) {
    return "OVERDUE";
  }
  return due.toMillis() <= now || due.hasSame(businessNow(now), "day")
    ? "DUE_TODAY"
    : "UPCOMING";
};

/** A short status for a pending follow-up: "Overdue 8h", "Due in 40m", "Tomorrow, 10:00 AM". */
export const describeDue = (
  dueAt: string,
  now: number = Date.now(),
): { state: FollowUpDueState; label: string } => {
  const state = followUpDueState(dueAt, now);
  const minutesUntil = (inBusinessZone(dueAt).toMillis() - now) / MS_PER_MINUTE;

  if (state === "OVERDUE") {
    return { state, label: `Overdue ${formatDuration(-minutesUntil)}` };
  }
  if (state === "DUE_TODAY") {
    if (minutesUntil <= 0) return { state, label: "Due now" };
    if (minutesUntil < 120) return { state, label: `Due in ${formatDuration(minutesUntil)}` };
    return { state, label: `Due today, ${formatBusinessTime(dueAt)}` };
  }
  return businessDayLabel(dueAt, now) === "Tomorrow"
    ? { state, label: `Tomorrow, ${formatBusinessTime(dueAt)}` }
    : { state, label: `Due ${formatBusinessDate(dueAt)}` };
};

/**
 * Why a "when it happened" value can't be saved, or null. Mirrors the server:
 * not in the future, not after a closed prospect closed, and not before the
 * follow-up it completes was scheduled.
 */
export const occurredAtProblem = (
  parts: DateTimeParts,
  limits: { closedAt?: string | null; notBefore?: string | null } = {},
  now: number = Date.now(),
): string | null => {
  const dt = fromBusinessParts(parts);
  if (!dt) return "Enter the date and time it happened";

  const millis = dt.toMillis();
  if (millis > now + ACTIVITY_CLOCK_SKEW_MS) {
    return "When it happened can't be in the future";
  }
  if (limits.closedAt && millis > inBusinessZone(limits.closedAt).toMillis()) {
    return `This prospect closed on ${formatBusinessDateTime(limits.closedAt)}. Choose a time before that.`;
  }
  if (
    limits.notBefore &&
    millis < inBusinessZone(limits.notBefore).toMillis() - ACTIVITY_CLOCK_SKEW_MS
  ) {
    return `The follow-up was only scheduled on ${formatBusinessDateTime(limits.notBefore)}. Choose a later time, or keep the follow-up scheduled.`;
  }
  return null;
};

/** Why a follow-up date and time can't be scheduled, or null. It must be in the future. */
export const followUpScheduleProblem = (
  parts: DateTimeParts,
  now: number = Date.now(),
): string | null => {
  if (!parts.date) return "Choose a date";
  if (!parts.time) return "Choose a time";
  const dt = fromBusinessParts(parts);
  if (!dt) return "Enter a valid date and time";
  if (dt.toMillis() <= now) return "Choose a date and time in the future";
  return null;
};

/** One-click follow-up times in the business timezone. */
export const followUpPresets = (now: number = Date.now()): TimePreset[] => {
  const current = businessNow(now);
  const at = (label: string, day: DateTime, time: string): TimePreset => ({
    label,
    date: day.toISODate() ?? "",
    time,
  });

  const presets: TimePreset[] = [];
  if (current.hour < 17) {
    // Two hours from now, rounded up to the next half hour.
    const inTwoHours = current.plus({ hours: 2 });
    const roundUp = inTwoHours.minute === 0 ? 0 : inTwoHours.minute <= 30 ? 30 : 60;
    const later = inTwoHours.startOf("hour").plus({ minutes: roundUp });
    presets.push(at(`Today ${later.toFormat("h:mm a")}`, later, later.toFormat("HH:mm")));
  }
  const tomorrow = current.plus({ days: 1 });
  presets.push(at("Tomorrow 10 AM", tomorrow, "10:00"));
  presets.push(at("Tomorrow 3 PM", tomorrow, "15:00"));
  presets.push(at("In 2 days, 10 AM", current.plus({ days: 2 }), "10:00"));
  presets.push(
    at("Next Monday 10 AM", current.plus({ days: (8 - current.weekday) % 7 || 7 }), "10:00"),
  );
  return presets;
};

/** Quick picks for when something happened. */
export const occurredAtPresets = (now: number = Date.now()): TimePreset[] => {
  const current = businessNow(now);
  const hourAgo = current.minus({ hours: 1 });
  return [
    { label: "Just now", ...toBusinessParts(current) },
    {
      label: "1 hour ago",
      ...toBusinessParts(hourAgo.set({ minute: Math.floor(hourAgo.minute / 5) * 5 })),
    },
  ];
};
