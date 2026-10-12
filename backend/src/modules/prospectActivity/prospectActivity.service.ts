import { FollowUpStatus, type Prisma, type ProspectActivityType } from "@prisma/client";
import { env } from "../../config/env";
import { DB, prisma } from "../../config/db";
import { ACTIVITY_TYPE_LABELS } from "../../contracts/constants/activity.constants";
import type {
  CompleteFollowUpInput,
  LogProspectActivityInput,
  ProspectTimelineQueryInput,
  UpdateProspectActivityInput,
} from "../../contracts/validation";
import type {
  FollowUp,
  LogProspectActivityResult,
  ProspectTimelineItem,
  ProspectTimelinePage,
} from "../../contracts/types";
import type { SafeUser } from "../../types/user.types";
import {
  assertOccurredAt,
  canModifyActivity,
  isInteractionType,
  loggedLateMinutes,
} from "../../utils/activity/activityPolicy";
import { resolveDueAt } from "../../utils/business/businessTime";
import { AppError } from "../../utils/errors/appError";
import { isPrismaUniqueError } from "../../utils/errors/typeGuards";
import { ensureOwnership } from "../../utils/security/ownership.utils";
import { createPendingFollowUp, formatDue, logFollowUpEvent } from "../followUp/followUp.commands";
import { mapFollowUpToResponse } from "../followUp/followUp.mapper";
import { followUpRepository } from "../followUp/followUp.repository";
import {
  prospectActivityRepository,
  type TimelineCategory,
  type TimelineRow,
} from "./prospectActivity.repository";

const NO_LONGER_PENDING =
  "This follow-up was already completed, rescheduled or cancelled. Refresh to see the latest.";
const ALREADY_SCHEDULED =
  "A follow-up is already scheduled for this prospect. Reschedule or complete it instead.";

const FOLLOW_UP_EVENT_TYPES = new Set<string>([
  "FOLLOW_UP_SET",
  "FOLLOW_UP_RESCHEDULED",
  "FOLLOW_UP_CANCELLED",
]);

type LoggableType = LogProspectActivityInput["type"];

const labelOf = (type: string, fallback: string) =>
  ACTIVITY_TYPE_LABELS[type as keyof typeof ACTIVITY_TYPE_LABELS] ?? fallback;

const asRecord = (value: Prisma.JsonValue | null): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const loadProspect = async (
  prospectId: string,
  organizationId: string,
  user: SafeUser,
  tx?: DB,
) => {
  const prospect = await prospectActivityRepository.findProspectForAccess(
    prospectId,
    organizationId,
    tx,
  );
  if (!prospect) throw AppError.resource.notFound("Prospect");
  ensureOwnership(user, prospect);
  return prospect;
};

type AccessProspect = Awaited<ReturnType<typeof loadProspect>>;

/** A closed prospect accepts only activities dated at or before it closed. */
const closedAtOf = (prospect: AccessProspect) =>
  prospect.stage === "WON" || prospect.stage === "LOST"
    ? prospect.closedAt ?? prospect.updatedAt
    : null;

export const mapTimelineItem = (
  row: TimelineRow,
  user: SafeUser,
  now: Date,
): ProspectTimelineItem => {
  const interaction = isInteractionType(row.type);
  const metadata = asRecord(row.metadata);
  const completedFollowUp = interaction && row.followUp?.status === FollowUpStatus.COMPLETED;
  const modifiable = canModifyActivity(user, row, now);

  return {
    id: row.id,
    prospectId: row.prospectId,
    type: row.type,
    category: interaction
      ? "INTERACTION"
      : FOLLOW_UP_EVENT_TYPES.has(row.type)
        ? "FOLLOW_UP"
        : "SYSTEM",
    title: row.title,
    remark: interaction ? row.summary : null,
    summary: row.summary,
    details: row.details,
    outcome: row.outcome,
    durationMinutes:
      typeof metadata?.durationMinutes === "number" ? metadata.durationMinutes : null,
    metadata,
    occurredAt: row.occurredAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    loggedLateMinutes: interaction ? loggedLateMinutes(row.occurredAt, row.createdAt) : null,
    isEdited: row.updatedById !== null,
    createdBy: row.createdBy
      ? {
          id: row.createdBy.id,
          firstName: row.createdBy.firstName,
          lastName: row.createdBy.lastName,
          email: row.createdBy.email,
          managerId: row.createdBy.managerId ?? null,
        }
      : null,
    followUp: row.followUp
      ? {
          id: row.followUp.id,
          dueAt: resolveDueAt(row.followUp, env.APP_TIMEZONE).toISOString(),
          type: row.followUp.type,
          status: row.followUp.status,
        }
      : null,
    canEdit: modifiable,
    // Deleting the activity that completed a follow-up would leave it done
    // with no record of how; it can be edited instead.
    canDelete: modifiable && !completedFollowUp,
  };
};

