import { describe, expect, it } from "vitest";
import {
  businessDayBounds,
  businessToday,
  DEFAULT_FOLLOW_UP_TIME,
  formatBusinessDateTime,
  fromDateOnly,
  resolveDueAt,
  toDateOnly,
  toDueAt,
} from "./businessTime";

const IST = "Asia/Kolkata";

describe("toDueAt", () => {
  it("reads the date and time as wall-clock time in the zone", () => {
    expect(toDueAt("2026-09-12", "10:00", IST).toISOString()).toBe(
      "2026-09-12T04:30:00.000Z",
    );
  });

  it("uses 09:00 when no time is given", () => {
    expect(DEFAULT_FOLLOW_UP_TIME).toBe("09:00");
    expect(toDueAt("2026-09-12", null, IST).toISOString()).toBe(
      "2026-09-12T03:30:00.000Z",
    );
  });

  it("handles an early-morning IST time that is still the previous day in UTC", () => {
    expect(toDueAt("2026-09-12", "02:15", IST).toISOString()).toBe(
      "2026-09-11T20:45:00.000Z",
    );
  });

  it("rejects input the API schemas would not accept", () => {
    expect(() => toDueAt("2026-02-30", "10:00", IST)).toThrow(RangeError);
    expect(() => toDueAt("12-09-2026", "10:00", IST)).toThrow(RangeError);
    expect(() => toDueAt("2026-09-12", "10:00 AM", IST)).toThrow(RangeError);
    expect(() => toDueAt("2026-09-12", "24:00", IST)).toThrow(RangeError);
  });

  it("follows daylight saving in zones that have it", () => {
    expect(toDueAt("2026-09-12", "10:00", "America/New_York").toISOString()).toBe(
      "2026-09-12T14:00:00.000Z",
    );
    expect(toDueAt("2026-12-12", "10:00", "America/New_York").toISOString()).toBe(
      "2026-12-12T15:00:00.000Z",
    );
  });
});

describe("resolveDueAt", () => {
  const scheduledDate = fromDateOnly("2026-09-12");

  it("prefers the stored dueAt", () => {
    const dueAt = new Date("2026-01-01T00:00:00.000Z");
    expect(resolveDueAt({ dueAt, scheduledDate, scheduledTime: "10:00" }, IST)).toBe(
      dueAt,
    );
  });

  it("computes it from the schedule while dueAt is still NULL", () => {
    expect(
      resolveDueAt({ dueAt: null, scheduledDate, scheduledTime: "10:00" }, IST).toISOString(),
    ).toBe("2026-09-12T04:30:00.000Z");
  });

  it("falls back to 09:00 for a missing or unparseable legacy time instead of throwing", () => {
    expect(resolveDueAt({ scheduledDate, scheduledTime: null }, IST).toISOString()).toBe(
      "2026-09-12T03:30:00.000Z",
    );
    expect(resolveDueAt({ scheduledDate, scheduledTime: "10 AM" }, IST).toISOString()).toBe(
      "2026-09-12T03:30:00.000Z",
    );
  });
});

describe("date-only values", () => {
  it("store a calendar date as UTC midnight and read it back", () => {
    const stored = fromDateOnly("2026-09-12");
    expect(stored.toISOString()).toBe("2026-09-12T00:00:00.000Z");
    expect(toDateOnly(stored)).toBe("2026-09-12");
  });
});

describe("business day", () => {
  it("is the IST day even when the UTC date is still yesterday (00:30 IST)", () => {
    const now = new Date("2026-09-11T19:00:00.000Z");
    expect(businessToday(now, IST)).toBe("2026-09-12");

    const { startOfToday, startOfTomorrow } = businessDayBounds(now, IST);
    expect(startOfToday.toISOString()).toBe("2026-09-11T18:30:00.000Z");
    expect(startOfTomorrow.toISOString()).toBe("2026-09-12T18:30:00.000Z");
  });

  it("is still the same IST day at 23:59 IST", () => {
    const now = new Date("2026-09-12T18:29:00.000Z");
    expect(businessToday(now, IST)).toBe("2026-09-12");
    expect(businessDayBounds(now, IST).startOfToday.toISOString()).toBe(
      "2026-09-11T18:30:00.000Z",
    );
  });
});

describe("formatBusinessDateTime", () => {
  it("renders the instant in the business timezone", () => {
    expect(formatBusinessDateTime(new Date("2026-09-12T04:30:00.000Z"), IST)).toBe(
      "Sat 12 Sep, 10:00 AM",
    );
  });
});
