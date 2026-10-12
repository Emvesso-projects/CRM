/**
 * Formats a time string (e.g. "14:30", "14:30:00"), ISO date string, or Date instance
 * into a consistent clock-style format (e.g. "02:30 PM", "09:15 AM").
 */
export function formatClockTime(
  value?: string | Date | null,
  fallback = "-",
): string {
  if (!value) return fallback;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return fallback;
    const hours = value.getHours();
    const minutes = value.getMinutes();
    const period = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;
    return `${String(hour12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
  }

  const str = String(value).trim();
  if (!str) return fallback;

  // Handle standard "HH:MM" or "HH:MM:SS" time strings
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
    const [hoursStr, minutesStr = "00"] = str.split(":");
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return fallback;
    const period = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;
    return `${String(hour12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
  }

  // Handle ISO date strings or other parseable date strings
  const date = new Date(str);
  if (!Number.isNaN(date.getTime())) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const period = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;
    return `${String(hour12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
  }

  return str;
}

/**
 * Formats a Date or ISO string into a consistent date and clock-style time format (e.g. "27/08/2026, 02:30 PM").
 */
export function formatDateTime(
  value?: string | Date | null,
  fallback = "-",
): string {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  const datePart = date.toLocaleDateString("en-IN");
  const timePart = formatClockTime(date);
  return `${datePart}, ${timePart}`;
}
