import {
  FollowUpStatus,
  type Prisma,
  type ProspectFollowUpType,
  type ProspectReminder,
} from "@prisma/client";
import { env } from "../../config/env";
import { DB, prisma } from "../../config/db";
import type {
  CancelFollowUpInput,
  EditFollowUpInput,
  MarkMissedInput,
  RescheduleFollowUpInput,
  ScheduleFollowUpInput,
} from "../../contracts/validation";
import type { FollowUp } from "../../contracts/types";
import type { SafeUser } from "../../types/user.types";
import {
  DEFAULT_FOLLOW_UP_TIME,
  resolveDueAt,
  toDateOnly,
} from "../../utils/business/businessTime";
import { AppError } from "../../utils/errors/appError";
import { isPrismaUniqueError } from "../../utils/errors/typeGuards";
import { ensureOwnership } from "../../utils/security/ownership.utils";
import { validateLeadAssignee } from "../lead/lead.validation";
import { prospectRepository } from "../prospect/prospect.repository";
import { createPendingFollowUp, formatDue, logFollowUpEvent } from "./followUp.commands";
import { mapFollowUpToResponse } from "./followUp.mapper";
import { followUpRepository } from "./followUp.repository";

export { mapFollowUpToResponse } from "./followUp.mapper";

const ALREADY_SCHEDULED =
  "A follow-up is already scheduled for this prospect. Reschedule or complete it instead.";
const NO_LONGER_PENDING =
  "This follow-up was already completed, rescheduled or cancelled. Refresh to see the latest.";

const getProspectForRead = async (
  prospectId: string,
  organizationId: string,
  user: SafeUser,
  tx?: DB,
) => {
  const prospect = await prospectRepository.findById(prospectId, organizationId, tx);
  if (!prospect) throw AppError.resource.notFound("Prospect");
  ensureOwnership(user, prospect);
  return prospect;
};

const getProspectForAction = async (
  prospectId: string,
  organizationId: string,
  user: SafeUser,
  tx?: DB,
) => {
  const prospect = await getProspectForRead(prospectId, organizationId, user, tx);
  if (prospect.stage === "WON" || prospect.stage === "LOST") {
    throw AppError.business.stateConflict("Won or lost prospects cannot have follow-ups");
  }
  return prospect;
};

const getPendingFollowUp = async (
  tx: DB,
  prospectId: string,
  followUpId: string,
  organizationId: string,
) => {
  const followUp = await followUpRepository.findById(followUpId, organizationId, tx);
  if (!followUp || followUp.prospectId !== prospectId) {
    throw AppError.resource.notFound("Follow-up");
  }
  if (followUp.status !== FollowUpStatus.PENDING) {
    throw AppError.business.stateConflict(NO_LONGER_PENDING);
  }
  return followUp;
};

/** Conditional update: fails if someone else changed the follow-up first. */
const updateWhilePending = async (
  tx: DB,
  followUpId: string,
  organizationId: string,
  data: Prisma.FollowUpUncheckedUpdateManyInput,
) => {
  const result = await followUpRepository.updatePending(followUpId, organizationId, data, tx);
  if (result.count === 0) {
    throw AppError.business.stateConflict(NO_LONGER_PENDING);
  }
};

/** Only one PENDING follow-up is allowed per prospect (partial unique index). */
const guardSinglePending = async <T>(run: () => Promise<T>): Promise<T> => {
  try {
    return await run();
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      throw AppError.business.stateConflict(ALREADY_SCHEDULED);
    }
    throw error;
  }
};

const reasonOf = (reason?: string | null) => reason?.trim() || null;

const dueOf = (followUp: Parameters<typeof resolveDueAt>[0]) =>
  resolveDueAt(followUp, env.APP_TIMEZONE);

