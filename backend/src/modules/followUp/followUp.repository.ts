import { FollowUpStatus, Prisma } from "@prisma/client";
import { env } from "../../config/env";
import { DB, prisma } from "../../config/db";
import { businessDayBounds } from "../../utils/business/businessTime";
import { overdueCutoff } from "./followUp.rules";

export const followUpAssigneeSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  managerId: true,
} as const;

const followUpInclude = {
  assignedTo: { select: followUpAssigneeSelect },
  completedBy: { select: followUpAssigneeSelect },
  createdBy: { select: followUpAssigneeSelect },
  rescheduledTo: { select: { id: true } },
  rescheduledFrom: { select: { id: true } },
} as const;

const toAssignedToFilter = (assignedToId?: string | string[]) =>
  Array.isArray(assignedToId)
    ? { in: assignedToId }
    : assignedToId;

/**
 * A follow-up left PENDING on a won, lost or deleted prospect is not work
 * anyone can do, so it must not inflate the overdue or due-today numbers.
 */
const openProspectScope = {
  prospect: { deletedAt: null, stage: { notIn: ["WON", "LOST"] } },
} satisfies Prisma.FollowUpWhereInput;

/**
 * The `dueAt` windows behind "overdue", "due today" and "upcoming", shared by
 * the counts, the prospect list filters and the dashboards so every screen
 * agrees. Days are APP_TIMEZONE days, never UTC or server-local days.
 */
export const followUpDueWindows = (now: Date = new Date()) => {
  const { startOfToday, startOfTomorrow } = businessDayBounds(now, env.APP_TIMEZONE);

  return {
    overdue: { dueAt: { lt: overdueCutoff(now) } },
    notOverdue: { dueAt: { gte: overdueCutoff(now) } },
    dueToday: { dueAt: { gte: startOfToday, lt: startOfTomorrow } },
    upcoming: { dueAt: { gte: startOfTomorrow } },
  } satisfies Record<
    "overdue" | "notOverdue" | "dueToday" | "upcoming",
    Prisma.FollowUpWhereInput
  >;
};

export const followUpRepository = {
  dueWindows: followUpDueWindows,

  create: (data: Prisma.FollowUpUncheckedCreateInput, tx?: DB) =>
    (tx ?? prisma).followUp.create({ data, include: followUpInclude }),

  findById: (id: string, organizationId: string, tx?: DB) =>
    (tx ?? prisma).followUp.findFirst({
      where: { id, organizationId },
      include: followUpInclude,
    }),

  findActiveByProspectId: (prospectId: string, organizationId: string, tx?: DB) =>
    (tx ?? prisma).followUp.findFirst({
      where: { prospectId, organizationId, status: FollowUpStatus.PENDING },
      include: followUpInclude,
      orderBy: { scheduledDate: "asc" },
    }),

  findAllByProspectId: (prospectId: string, organizationId: string, tx?: DB) =>
    (tx ?? prisma).followUp.findMany({
      where: { prospectId, organizationId },
      include: followUpInclude,
      orderBy: [{ createdAt: "desc" }, { scheduledDate: "desc" }],
    }),

  update: (id: string, data: Prisma.FollowUpUncheckedUpdateInput, tx?: DB) =>
    (tx ?? prisma).followUp.update({ where: { id }, data, include: followUpInclude }),

  updatePending: (
    id: string,
    organizationId: string,
    data: Prisma.FollowUpUncheckedUpdateManyInput,
    tx?: DB,
  ) =>
    (tx ?? prisma).followUp.updateMany({
      where: { id, organizationId, status: FollowUpStatus.PENDING },
      data,
    }),

  updatePendingForProspect: (
    prospectId: string,
    organizationId: string,
    data: Prisma.FollowUpUncheckedUpdateManyInput,
    tx?: DB,
  ) =>
    (tx ?? prisma).followUp.updateMany({
      where: { prospectId, organizationId, status: FollowUpStatus.PENDING },
      data,
    }),

  countOverdue: async (
    organizationId: string,
    assignedToId?: string | string[],
    managerId?: string | null,
  ) => {
    const assignee = toAssignedToFilter(assignedToId);

    return prisma.followUp.count({
      where: {
        organizationId,
        status: FollowUpStatus.PENDING,
        ...openProspectScope,
        ...(assignee ? { assignedToId: assignee } : {}),
        ...(managerId
          ? { assignedTo: { is: { OR: [{ id: managerId }, { managerId }] } } }
          : {}),
        ...followUpDueWindows().overdue,
      },
    });
  },

  countDueToday: async (
    organizationId: string,
    assignedToId?: string | string[],
    managerId?: string | null,
  ) => {
    const assignee = toAssignedToFilter(assignedToId);

    return prisma.followUp.count({
      where: {
        organizationId,
        status: FollowUpStatus.PENDING,
        ...openProspectScope,
        ...(assignee ? { assignedToId: assignee } : {}),
        ...(managerId
          ? { assignedTo: { is: { OR: [{ id: managerId }, { managerId }] } } }
          : {}),
        ...followUpDueWindows().dueToday,
      },
    });
  },

  findDueForReminder: (from: Date, to: Date) =>
    prisma.followUp.findMany({
      where: {
        status: FollowUpStatus.PENDING,
        dueAt: { gte: from, lte: to },
        assignedToId: { not: null },
        prospect: { stage: { notIn: ["WON", "LOST"] }, deletedAt: null },
      },
      include: {
        prospect: { select: { id: true, prospectNo: true, lead: { select: { companyName: true } } } },
      },
      take: 1000,
    }),

  findOverdueForNotification: (from: Date, to: Date) =>
    prisma.followUp.findMany({
      where: {
        status: FollowUpStatus.PENDING,
        dueAt: { gte: from, lte: to },
        assignedToId: { not: null },
        prospect: { stage: { notIn: ["WON", "LOST"] }, deletedAt: null },
      },
      include: {
        prospect: { select: { id: true, prospectNo: true, lead: { select: { companyName: true } } } },
      },
      take: 1000,
    }),
};
