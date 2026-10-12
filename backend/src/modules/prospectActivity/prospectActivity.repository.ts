import type { Prisma, ProspectActivityType } from "@prisma/client";
import { DB, prisma } from "../../config/db";
import { INTERACTION_ACTIVITY_TYPE_VALUES } from "../../contracts/constants/activity.constants";

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  managerId: true,
} as const;

export const timelineInclude = {
  createdBy: { select: userSelect },
  followUp: {
    select: {
      id: true,
      dueAt: true,
      scheduledDate: true,
      scheduledTime: true,
      type: true,
      status: true,
      createdAt: true,
    },
  },
} satisfies Prisma.ProspectActivityInclude;

export type TimelineRow = Prisma.ProspectActivityGetPayload<{
  include: typeof timelineInclude;
}>;

export type TimelineCategory = "ALL" | "INTERACTIONS" | "FOLLOW_UPS" | "SYSTEM";

const INTERACTION_TYPES = [...INTERACTION_ACTIVITY_TYPE_VALUES] as ProspectActivityType[];
const FOLLOW_UP_EVENT_TYPES: ProspectActivityType[] = [
  "FOLLOW_UP_SET",
  "FOLLOW_UP_RESCHEDULED",
  "FOLLOW_UP_CANCELLED",
];
const SYSTEM_TYPES: ProspectActivityType[] = [
  "CONVERSION",
  "STAGE_CHANGE",
  "QUOTATION_CREATED",
  "QUOTATION_UPDATED",
];

const categoryFilter = (category: TimelineCategory): Prisma.ProspectActivityWhereInput => {
  switch (category) {
    case "INTERACTIONS":
      return { type: { in: INTERACTION_TYPES } };
    case "FOLLOW_UPS":
      // Follow-up events plus the interactions that completed a follow-up.
      return {
        OR: [
          { type: { in: FOLLOW_UP_EVENT_TYPES } },
          { type: { in: INTERACTION_TYPES }, followUpId: { not: null } },
        ],
      };
    case "SYSTEM":
      return { type: { in: SYSTEM_TYPES } };
    default:
      return {};
  }
};

export const prospectActivityRepository = {
  /** Just what access and closing rules need, without the prospect's relations. */
  findProspectForAccess: (id: string, organizationId: string, tx?: DB) =>
    (tx ?? prisma).prospect.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: {
        id: true,
        stage: true,
        closedAt: true,
        updatedAt: true,
        assignedToId: true,
        assignedTo: { select: { managerId: true } },
      },
    }),

  create: (data: Prisma.ProspectActivityUncheckedCreateInput, tx?: DB) =>
    (tx ?? prisma).prospectActivity.create({ data, include: timelineInclude }),

  findById: (id: string, prospectId: string, tx?: DB) =>
    (tx ?? prisma).prospectActivity.findFirst({
      where: { id, prospectId, deletedAt: null },
      include: timelineInclude,
    }),

  findByClientRequestId: (prospectId: string, clientRequestId: string, tx?: DB) =>
    (tx ?? prisma).prospectActivity.findFirst({
      where: { prospectId, clientRequestId },
      include: timelineInclude,
    }),

  update: (id: string, data: Prisma.ProspectActivityUncheckedUpdateInput, tx?: DB) =>
    (tx ?? prisma).prospectActivity.update({ where: { id }, data, include: timelineInclude }),

  /** Newest first by when it happened; returns limit + 1 rows to signal another page. */
  findPage: (params: {
    prospectId: string;
    category: TimelineCategory;
    limit: number;
    cursor: { occurredAt: Date; id: string } | null;
  }) => {
    const conditions: Prisma.ProspectActivityWhereInput[] = [categoryFilter(params.category)];
    if (params.cursor) {
      conditions.push({
        OR: [
          { occurredAt: { lt: params.cursor.occurredAt } },
          { occurredAt: params.cursor.occurredAt, id: { lt: params.cursor.id } },
        ],
      });
    }

    return prisma.prospectActivity.findMany({
      where: { prospectId: params.prospectId, deletedAt: null, AND: conditions },
      include: timelineInclude,
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: params.limit + 1,
    });
  },
};