export const followUpService = {
  scheduleFollowUp: (
    prospectId: string,
    data: ScheduleFollowUpInput,
    user: SafeUser,
    organizationId: string,
  ): Promise<FollowUp> =>
    guardSinglePending(async () => {
      const created = await prisma.$transaction(async (tx) => {
        const prospect = await getProspectForAction(prospectId, organizationId, user, tx);
        if (await followUpRepository.findActiveByProspectId(prospectId, organizationId, tx)) {
          throw AppError.business.stateConflict(ALREADY_SCHEDULED);
        }

        const next = await createPendingFollowUp(tx, {
          prospectId,
          organizationId,
          data,
          user,
          defaultAssigneeId: prospect.assignedToId ?? user.id,
        });
        const dueAt = dueOf(next);
        await logFollowUpEvent(tx, {
          prospectId,
          followUpId: next.id,
          userId: user.id,
          type: "FOLLOW_UP_SET",
          title: "Follow-up scheduled",
          summary: `Follow-up scheduled for ${formatDue(dueAt)}`,
          details: next.notes,
          metadata: { dueAt: dueAt.toISOString() },
        });
        return next;
      });
      return mapFollowUpToResponse(created);
    }),

  /** Deprecated: no UI. Kept for external callers. */
  markMissed: (
    prospectId: string,
    followUpId: string,
    data: MarkMissedInput,
    user: SafeUser,
    organizationId: string,
  ): Promise<FollowUp> =>
    guardSinglePending(async () => {
      const result = await prisma.$transaction(async (tx) => {
        const prospect = await getProspectForAction(prospectId, organizationId, user, tx);
        const followUp = await getPendingFollowUp(tx, prospectId, followUpId, organizationId);
        const reason = reasonOf(data.reason);

        // missedReason is still written until the contract migration drops it,
        // so a rollback to a build that reads it sees the same value.
        if (data.reschedule) {
          await updateWhilePending(tx, followUpId, organizationId, {
            status: FollowUpStatus.RESCHEDULED,
            missedReason: reason,
            statusReason: reason,
          });
          const successor = await createPendingFollowUp(tx, {
            prospectId,
            organizationId,
            data: data.reschedule,
            user,
            defaultAssigneeId: followUp.assignedToId ?? prospect.assignedToId ?? user.id,
          });
          await followUpRepository.update(followUpId, { rescheduledToId: successor.id }, tx);
          const from = dueOf(followUp);
          const to = dueOf(successor);
          await logFollowUpEvent(tx, {
            prospectId,
            followUpId,
            userId: user.id,
            type: "FOLLOW_UP_RESCHEDULED",
            title: "Follow-up missed and rescheduled",
            summary: `Missed; rescheduled from ${formatDue(from)} to ${formatDue(to)}`,
            details: reason,
            metadata: {
              fromDueAt: from.toISOString(),
              toDueAt: to.toISOString(),
              newFollowUpId: successor.id,
            },
          });
          return successor;
        }

        await updateWhilePending(tx, followUpId, organizationId, {
          status: FollowUpStatus.MISSED,
          missedReason: reason,
          statusReason: reason,
        });
        await logFollowUpEvent(tx, {
          prospectId,
          followUpId,
          userId: user.id,
          type: "FOLLOW_UP_CANCELLED",
          title: "Follow-up missed",
          summary: reason ? `Marked as missed: ${reason}` : "Marked as missed",
          details: reason,
        });
        return (await followUpRepository.findById(followUpId, organizationId, tx))!;
      });
      return mapFollowUpToResponse(result);
    }),

  /**
   * Moves a pending follow-up to a new date and time. The old one is kept as
   * RESCHEDULED (with the reason) and linked to the new pending one, which
   * inherits type, notes, reminder and assignee unless new values are given.
   * Returns the new pending follow-up.
   */
  rescheduleFollowUp: (
    prospectId: string,
    followUpId: string,
    data: RescheduleFollowUpInput,
    user: SafeUser,
    organizationId: string,
  ): Promise<FollowUp> =>
    guardSinglePending(async () => {
      const successor = await prisma.$transaction(async (tx) => {
        const prospect = await getProspectForAction(prospectId, organizationId, user, tx);
        const followUp = await getPendingFollowUp(tx, prospectId, followUpId, organizationId);
        const reason = reasonOf(data.reason);

        await updateWhilePending(tx, followUpId, organizationId, {
          status: FollowUpStatus.RESCHEDULED,
          statusReason: reason,
        });

        const next = await createPendingFollowUp(tx, {
          prospectId,
          organizationId,
          user,
          data: {
            date: data.date,
            time: data.time,
            type: data.type ?? followUp.type,
            notes: data.notes !== undefined ? data.notes : followUp.notes,
            reminder: data.reminder !== undefined ? data.reminder : followUp.reminder,
            // A new assignee is checked; the current one carries over as the default.
            assignedToId: data.assignedToId ?? null,
          },
          defaultAssigneeId: followUp.assignedToId ?? prospect.assignedToId ?? user.id,
        });
        await followUpRepository.update(followUpId, { rescheduledToId: next.id }, tx);

        const from = dueOf(followUp);
        const to = dueOf(next);
        await logFollowUpEvent(tx, {
          prospectId,
          followUpId,
          userId: user.id,
          type: "FOLLOW_UP_RESCHEDULED",
          title: "Follow-up rescheduled",
          summary: `Rescheduled from ${formatDue(from)} to ${formatDue(to)}`,
          details: reason,
          metadata: {
            fromDueAt: from.toISOString(),
            toDueAt: to.toISOString(),
            newFollowUpId: next.id,
          },
        });
        return next;
      });
      return mapFollowUpToResponse(successor);
    }),

  cancelFollowUp: async (
    prospectId: string,
    followUpId: string,
    data: CancelFollowUpInput,
    user: SafeUser,
    organizationId: string,
  ): Promise<FollowUp> => {
    const cancelled = await prisma.$transaction(async (tx) => {
      await getProspectForAction(prospectId, organizationId, user, tx);
      await getPendingFollowUp(tx, prospectId, followUpId, organizationId);
      const reason = reasonOf(data.reason);

      await updateWhilePending(tx, followUpId, organizationId, {
        status: FollowUpStatus.CANCELLED,
        statusReason: reason,
      });
      await logFollowUpEvent(tx, {
        prospectId,
        followUpId,
        userId: user.id,
        type: "FOLLOW_UP_CANCELLED",
        title: "Follow-up cancelled",
        summary: reason ? `Cancelled: ${reason}` : "Follow-up cancelled",
        details: reason,
      });
      return (await followUpRepository.findById(followUpId, organizationId, tx))!;
    });
    return mapFollowUpToResponse(cancelled);
  },

  /**
   * Type, notes, reminder and assignee of a pending follow-up. Date and time are
   * accepted only unchanged: moving a follow-up is a reschedule, which keeps
   * its history.
   */
  editFollowUp: async (
    prospectId: string,
    followUpId: string,
    data: EditFollowUpInput,
    user: SafeUser,
    organizationId: string,
  ): Promise<FollowUp> => {
    const updated = await prisma.$transaction(async (tx) => {
      await getProspectForAction(prospectId, organizationId, user, tx);
      const followUp = await getPendingFollowUp(tx, prospectId, followUpId, organizationId);

      // Only a change of assignee is checked; the current one was accepted when set.
      if (data.assignedToId && data.assignedToId !== followUp.assignedToId) {
        await validateLeadAssignee(data.assignedToId, organizationId, user);
      }

      const dateChanged = Boolean(data.date) && data.date !== toDateOnly(followUp.scheduledDate);
      const timeChanged =
        Boolean(data.time) && data.time !== (followUp.scheduledTime ?? DEFAULT_FOLLOW_UP_TIME);
      if (dateChanged || timeChanged) {
        throw AppError.business.ruleViolation(
          "To change the date or time, reschedule the follow-up so its history is kept.",
        );
      }

      const changes: Prisma.FollowUpUncheckedUpdateManyInput = {};
      if (data.type) changes.type = data.type as ProspectFollowUpType;
      if (data.notes !== undefined) changes.notes = data.notes?.trim() || null;
      if (data.reminder !== undefined) {
        changes.reminder = (data.reminder as ProspectReminder | null) ?? null;
      }
      if (data.assignedToId !== undefined) changes.assignedToId = data.assignedToId ?? null;

      if (Object.keys(changes).length > 0) {
        await updateWhilePending(tx, followUpId, organizationId, changes);
      }
      if (changes.assignedToId !== undefined && changes.assignedToId !== followUp.assignedToId) {
        await logFollowUpEvent(tx, {
          prospectId,
          followUpId,
          userId: user.id,
          type: "FOLLOW_UP_SET",
          title: "Follow-up reassigned",
          summary: "Follow-up reassigned",
        });
      }
      return (await followUpRepository.findById(followUpId, organizationId, tx))!;
    });
    return mapFollowUpToResponse(updated);
  },

  getFollowUpHistory: async (prospectId: string, user: SafeUser, organizationId: string) => {
    await getProspectForRead(prospectId, organizationId, user);
    const history = await followUpRepository.findAllByProspectId(prospectId, organizationId);
    return history.map(mapFollowUpToResponse);
  },

  getActiveFollowUp: async (prospectId: string, user: SafeUser, organizationId: string) => {
    await getProspectForRead(prospectId, organizationId, user);
    const active = await followUpRepository.findActiveByProspectId(prospectId, organizationId);
    return active ? mapFollowUpToResponse(active) : null;
  },
};
