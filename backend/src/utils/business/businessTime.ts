import { DateTime } from "luxon";

/**
 * Business-time helpers for follow-ups and activities.
 *
 * A follow-up is entered as a calendar date and a wall-clock time in the
 * business timezone (APP_TIMEZONE, Asia/Kolkata). It is stored as
 * `scheduledDate` (UTC midnight of that calendar date) plus `scheduledTime`
 * ("HH:mm"), and `dueAt` is the single instant every query compares against —
 * so nothing depends on the timezone of the server or of the browser.
 *
 * Every function takes the zone explicitly, so these can be unit-tested
 * without loading the application env.
 */

/**
 * Time used when a follow-up is saved without one. It is the time the reminder
 * job has always assumed for such rows, so their notification dedupe keys stay
 * the same.
 */
export const DEFAULT_FOLLOW_UP_TIME = "09:00";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isValidFollowUpTime = (value: string): boolean =>
  TIME_HH_MM.test(value);

/**
 * The instant named by a calendar date and a wall-clock time in `zone`. A
 * missing time means DEFAULT_FOLLOW_UP_TIME. Throws RangeError for input the
 * API schemas would already have rejected.
 */
export const toDueAt = (
  date: string,
  time: string | null | undefined,
  zone: string,
): Date => {
  const clock = time ?? DEFAULT_FOLLOW_UP_TIME;
  const dueAt = DateTime.fromISO(`${date}T${clock}`, { zone });

  if (!DATE_ONLY.test(date) || !isValidFollowUpTime(clock) || !dueAt.isValid) {
    throw new RangeError(`Invalid follow-up date/time: "${date}" "${clock}"`);
  }

  return dueAt.toJSDate();
};

/** A stored scheduledDate (UTC midnight of its calendar date) as "YYYY-MM-DD". */
export const toDateOnly = (scheduledDate: Date): string =>
  scheduledDate.toISOString().slice(0, 10);

/** "YYYY-MM-DD" as the UTC-midnight Date that scheduledDate stores. */
export const fromDateOnly = (date: string): Date =>
  new Date(`${date}T00:00:00.000Z`);

/**
 * dueAt for a stored follow-up. Until the contract migration a row can still
 * have it NULL (written by an older build during a deploy or rollback), so it
 * is computed the same way instead. This runs on read paths, so an unparseable
 * legacy time falls back to the default rather than throwing.
 */
export const resolveDueAt = (
  row: { dueAt?: Date | null; scheduledDate: Date; scheduledTime?: string | null },
  zone: string,
): Date => {
  if (row.dueAt) {
    return row.dueAt;
  }

  const time =
    row.scheduledTime && isValidFollowUpTime(row.scheduledTime)
      ? row.scheduledTime
      : DEFAULT_FOLLOW_UP_TIME;

  return toDueAt(toDateOnly(row.scheduledDate), time, zone);
};

/** Start of today and start of tomorrow in `zone`, as UTC instants. */
export const businessDayBounds = (
  now: Date,
  zone: string,
): { startOfToday: Date; startOfTomorrow: Date } => {
  const startOfToday = DateTime.fromJSDate(now, { zone }).startOf("day");

  return {
    startOfToday: startOfToday.toJSDate(),
    startOfTomorrow: startOfToday.plus({ days: 1 }).toJSDate(),
  };
};

/** Today's calendar date in `zone`, as "YYYY-MM-DD". */
export const businessToday = (now: Date, zone: string): string =>
  DateTime.fromJSDate(now, { zone }).toFormat("yyyy-LL-dd");

/**
 * An instant rendered in `zone`, by default like "Sat 12 Sep, 10:00 AM". The
 * locale is fixed so the text does not depend on the server's system locale.
 */
export const formatBusinessDateTime = (
  instant: Date,
  zone: string,
  format = "ccc d LLL, hh:mm a",
): string =>
  DateTime.fromJSDate(instant, { zone }).setLocale("en-US").toFormat(format);
