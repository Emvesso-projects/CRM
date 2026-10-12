import type { Prisma } from "@prisma/client";

// Reusable include shape for lead queries
// Populates assignedTo and createdBy with only the fields the frontend needs.
// Import this wherever you query leads to keep the response shape consistent.
export const leadInclude = {
  assignedTo: {
    select: { id: true, firstName: true, lastName: true, email: true, managerId: true },
  },
  createdBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  deletedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  productInterest: {
    select: { id: true, name: true, itemCode: true },
  },
  prospect: {
    select: { id: true, deletedAt: true },
  },
  activities: {
    where: { deletedAt: null },
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
    // Newest first by when it happened (a mutable array, as Prisma requires).
    orderBy: [
      { occurredAt: "desc" },
      { id: "desc" },
    ] as Prisma.LeadActivityOrderByWithRelationInput[],
  },
} as const;

// Lighter version for list endpoints — excludes activities for performance
export const leadListInclude = {
  assignedTo: {
    select: { id: true, firstName: true, lastName: true, email: true, managerId: true },
  },
  createdBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  deletedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  productInterest: {
    select: { id: true, name: true, itemCode: true },
  },
  prospect: {
    select: { id: true, deletedAt: true },
  },
} as const;
