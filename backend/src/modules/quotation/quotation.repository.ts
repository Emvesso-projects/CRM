import { Prisma } from "@prisma/client";
import { DB, prisma } from "../../config/db";
import { paginate } from "../../utils/db/paginate";
import { quotationInclude, quotationListInclude } from "../../utils/selectors";

const baseWhere = (id: string, organizationId: string) => ({
  id,
  organizationId,
  deletedAt: null,
});

const mapRelation = (id: string | null | undefined) => {
  if (id === undefined) return undefined;
  if (id === null || id === "") return { disconnect: true };
  return { connect: { id } };
};

const mapQuotationDataToPrisma = (data: any, isUpdate = false) => {
  const {
    organizationId,
    createdById,
    assignedToId,
    prospectId,
    ...rest
  } = data;

  const prismaData: any = { ...rest };

  // Parse Date if present as String
  if (prismaData.date) {
    prismaData.date = new Date(prismaData.date);
  }

  const cleanProspectId = prospectId === "" ? null : prospectId;

  if (!isUpdate) {
    if (organizationId) prismaData.organization = { connect: { id: organizationId } };
    if (createdById) prismaData.createdBy = { connect: { id: createdById } };
    if (assignedToId) prismaData.assignedTo = { connect: { id: assignedToId } };
    if (cleanProspectId) prismaData.prospect = { connect: { id: cleanProspectId } };
  } else {
    if (assignedToId !== undefined) prismaData.assignedTo = mapRelation(assignedToId);
    if (prospectId !== undefined) prismaData.prospect = mapRelation(cleanProspectId);
  }

  return prismaData;
};

async function createQuotationWithGeneratedNumber(
  organizationId: string,
  createdById: string,
  data: any,
  tx?: DB,
) {
  const execute = async (db: DB) => {
    const year = new Date().getUTCFullYear();
    const organization = await db.organization.findUnique({
      where: { id: organizationId },
      select: { prefix: true },
    });

    if (!organization) {
      throw new Error("Organization not found while generating quotation number");
    }

    // Atomic, organization- and year-scoped sequence increment.
    const seq = await db.quotationSequence.upsert({
      where: {
        organizationId_year: {
          organizationId,
          year,
        },
      },
      update: {
        lastSequence: { increment: 1 },
      },
      create: {
        organizationId,
        year,
        lastSequence: 1,
      },
    });

    const quotationNo = `${organization.prefix}-QT-${year}-${String(seq.lastSequence).padStart(4, "0")}`;

    const { attachments, ...restPayload } = data;
    const prismaData = mapQuotationDataToPrisma({
      ...restPayload,
      quotationNo,
      organizationId,
      createdById,
    }, false);
    prismaData.statusHistory = {
      create: {
        fromStatus: null,
        toStatus: data.status,
        reason: "Quotation created",
        changedBy: { connect: { id: createdById } },
      },
    };

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      prismaData.attachments = {
        create: attachments.map((att: any) => ({
          organization: { connect: { id: organizationId } },
          key: att.key,
          originalName: att.originalName || att.name,
          mimeType: att.mimeType,
          size: att.size,
          type: att.type || (att.mimeType?.startsWith("image/") ? "IMAGE" : "DOCUMENT"),
        })),
      };
    }

    return db.quotation.create({
      data: prismaData,
      include: quotationInclude,
    });
  };

  return tx ? execute(tx) : prisma.$transaction(execute);
}

async function findQuotationById(id: string, organizationId: string, tx?: DB) {
  const db = tx || prisma;
  return db.quotation.findFirst({
    where: baseWhere(id, organizationId),
    include: {
      assignedTo: {
        select: { id: true, email: true, managerId: true }
      }
    }
  });
}

async function getQuotationById(id: string, organizationId: string, tx?: DB) {
  const db = tx || prisma;
  return db.quotation.findFirst({
    where: baseWhere(id, organizationId),
    include: quotationInclude,
  });
}