const encodeCursor = (row: { occurredAt: Date; id: string }) =>
  Buffer.from(`${row.occurredAt.toISOString()}|${row.id}`).toString("base64url");

const decodeCursor = (cursor?: string) => {
  if (!cursor) return null;
  const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const occurredAt = new Date(iso ?? "");
  if (!id || Number.isNaN(occurredAt.getTime())) {
    throw AppError.validation.badRequest("Invalid cursor");
  }
  return { occurredAt, id };
};

/** Whitelisted fields for audit snapshots. */
const auditSnapshot = (row: TimelineRow) => ({
  activityId: row.id,
  type: row.type,
  occurredAt: row.occurredAt.toISOString(),
  outcome: row.outcome,
  remark: row.summary,
  followUpId: row.followUpId,
});

const findRetried = async (
  prospectId: string,
  clientRequestId: string,
  user: SafeUser,
): Promise<LogProspectActivityResult | null> => {
  const existing = await prospectActivityRepository.findByClientRequestId(
    prospectId,
    clientRequestId,
  );
  return existing
    ? {
        activity: mapTimelineItem(existing, user, new Date()),
        completedFollowUp: null,
        nextFollowUp: null,
        duplicate: true,
      }
    : null;
};

/**
 * Logs something that happened, in one transaction: optionally completing the
 * pending follow-up it fulfilled and scheduling the next one. Either all of it
 * is saved or none of it.
 */
