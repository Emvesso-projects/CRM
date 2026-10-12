import { describe, expect, it } from "vitest";
import {
  assertOccurredAt,
  canModifyActivity,
  isInteractionType,
  loggedLateMinutes,
} from "./activityPolicy";

const now = new Date("2026-09-12T12:30:00.000Z");
const minutes = (count: number) => count * 60 * 1000;
const at = (offsetMs: number) => new Date(now.getTime() + offsetMs);

describe("assertOccurredAt", () => {
  it("accepts any past time", () => {
    expect(() =>
      assertOccurredAt({ occurredAt: new Date("2025-01-01T00:00:00.000Z"), now }),
    ).not.toThrow();
  });

  it("tolerates a client clock up to two minutes ahead, but not the future", () => {
    expect(() => assertOccurredAt({ occurredAt: at(minutes(1)), now })).not.toThrow();
    expect(() => assertOccurredAt({ occurredAt: at(minutes(3)), now })).toThrow(/future/);
  });

  it("rejects an invalid date", () => {
    expect(() => assertOccurredAt({ occurredAt: new Date("nope"), now })).toThrow(/valid/);
  });

  it("accepts activities dated before a closed prospect closed, and rejects later ones", () => {
    const closedAt = at(-minutes(60));
    expect(() =>
      assertOccurredAt({ occurredAt: at(-minutes(90)), now, closedAt }),
    ).not.toThrow();
    expect(() =>
      assertOccurredAt({ occurredAt: at(-minutes(30)), now, closedAt }),
    ).toThrow(/closed/);
  });

  it("rejects completing a follow-up with a time before it was scheduled", () => {
    const notBefore = at(-minutes(10));
    expect(() =>
      assertOccurredAt({ occurredAt: at(-minutes(11)), now, notBefore }),
    ).not.toThrow();
    expect(() =>
      assertOccurredAt({ occurredAt: at(-minutes(20)), now, notBefore }),
    ).toThrow(/before the follow-up/);
  });
});

describe("loggedLateMinutes", () => {
  it("is null when logged soon after it happened", () => {
    expect(loggedLateMinutes(at(-minutes(30)), now)).toBeNull();
  });

  it("reports the gap when logged later", () => {
    expect(loggedLateMinutes(at(-minutes(8 * 60)), now)).toBe(480);
  });
});

describe("canModifyActivity", () => {
  const executive = { id: "user-1", role: "EXECUTIVE" };
  const call = (createdAt: Date, createdById = "user-1") => ({
    type: "CALL",
    createdById,
    createdAt,
    deletedAt: null,
  });

  it("lets the creator change it for 24 hours after logging", () => {
    expect(canModifyActivity(executive, call(at(-minutes(24 * 60 - 1))), now)).toBe(true);
    expect(canModifyActivity(executive, call(at(-minutes(24 * 60 + 1))), now)).toBe(false);
  });

  it("does not let other people change it", () => {
    expect(canModifyActivity(executive, call(at(-minutes(5)), "user-2"), now)).toBe(false);
    expect(
      canModifyActivity({ id: "user-3", role: "MANAGER" }, call(at(-minutes(5)), "user-2"), now),
    ).toBe(false);
  });

  it("lets admins change it at any time", () => {
    const old = call(new Date("2025-01-01T00:00:00.000Z"), "user-2");
    expect(canModifyActivity({ id: "admin", role: "ADMIN" }, old, now)).toBe(true);
    expect(canModifyActivity({ id: "root", role: "SUPER_ADMIN" }, old, now)).toBe(true);
  });

  it("never allows changing system entries or deleted activities", () => {
    const admin = { id: "admin", role: "ADMIN" };
    expect(
      canModifyActivity(admin, { ...call(at(-minutes(5))), type: "STAGE_CHANGE" }, now),
    ).toBe(false);
    expect(
      canModifyActivity(admin, { ...call(at(-minutes(5))), deletedAt: at(-minutes(1)) }, now),
    ).toBe(false);
  });
});

describe("isInteractionType", () => {
  it("covers logged types including legacy MEETING, and excludes system entries", () => {
    for (const type of ["CALL", "NOTE", "TEXT", "SITE_VISIT", "MEETING"]) {
      expect(isInteractionType(type)).toBe(true);
    }
    for (const type of ["STAGE_CHANGE", "FOLLOW_UP_SET", "FOLLOW_UP_CANCELLED", "CONVERSION"]) {
      expect(isInteractionType(type)).toBe(false);
    }
  });
});
