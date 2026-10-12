import type {
  FollowUpOutcome,
  FollowUpStatus,
  ProspectFollowUpType,
  ProspectReminder,
} from "@prisma/client";
import { env } from "../../config/env";
import type { FollowUp, ProspectAssignee } from "../../contracts/types";
import { resolveDueAt } from "../../utils/business/businessTime";
import { followUpDueState } from "./followUp.rules";

type AssigneeRow =
  | {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      managerId?: string | null;
    }
  | null
  | undefined;

export const mapAssignee = (user: AssigneeRow): ProspectAssignee | null =>
  user
    ? {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        managerId: user.managerId ?? null,
      }
    : null;

export type FollowUpRow = {
  id: string;
  prospectId: string;
  scheduledDate: Date;
  scheduledTime: string | null;
  dueAt: Date | null;
  type: ProspectFollowUpType;
  notes: string | null;
  reminder: ProspectReminder | null;
  assignedToId: string | null;
  status: FollowUpStatus;
  completedAt: Date | null;
  completedById: string | null;
  outcome: FollowUpOutcome | null;
  completionRemark: string | null;
  missedReason: string | null;
  statusReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  assignedTo?: AssigneeRow;
  completedBy?: AssigneeRow;
  rescheduledToId?: string | null;
  rescheduledTo?: { id: string } | null;
  rescheduledFrom?: { id: string } | null;
};

/** API shape of a follow-up. Takes one argument so it can be passed to Array.map. */
export const mapFollowUpToResponse = (followUp: FollowUpRow): FollowUp => {
  const dueAt = resolveDueAt(followUp, env.APP_TIMEZONE);

  return {
    id: followUp.id,
    prospectId: followUp.prospectId,
    scheduledDate: followUp.scheduledDate.toISOString(),
    scheduledTime: followUp.scheduledTime,
    dueAt: dueAt.toISOString(),
    health:
      followUp.status === "PENDING"
        ? followUpDueState(dueAt, new Date(), env.APP_TIMEZONE)
        : null,
    type: followUp.type,
    notes: followUp.notes,
    reminder: followUp.reminder,
    assignedToId: followUp.assignedToId,
    assignedTo: mapAssignee(followUp.assignedTo),
    status: followUp.status,
    completedAt: followUp.completedAt?.toISOString() ?? null,
    completedById: followUp.completedById,
    completedBy: mapAssignee(followUp.completedBy),
    outcome: followUp.outcome,
    completionRemark: followUp.completionRemark,
    missedReason: followUp.missedReason,
    statusReason: followUp.statusReason ?? followUp.missedReason,
    rescheduledToId: followUp.rescheduledToId ?? followUp.rescheduledTo?.id ?? null,
    rescheduledFromId: followUp.rescheduledFrom?.id ?? null,
    createdAt: followUp.createdAt.toISOString(),
    updatedAt: followUp.updatedAt.toISOString(),
  };
};