const logActivity = async (
  prospectId: string,
  data: LogProspectActivityInput,
  user: SafeUser,
  organizationId: string,
): Promise<LogProspectActivityResult> => {
  // A retry of a request that already succeeded returns the saved activity,
  // but only to someone who may see the prospect.
  if (data.clientRequestId) {
    await loadProspect(prospectId, organizationId, user);
    const retried = await findRetried(prospectId, data.clientRequestId, user);
    if (retried) return retried;
  }

  const occurredAt = new Date(data.occurredAt);

  try {
    return await prisma.$transaction(async (tx) => {
      const prospect = await loadProspect(prospectId, organizationId, user, tx);
      const closedAt = closedAtOf(prospect);
      if (closedAt && (data.completeFollowUpId || data.nextFollowUp)) {
        throw AppError.business.stateConflict("Won or lost prospects cannot have follow-ups");
      }

      let followUpCreatedAt: Date | null = null;
      let completedAssigneeId: string | null = null;
      if (data.completeFollowUpId) {
        const pending = await followUpRepository.findActiveByProspectId(
          prospectId,
          organizationId,
          tx,
        );
        if (!pending || pending.id !== data.completeFollowUpId) {
          throw AppError.business.stateConflict(NO_LONGER_PENDING);
        }
        followUpCreatedAt = pending.createdAt;
        completedAssigneeId = pending.assignedToId;
      }

      assertOccurredAt({ occurredAt, now: new Date(), closedAt, notBefore: followUpCreatedAt });

      let completedFollowUp: FollowUp | null = null;
      if (data.completeFollowUpId) {
        const result = await followUpRepository.updatePending(
          data.completeFollowUpId,
          organizationId,
          {
            status: FollowUpStatus.COMPLETED,
            completedAt: occurredAt,
            completedById: user.id,
            outcome: data.outcome ?? null,
            completionRemark: data.remark,
          },
          tx,
        );
        if (result.count === 0) {
          throw AppError.business.stateConflict(NO_LONGER_PENDING);
        }
        const row = await followUpRepository.findById(data.completeFollowUpId, organizationId, tx);
        completedFollowUp = row ? mapFollowUpToResponse(row) : null;
      }

      const activity = await prospectActivityRepository.create(
        {
          prospectId,
          type: data.type as ProspectActivityType,
          title: labelOf(data.type, "Activity"),
          summary: data.remark,
          details: null,
          outcome: data.type === "NOTE" ? null : data.outcome ?? null,
          ...(data.durationMinutes != null
            ? { metadata: { durationMinutes: data.durationMinutes } }
            : {}),
          followUpId: data.completeFollowUpId ?? null,
          occurredAt,
          clientRequestId: data.clientRequestId ?? null,
          createdById: user.id,
        },
        tx,
      );

      let nextFollowUp: FollowUp | null = null;
      if (data.nextFollowUp) {
        if (await followUpRepository.findActiveByProspectId(prospectId, organizationId, tx)) {
          throw AppError.business.stateConflict(ALREADY_SCHEDULED);
        }
        // The next follow-up goes to whoever had the one just completed, else the owner.
        const created = await createPendingFollowUp(tx, {
          prospectId,
          organizationId,
          data: data.nextFollowUp,
          user,
          defaultAssigneeId: completedAssigneeId ?? prospect.assignedToId ?? user.id,
        });
        const dueAt = resolveDueAt(created, env.APP_TIMEZONE);
        await logFollowUpEvent(tx, {
          prospectId,
          followUpId: created.id,
          userId: user.id,
          type: "FOLLOW_UP_SET",
          title: "Follow-up scheduled",
          summary: `Follow-up scheduled for ${formatDue(dueAt)}`,
          details: created.notes,
          metadata: { dueAt: dueAt.toISOString() },
        });
        nextFollowUp = mapFollowUpToResponse(created);
      }

      return {
        activity: mapTimelineItem(activity, user, new Date()),
        completedFollowUp,
        nextFollowUp,
        duplicate: false,
      };
    });
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      // Either the same request raced in, or a second pending follow-up.
      if (data.clientRequestId) {
        const retried = await findRetried(prospectId, data.clientRequestId, user);
        if (retried) return retried;
      }
      throw AppError.business.stateConflict(ALREADY_SCHEDULED);
    }
    throw error;
  }
};

