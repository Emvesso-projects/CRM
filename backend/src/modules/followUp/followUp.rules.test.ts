import { describe, expect, it } from "vitest";
import { fromDateOnly } from "../../utils/business/businessTime";
import {
  buildFollowUpSchedule,
  computeFollowUpHealth,
  isTodayOrLater,
  overdueCutoff,
} from "./followUp.rules";

const IST = "Asia/Kolkata";

const pending = (date: string, time: string | null) => ({
  scheduledDate: fromDateOnly(date),
  scheduledTime: time,
  dueAt: null,
});

describe("buildFollowUpSchedule", () => {
  it("stores the calendar date, the time and the IST instant", () => {
    const schedule = buildFollowUpSchedule("2026-09-12", "10:00", IST);
    expect(schedule.scheduledDate.toISOString()).toBe("2026-09-12T00:00:00.000Z");
    expect(schedule.scheduledTime).toBe("10:00");
    expect(schedule.dueAt.toISOString()).toBe("2026-09-12T04:30:00.000Z");
  });

  it("saves a follow-up without a time as due at 09:00", () => {
    const schedule = buildFollowUpSchedule("2026-09-12", null, IST);
    expect(schedule.scheduledTime).toBe("09:00");
    expect(schedule.dueAt.toISOString()).toBe("2026-09-12T03:30:00.000Z");
  });
});

describe("computeFollowUpHealth", () => {
  // 12 Sep 2026, 10:06 IST
  const now = new Date("2026-09-12T04:36:00.000Z");

  it("is NONE without a pending follow-up or on a closed prospect", () => {
    expect(computeFollowUpHealth("DEMO", null, now, IST)).toBe("NONE");
    expect(computeFollowUpHealth("WON", pending("2026-09-12", "10:00"), now, IST)).toBe("NONE");
    expect(computeFollowUpHealth("LOST", pending("2026-09-12", "10:00"), now, IST)).toBe("NONE");
  });

  it("is OVERDUE once the grace period after the due time has passed", () => {
    expect(computeFollowUpHealth("DEMO", pending("2026-09-12", "10:00"), now, IST)).toBe("OVERDUE");
    expect(computeFollowUpHealth("DEMO", pending("2026-09-11", "18:00"), now, IST)).toBe("OVERDUE");
  });

  it("is WARNING when due today and not yet overdue", () => {
    expect(computeFollowUpHealth("DEMO", pending("2026-09-12", "10:03"), now, IST)).toBe("WARNING");
    expect(computeFollowUpHealth("DEMO", pending("2026-09-12", "23:30"), now, IST)).toBe("WARNING");
  });

  it("is OK when due on a later IST day", () => {
    expect(computeFollowUpHealth("DEMO", pending("2026-09-13", "00:15"), now, IST)).toBe("OK");
  });

  it("counts days in IST, not in the server's timezone (00:30 IST)", () => {
    const earlyMorning = new Date("2026-09-11T19:00:00.000Z");
    expect(
      computeFollowUpHealth("DEMO", pending("2026-09-12", "18:00"), earlyMorning, IST),
    ).toBe("WARNING");
  });

  it("uses the stored dueAt when present", () => {
    const row = { ...pending("2026-09-20", "10:00"), dueAt: new Date("2026-09-12T03:00:00.000Z") };
    expect(computeFollowUpHealth("DEMO", row, now, IST)).toBe("OVERDUE");
  });
});

describe("isTodayOrLater", () => {
  it("compares against the IST calendar date", () => {
    const earlyMorning = new Date("2026-09-11T19:00:00.000Z"); // 12 Sep 00:30 IST
    expect(isTodayOrLater("2026-09-12", earlyMorning, IST)).toBe(true);
    expect(isTodayOrLater("2026-09-13", earlyMorning, IST)).toBe(true);
    expect(isTodayOrLater("2026-09-11", earlyMorning, IST)).toBe(false);
  });
});

describe("overdueCutoff", () => {
  it("is the grace period before now", () => {
    expect(overdueCutoff(new Date("2026-09-12T04:36:00.000Z")).toISOString()).toBe(
      "2026-09-12T04:31:00.000Z",
    );
  });
});