async function updateQuotation(
  id: string,
  data: any,
  organizationId: string,
  options?: {
    expectedVersion?: number;
    statusChange?: {
      fromStatus: "APPROVED" | "PENDING" | "REJECTED";
      toStatus: "APPROVED" | "PENDING" | "REJECTED";
      reason?: string;
      changedById: string;
    };
  },
  tx?: DB,
) {
  const execute = async (db: DB) => {
    const prismaData = mapQuotationDataToPrisma(data, true);
    prismaData.version = { increment: 1 };

    const updated = await db.quotation.update({
      where: {
        id,
        organizationId,
        deletedAt: null,
        ...(options?.expectedVersion !== undefined
          ? { version: options.expectedVersion }
          : {}),
      },
      data: prismaData,
      include: quotationInclude,
    });

    if (options?.statusChange) {
      await db.quotationStatusHistory.create({
        data: {
          quotationId: id,
          fromStatus: options.statusChange.fromStatus,
          toStatus: options.statusChange.toStatus,
          reason: options.statusChange.reason,
          changedById: options.statusChange.changedById,
        },
      });

      return db.quotation.findUniqueOrThrow({
        where: { id },
        include: quotationInclude,
      });
    }

    return updated;
  };

  return tx ? execute(tx) : prisma.$transaction(execute);
}

async function softDeleteQuotation(
  id: string,
  organizationId: string,
  userId: string,
  tx?: DB,
) {
  const db = tx || prisma;
  const quotation = await db.quotation.findFirst({
    where: baseWhere(id, organizationId),
    select: { id: true },
  });

  if (!quotation) return null;

  return db.quotation.update({
    where: { id, organizationId, deletedAt: null },
    data: {
      deletedAt: new Date(),
      deletedById: userId,
    },
    include: quotationInclude,
  });
}

async function getQuotations(
  where: Prisma.QuotationWhereInput,
  options: { page: number; limit: number },
  tx?: DB,
) {
  const db = tx || prisma;
  return paginate(
    db.quotation,
    where,
    options,
    db,
    {
      include: quotationListInclude,
      orderBy: { createdAt: "desc" },
    }
  );
}

async function getQuotationStats(
  where: Prisma.QuotationWhereInput,
  tx?: DB,
) {
  const db = tx || prisma;
  const groups = await db.quotation.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
  });

  const stats = {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  };

  for (const group of groups) {
    const count = group._count._all;
    stats.total += count;
    if (group.status === "PENDING") stats.pending = count;
    if (group.status === "APPROVED") stats.approved = count;
    if (group.status === "REJECTED") stats.rejected = count;
  }

  return stats;
}

async function findAttachmentById(
  id: string,
  quotationId: string,
  organizationId: string,
  tx?: DB,
) {
  const db = tx || prisma;
  return db.quotationAttachment.findFirst({
    where: { id, quotationId, organizationId },
  });
}

async function findAttachmentsByQuotationId(
  quotationId: string,
  organizationId: string,
  tx?: DB,
) {
  const db = tx || prisma;
  return db.quotationAttachment.findMany({
    where: { quotationId, organizationId },
  });
}

async function createAttachment(
  data: {
    quotationId: string;
    organizationId: string;
    key: string;
    originalName: string;
    mimeType: string;
    size: number;
    type: "IMAGE" | "DOCUMENT";
  },
  tx?: DB,
) {
  const db = tx || prisma;
  return db.quotationAttachment.create({
    data,
  });
}

async function deleteAttachment(
  id: string,
  quotationId: string,
  organizationId: string,
  tx?: DB,
) {
  const db = tx || prisma;
  return db.quotationAttachment.deleteMany({
    where: { id, quotationId, organizationId },
  });
}

async function deleteAttachmentsByQuotationId(
  quotationId: string,
  organizationId: string,
  tx?: DB,
) {
  const db = tx || prisma;
  return db.quotationAttachment.deleteMany({
    where: { quotationId, organizationId },
  });
}

async function deleteAttachmentsByIds(
  ids: string[],
  tx?: DB,
) {
  const db = tx || prisma;
  return db.quotationAttachment.deleteMany({
    where: { id: { in: ids } },
  });
}

export const quotationRepository = {
  createQuotationWithGeneratedNumber,
  findQuotationById,
  getQuotationById,
  updateQuotation,
  softDeleteQuotation,
  getQuotations,
  getQuotationStats,
  findAttachmentById,
  findAttachmentsByQuotationId,
  createAttachment,
  deleteAttachment,
  deleteAttachmentsByQuotationId,
  deleteAttachmentsByIds,
};