export const prospectActivityService = {
  log: logActivity,

  /**
   * Deprecated route PATCH /follow-ups/:fId/complete: logs the follow-up's
   * interaction and completes it, exactly like logging with completeFollowUpId.
   */
  completeFollowUp: async (
    prospectId: string,
    followUpId: string,
    data: CompleteFollowUpInput,
    user: SafeUser,
    organizationId: string,
  ): Promise<FollowUp> => {
    const followUp = await followUpRepository.findById(followUpId, organizationId);
    if (!followUp || followUp.prospectId !== prospectId) {
      throw AppError.resource.notFound("Follow-up");
    }

    const type: LoggableType =
      followUp.type === "MEETING" ? "IN_PERSON_MEETING" : (followUp.type as LoggableType);

    const result = await logActivity(
      prospectId,
      {
        type,
        occurredAt: data.occurredAt ?? new Date().toISOString(),
        remark: data.remark,
        outcome: data.outcome,
        completeFollowUpId: followUpId,
        nextFollowUp: data.nextFollowUp ?? null,
      },
      user,
      organizationId,
    );
    if (!result.completedFollowUp) {
      throw AppError.business.stateConflict(NO_LONGER_PENDING);
    }
    return result.completedFollowUp;
  },

  timeline: async (
    prospectId: string,
    query: ProspectTimelineQueryInput,
    user: SafeUser,
    organizationId: string,
  ): Promise<ProspectTimelinePage> => {
    await loadProspect(prospectId, organizationId, user);

    const rows = await prospectActivityRepository.findPage({
      prospectId,
      category: query.category as TimelineCategory,
      limit: query.limit,
      cursor: decodeCursor(query.cursor),
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const now = new Date();

    return {
      items: page.map((row) => mapTimelineItem(row, user, now)),
      nextCursor: hasMore ? encodeCursor(page[page.length - 1]) : null,
    };
  },

  update: async (
    prospectId: string,
    activityId: string,
    data: UpdateProspectActivityInput,
    user: SafeUser,
    organizationId: string,
  ) =>
    prisma.$transaction(async (tx) => {
      const prospect = await loadProspect(prospectId, organizationId, user, tx);
      const row = await prospectActivityRepository.findById(activityId, prospectId, tx);
      if (!row) throw AppError.resource.notFound("Activity");

      const now = new Date();
      if (!isInteractionType(row.type)) {
        throw AppError.business.ruleViolation("System entries can't be edited");
      }
      if (!canModifyActivity(user, row, now)) {
        throw AppError.authorization.forbidden(
          "You can edit your own activities for 24 hours after logging them",
        );
      }

      const completedFollowUp =
        row.followUp?.status === FollowUpStatus.COMPLETED ? row.followUp : null;
      const occurredAt = data.occurredAt ? new Date(data.occurredAt) : row.occurredAt;
      assertOccurredAt({
        occurredAt,
        now,
        closedAt: closedAtOf(prospect),
        notBefore: completedFollowUp?.createdAt ?? null,
      });

      const type = data.type ?? row.type;
      const outcome = type === "NOTE" ? null : data.outcome !== undefined ? data.outcome : row.outcome;
      if (completedFollowUp && (type === "NOTE" || !outcome)) {
        throw AppError.business.ruleViolation(
          "An activity that completed a follow-up needs an interaction type and an outcome",
        );
      }

      const metadata =
        data.durationMinutes !== undefined
          ? { ...(asRecord(row.metadata) ?? {}), durationMinutes: data.durationMinutes }
          : undefined;

      const updated = await prospectActivityRepository.update(
        activityId,
        {
          type: type as ProspectActivityType,
          title: labelOf(type, row.title),
          summary: data.remark ?? row.summary,
          outcome,
          occurredAt,
          ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {}),
          updatedById: user.id,
        },
        tx,
      );

      // Keep the follow-up's completion in step with the activity that did it.
      if (completedFollowUp) {
        await followUpRepository.update(
          completedFollowUp.id,
          { completedAt: occurredAt, outcome, completionRemark: updated.summary },
          tx,
        );
      }

      return {
        item: mapTimelineItem(updated, user, now),
        before: auditSnapshot(row),
        after: auditSnapshot(updated),
      };
    }),

  remove: async (
    prospectId: string,
    activityId: string,
    user: SafeUser,
    organizationId: string,
  ) =>
    prisma.$transaction(async (tx) => {
      await loadProspect(prospectId, organizationId, user, tx);
      const row = await prospectActivityRepository.findById(activityId, prospectId, tx);
      if (!row) throw AppError.resource.notFound("Activity");

      if (!isInteractionType(row.type)) {
        throw AppError.business.ruleViolation("System entries can't be deleted");
      }
      if (!canModifyActivity(user, row, new Date())) {
        throw AppError.authorization.forbidden(
          "You can delete your own activities for 24 hours after logging them",
        );
      }
      if (row.followUp?.status === FollowUpStatus.COMPLETED) {
        throw AppError.business.stateConflict(
          "This activity completed a follow-up, so it can't be deleted. Edit it instead.",
        );
      }

      await prospectActivityRepository.update(
        activityId,
        { deletedAt: new Date(), deletedById: user.id },
        tx,
      );
      return auditSnapshot(row);
    }),
};
