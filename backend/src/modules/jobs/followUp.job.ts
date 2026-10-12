import { DateTime } from "luxon";
import { notificationService } from "../notification/notification.service";
import {
  DEFAULT_REMINDER_OFFSET_MINUTES,
  REMINDER_OFFSET_MINUTES,
} from "../../contracts/constants";
import type { CreateNotificationInput } from "../../contracts/types";
import { followUpRepository } from "../followUp/followUp.repository";
import { overdueCutoff } from "../followUp/followUp.rules";
import { env } from "../../config/env";
import { resolveDueAt as resolveStoredDueAt } from "../../utils/business/businessTime";

const MS_PER_MINUTE = 60 * 1000;

type FollowUpRow = Awaited<ReturnType<typeof followUpRepository.findDueForReminder>>[number];

/**
 * The exact UTC moment a follow-up is due: its stored dueAt, or the same
 * computation from date + time (09:00 when it has none) for a row that does
 * not have dueAt yet. Notification dedupe keys embed this value, so it must not
 * change for existing rows.
 */
export const resolveDueAt = (row: FollowUpRow, timeZone: string = env.APP_TIMEZONE): Date =>
  resolveStoredDueAt(row, timeZone);

const describe = (row: FollowUpRow) =>
  row.prospect.lead?.companyName?.trim() || row.prospect.prospectNo;

export const runFollowUpReminders = async (now: Date) => {
  const windowStart = new Date(now.getTime() - 24 * 60 * MS_PER_MINUTE);
  const windowEnd = new Date(now.getTime() + 2 * 24 * 60 * MS_PER_MINUTE);
  const followUps = await followUpRepository.findDueForReminder(windowStart, windowEnd);
  const inputs: CreateNotificationInput[] = [];

  for (const row of followUps) {
    const dueAt = resolveDueAt(row);
    const offsetMinutes =
      REMINDER_OFFSET_MINUTES[row.reminder ?? ""] ??
      DEFAULT_REMINDER_OFFSET_MINUTES;
    const remindAt = new Date(dueAt.getTime() - offsetMinutes * MS_PER_MINUTE);

    // Active Reminder Window
    if (now < remindAt || now >= dueAt) continue;

    const dueLabel = DateTime.fromJSDate(dueAt)
      .setZone(env.APP_TIMEZONE)
      .toFormat("hh:mm a");

    inputs.push({
      userId: row.assignedToId!,
      organizationId: row.organizationId,
      type: "FOLLOW_UP_DUE",
      title: "Follow-up due soon",
      body: `Your follow-up with ${describe(row)} is due at ${dueLabel}.`,
      entityType: "PROSPECT",
      entityId: row.prospectId,
      dedupeKey: `FOLLOW_UP_DUE:${row.id}:${dueAt.toISOString()}`,
    });
  }

  const created = await notificationService.createMany(inputs);
  return { created, skipped: inputs.length - created };
};

export const runFollowUpOverdue = async (now: Date, lookbackDays = 3) => {
  const windowStart = new Date(now.getTime() - lookbackDays * 24 * 60 * MS_PER_MINUTE);
  const windowEnd = new Date(now.getTime() + 24 * 60 * MS_PER_MINUTE);
  const followUps = await followUpRepository.findOverdueForNotification(windowStart, windowEnd);
  const inputs: CreateNotificationInput[] = [];

  for (const row of followUps) {
    const dueAt = resolveDueAt(row);

    // Overdue once the grace period after the due time has passed (the same
    // rule the badges and counts use), and only within the lookback window.
    if (dueAt >= overdueCutoff(now) || dueAt < windowStart) continue;

    const dueLabel = DateTime.fromJSDate(dueAt)
      .setZone(env.APP_TIMEZONE)
      .toFormat("dd MMM, hh:mm a");

    inputs.push({
      userId: row.assignedToId!,
      organizationId: row.organizationId,
      type: "FOLLOW_UP_OVERDUE",
      title: "Follow-up overdue",
      body: `Your follow-up with ${describe(row)} was due on ${dueLabel}.`,
      entityType: "PROSPECT",
      entityId: row.prospectId,
      dedupeKey: `FOLLOW_UP_OVERDUE:${row.id}:${dueAt.toISOString()}`,
    });
  }

  const created = await notificationService.createMany(inputs);
  return { created, skipped: inputs.length - created };
};
