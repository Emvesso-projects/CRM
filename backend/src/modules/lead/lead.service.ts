import { ROLES } from "../../constants/roles";
import { AppError } from "../../utils/errors/appError";
import type { SafeUser } from "../../types/user.types";
import { leadRepository } from "./lead.repository";
import { itemRepository } from "../item/item.repository";
import { prospectService } from "../prospect/prospect.service";
import { prospectRepository } from "../prospect/prospect.repository";
import { ensureOwnership } from "../../utils/security/ownership.utils";
import {
  ensureEditableLead,
  ensureStatusChangeAllowed,
} from "../../utils/business/lead.utils";
import { logger } from "../../config/logger";
import {
  assertOccurredAt,
  canModifyActivity,
  loggedLateMinutes,
} from "../../utils/activity/activityPolicy";
import type {
  CreateLeadInput,
  CreateLeadActivityInput,
  UpdateLeadActivityInput,
  ConvertLeadToProspectInput,
  LeadFilterInput,
  UpdateLeadStatusInput,
  UpdateLeadInput,
} from "../../contracts/validation";
import type { Lead } from "../../contracts/types";
import { validateLeadAssignee } from "./lead.validation";
import { importLeads } from "./lead.import";
import { userRepository } from "../user/user.repository";
import { billingRepository } from "../billing/billing.repository";
import { assertWithinLimit } from "../billing/limit.guard";
import { toLeadDTO } from "./lead.helpers";
import { prisma, type DB } from "../../config/db";
import { leadInclude } from "../../utils/selectors";
import {
  Industry as PrismaIndustry,
  LeadSource as PrismaLeadSource,
  LeadStatus as PrismaLeadStatus,
  LeadType as PrismaLeadType,
  Prisma,
  ProspectActivityType,
  ProspectStage,
  UserStatus,
} from "@prisma/client";

interface CreateLeadOptions {
  assignedAt?: Date;
  assignedById?: string;
  assignedToId?: string;
}

interface QualifiedProspectMeta {
  id: string;
  prospectNo: string;
  isNew: boolean;
}

interface UpdateLeadStatusResult {
  lead: Lead;
  message: string;
  prospect?: QualifiedProspectMeta;
}

const toEnumFilter = <T extends string>(value?: T | T[]) => {
  if (!value) {
    return undefined;
  }

  return Array.isArray(value) ? { in: value } : value;
};

const parseDateOnlyStart = (value?: string) => {
  if (!value) {
    return undefined;
  }

  return new Date(`${value}T00:00:00.000Z`);
};

const parseDateOnlyEnd = (value?: string) => {
  if (!value) {
    return undefined;
  }

  return new Date(`${value}T23:59:59.999Z`);
};

const isUniqueConstraintError = (
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError => {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
};

const getUniqueErrorTarget = (error: unknown) => {
  if (!isUniqueConstraintError(error)) {
    return [];
  }

  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.map(String);
  }
  if (typeof target === "string") {
    return [target];
  }

  return [];
};

const uniqueErrorTargetsField = (error: unknown, field: string) => {
  return getUniqueErrorTarget(error).some((target) => target === field);
};

const controlledUniqueError = (error: unknown) => {
  const target = getUniqueErrorTarget(error).join(", ");
  return AppError.database.constraintViolation(target || undefined);
};

async function createLead(
  data: CreateLeadInput,
  user: SafeUser,
  organizationId: string,
  options: CreateLeadOptions = {},
): Promise<Lead> {
  const {
    assignedToId: assignedToIdFromData,
    status: createStatus,
    source,
    industry,
    leadType,
    productInterested,
    leadDate,
    ...rest
  } = data;

  const {
    assignedAt: optAssignedAt,
    assignedById: optAssignedById,
    assignedToId: optAssignedToId,
  } = options;

  let resolvedAssignedToId =
    optAssignedToId ?? assignedToIdFromData ?? undefined;

  if (user.role === ROLES.EXECUTIVE) {
    if (resolvedAssignedToId && resolvedAssignedToId !== user.id) {
      throw AppError.authorization.forbidden(
        "Executives can only assign leads to themselves",
      );
    }
    resolvedAssignedToId = user.id;
  } else if (user.role === ROLES.MANAGER) {
    if (!resolvedAssignedToId) {
      resolvedAssignedToId = user.id;
    }
  }

  if (resolvedAssignedToId) {
    await validateLeadAssignee(resolvedAssignedToId, organizationId, user);
  }

  // Plan limit: refuse once the org has reached its MAX_LEADS ceiling.
  await assertWithinLimit(organizationId, "MAX_LEADS", billingRepository.countLeads);

  if (productInterested) {
    const item = await itemRepository.findActiveItemById(productInterested, organizationId);
    if (!item) {
      throw AppError.validation.badRequest("Invalid or inactive product selected for product interest.");
    }
  }

  const assignedById =
    optAssignedById ?? (resolvedAssignedToId ? user.id : undefined);
  const assignedAt =
    optAssignedAt ?? (resolvedAssignedToId ? new Date() : undefined);

  const lead = await leadRepository.createLeadWithGeneratedNumber(
    organizationId,
    {
      ...rest,
      source,
      industry,
      leadType,
      status: createStatus,
      organizationId,
      createdById: user.id,
      assignedToId: resolvedAssignedToId,
      assignedById,
      assignedAt,
      productInterestId: productInterested,
      ...(leadDate ? { leadDate: new Date(leadDate) } : {}),
    },
  );

  return toLeadDTO(lead);
}

async function updateLead(
  id: string,
  data: UpdateLeadInput,
  user: SafeUser,
  organizationId: string,
): Promise<Lead> {
  const existingLead = await leadRepository.findLeadById(id, organizationId);
  if (!existingLead) {
    throw AppError.resource.notFound("Lead");
  }

  ensureOwnership(user, existingLead);
  ensureEditableLead(existingLead);

  const {
    assignedToId: assignedToIdIn,
    status: updateStatus,
    source,
    industry,
    leadType,
    productInterested,
    leadDate,
    ...rest
  } = data;

  const isExecutive = user.role === ROLES.EXECUTIVE;

  if (
    isExecutive &&
    assignedToIdIn !== undefined &&
    assignedToIdIn !== user.id
  ) {
    throw AppError.authorization.forbidden(
      "Executives can only assign leads to themselves",
    );
  }

  if (updateStatus) {
    ensureStatusChangeAllowed(existingLead, user);
    logger.info("Lead status changing via update", {
      leadId: id,
      oldStatus: existingLead.status,
      newStatus: updateStatus,
      userId: user.id,
    });
  }

  if (assignedToIdIn) {
    await validateLeadAssignee(assignedToIdIn, organizationId, user);
  }

  if (productInterested) {
    const item = await itemRepository.findActiveItemById(productInterested, organizationId);
    if (!item) {
      throw AppError.validation.badRequest("Invalid or inactive product selected for product interest.");
    }
  }

  const isChangingAssignee =
    assignedToIdIn !== undefined &&
    assignedToIdIn !== existingLead.assignedToId;

  const lead = await leadRepository.updateLead(
    id,
    {
      ...rest,
      source,
      industry,
      leadType,
      status: updateStatus,
      assignedToId: assignedToIdIn,
      productInterestId: productInterested,
      ...(leadDate ? { leadDate: new Date(leadDate) } : {}),
      ...(isChangingAssignee && {
        assignedById: user.id,
        assignedAt: new Date(),
      }),
    },
    organizationId,
  );

  if (!lead) {
    throw AppError.resource.notFound("Lead");
  }

  return toLeadDTO(lead);
}

async function softDeleteLead(
  id: string,
  user: SafeUser,
  organizationId: string,
) {
  if (user.role === ROLES.EXECUTIVE) {
    throw AppError.authorization.forbidden("Not allowed to delete lead");
  }

  const existingLead = await leadRepository.findLeadById(id, organizationId);
  if (!existingLead) {
    throw AppError.resource.notFound("Lead");
  }

  ensureOwnership(user, existingLead);
  ensureEditableLead(existingLead);

  await leadRepository.softDeleteLead(id, organizationId, user.id);
}

async function assignLead(
  id: string,
  executiveId: string,
  assignedByIdIn: string,
  user: SafeUser,
  organizationId: string,
): Promise<Lead> {
  const existingLead = await leadRepository.findLeadById(id, organizationId);
  if (!existingLead) {
    throw AppError.resource.notFound("Lead");
  }

  ensureOwnership(user, existingLead);
  ensureEditableLead(existingLead);

  await validateLeadAssignee(executiveId, organizationId, user);

  const lead = await leadRepository.assignLead(
    id,
    executiveId,
    assignedByIdIn,
    organizationId,
  );

  if (!lead) {
    throw AppError.resource.notFound("Lead");
  }

  return toLeadDTO(lead);
}

function parseSearchDateRanges(searchStr: string): { gte: Date; lte: Date }[] {
  const ranges: { gte: Date; lte: Date }[] = [];
  const s = searchStr.trim();
  if (!s) return ranges;

  // 1. Year alone (e.g. "2026")
  if (/^\d{4}$/.test(s)) {
    const year = parseInt(s, 10);
    if (year >= 2000 && year <= 2100) {
      ranges.push({
        gte: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)),
        lte: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
      });
      return ranges;
    }
  }

  // 2. YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const ymdMatch = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    if (year >= 2000 && year <= 2100 && month >= 0 && month < 12 && day >= 1 && day <= 31) {
      ranges.push({
        gte: new Date(Date.UTC(year, month, day, 0, 0, 0, 0)),
        lte: new Date(Date.UTC(year, month, day, 23, 59, 59, 999)),
      });
      return ranges;
    }
  }

  // 3. DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY, etc.
  const dmyMatch = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10);
    const p2 = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);

    if (year >= 2000 && year <= 2100) {
      // Primary: DD/MM/YYYY
      const day = p1;
      const month = p2 - 1;
      if (month >= 0 && month < 12 && day >= 1 && day <= 31) {
        ranges.push({
          gte: new Date(Date.UTC(year, month, day, 0, 0, 0, 0)),
          lte: new Date(Date.UTC(year, month, day, 23, 59, 59, 999)),
        });
      }

      // Secondary: MM/DD/YYYY if p1 <= 12 and p1 !== p2
      if (p1 <= 12 && p1 !== p2 && p1 >= 1 && p2 >= 1 && p2 <= 31) {
        const altMonth = p1 - 1;
        const altDay = p2;
        ranges.push({
          gte: new Date(Date.UTC(year, altMonth, altDay, 0, 0, 0, 0)),
          lte: new Date(Date.UTC(year, altMonth, altDay, 23, 59, 59, 999)),
        });
      }
      return ranges;
    }
  }

  // 4. Try standard Date.parse (e.g. "18 Aug 2026", "Aug 18, 2026", "August 2026")
  const parsedTs = Date.parse(s);
  if (!isNaN(parsedTs)) {
    const parsedDate = new Date(parsedTs);
    const year = parsedDate.getUTCFullYear();
    const month = parsedDate.getUTCMonth();
    const day = parsedDate.getUTCDate();
    if (year >= 2000 && year <= 2100) {
      ranges.push({
        gte: new Date(Date.UTC(year, month, day, 0, 0, 0, 0)),
        lte: new Date(Date.UTC(year, month, day, 23, 59, 59, 999)),
      });
    }
  }

  // 5. Month name matching (e.g. "August", "Aug")
  const monthNames = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"
  ];
  const shortMonths = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec"
  ];

  const lowerS = s.toLowerCase();
  const foundMonthIdx = monthNames.findIndex(
    (m, idx) => m.includes(lowerS) || shortMonths[idx].includes(lowerS) || lowerS.includes(m) || lowerS.includes(shortMonths[idx])
  );

  if (foundMonthIdx !== -1) {
    const yearMatch = s.match(/\b(20\d{2})\b/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
    ranges.push({
      gte: new Date(Date.UTC(year, foundMonthIdx, 1, 0, 0, 0, 0)),
      lte: new Date(Date.UTC(year, foundMonthIdx + 1, 0, 23, 59, 59, 999)),
    });
  }

  return ranges;
}

function buildLeadSearchWhereClause(search: string): Prisma.LeadWhereInput[] {
  const searchTerm = search.trim();
  if (!searchTerm) {
    return [];
  }

  const orConditions: Prisma.LeadWhereInput[] = [];

  // 1. Lead No, First Name, Last Name, Company Name
  orConditions.push(
    { leadNo: { contains: searchTerm, mode: "insensitive" } },
    { firstName: { contains: searchTerm, mode: "insensitive" } },
    { lastName: { contains: searchTerm, mode: "insensitive" } },
    { companyName: { contains: searchTerm, mode: "insensitive" } },
  );

  // Full Name split (e.g. "John Doe")
  const tokens = searchTerm.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    orConditions.push(
      {
        AND: [
          { firstName: { contains: first, mode: "insensitive" } },
          { lastName: { contains: last, mode: "insensitive" } },
        ],
      },
      {
        AND: [
          { firstName: { contains: last, mode: "insensitive" } },
          { lastName: { contains: first, mode: "insensitive" } },
        ],
      },
    );
  }

  // 2. Status matching (NEW, ATTEMPTED_CONTACT, CONTACTED, QUALIFIED, UNQUALIFIED)
  const statusLabels: Record<PrismaLeadStatus, string[]> = {
    [PrismaLeadStatus.NEW]: ["new"],
    [PrismaLeadStatus.ATTEMPTED_CONTACT]: ["attempted contact", "attempted_contact", "attempted", "contact"],
    [PrismaLeadStatus.CONTACTED]: ["contacted"],
    [PrismaLeadStatus.QUALIFIED]: ["qualified"],
    [PrismaLeadStatus.UNQUALIFIED]: ["unqualified"],
  };

  const matchedStatuses: PrismaLeadStatus[] = (
    Object.keys(statusLabels) as PrismaLeadStatus[]
  ).filter((st) => {
    const lowerTerm = searchTerm.toLowerCase();
    if (st.toLowerCase().includes(lowerTerm)) return true;
    return statusLabels[st].some(
      (label) => label.includes(lowerTerm) || lowerTerm.includes(label)
    );
  });

  if (matchedStatuses.length > 0) {
    orConditions.push({ status: { in: matchedStatuses } });
  }

  // 3. Type matching (NEW, EXISTING)
  const typeLabels: Record<PrismaLeadType, string[]> = {
    [PrismaLeadType.NEW]: ["new", "new lead", "fresh"],
    [PrismaLeadType.EXISTING]: ["existing", "existing customer", "old", "current"],
  };

  const matchedTypes: PrismaLeadType[] = (
    Object.keys(typeLabels) as PrismaLeadType[]
  ).filter((t) => {
    const lowerTerm = searchTerm.toLowerCase();
    if (t.toLowerCase().includes(lowerTerm)) return true;
    return typeLabels[t].some(
      (label) => label.includes(lowerTerm) || lowerTerm.includes(label)
    );
  });

  if (matchedTypes.length > 0) {
    orConditions.push({ leadType: { in: matchedTypes } });
  }

  // 4. Item (Product Interest: name, itemCode)
  orConditions.push(
    { productInterest: { name: { contains: searchTerm, mode: "insensitive" } } },
    { productInterest: { itemCode: { contains: searchTerm, mode: "insensitive" } } },
  );

  // 5. Mobile & Alternate Mobile
  orConditions.push(
    { mobile: { contains: searchTerm, mode: "insensitive" } },
    { alternateMobile: { contains: searchTerm, mode: "insensitive" } },
  );

  // 6. Assigned To (firstName, lastName, email, "unassigned")
  orConditions.push(
    { assignedTo: { firstName: { contains: searchTerm, mode: "insensitive" } } },
    { assignedTo: { lastName: { contains: searchTerm, mode: "insensitive" } } },
    { assignedTo: { email: { contains: searchTerm, mode: "insensitive" } } },
  );

  if (tokens.length >= 2) {
    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    orConditions.push(
      {
        assignedTo: {
          AND: [
            { firstName: { contains: first, mode: "insensitive" } },
            { lastName: { contains: last, mode: "insensitive" } },
          ],
        },
      },
      {
        assignedTo: {
          AND: [
            { firstName: { contains: last, mode: "insensitive" } },
            { lastName: { contains: first, mode: "insensitive" } },
          ],
        },
      },
    );
  }

  if (searchTerm.toLowerCase().includes("unassigned") || searchTerm.toLowerCase().includes("unassign")) {
    orConditions.push({ assignedToId: null });
  }

  // 7. Date (leadDate)
  const dateRanges = parseSearchDateRanges(searchTerm);
  for (const range of dateRanges) {
    orConditions.push({
      leadDate: {
        gte: range.gte,
        lte: range.lte,
      },
    });
  }

  return orConditions;
}

async function getLeads(
  params: LeadFilterInput,
  user: SafeUser,
  organizationId: string,
) {
  const {
    source,
    industry,
    status,
    productInterested,
    assignedToId,
    search,
    createdFrom,
    createdTo,
    page,
    limit,
  } = params;

  const where: Prisma.LeadWhereInput = {
    organizationId,
    deletedAt: null,
  };

  if (search) {
    const searchOrConditions = buildLeadSearchWhereClause(search);
    if (searchOrConditions.length > 0) {
      where.OR = searchOrConditions;
    }
  }

  if (createdFrom || createdTo) {
    where.leadDate = {
      ...(createdFrom ? { gte: parseDateOnlyStart(createdFrom) } : {}),
      ...(createdTo ? { lte: parseDateOnlyEnd(createdTo) } : {}),
    };
  }

  if (status) {
    where.status = toEnumFilter(
      status as PrismaLeadStatus | PrismaLeadStatus[],
    );
  }

  if (source) {
    where.source = toEnumFilter(
      source as PrismaLeadSource | PrismaLeadSource[],
    );
  }

  if (industry) {
    where.industry = toEnumFilter(
      industry as PrismaIndustry | PrismaIndustry[],
    );
  }

  if (productInterested) {
    where.productInterestId = Array.isArray(productInterested)
      ? { in: productInterested }
      : productInterested;
  }

  if (assignedToId) {
    where.assignedToId = Array.isArray(assignedToId)
      ? { in: assignedToId }
      : assignedToId;
  }

  if (user.role === ROLES.EXECUTIVE) {
    const requestedAssignedToIds = Array.isArray(assignedToId)
      ? assignedToId
      : assignedToId
        ? [assignedToId]
        : [];

    if (
      requestedAssignedToIds.length > 0 &&
      !requestedAssignedToIds.includes(user.id)
    ) {
      return {
        data: [],
        meta: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    where.assignedToId = user.id;
  } else if (user.role === ROLES.MANAGER) {
    where.assignedTo = {
      OR: [
        { id: user.id },
        { managerId: user.id },
      ],
    };
  }

  const leads = await leadRepository.getLeads(where, { page, limit });

  return {
    ...leads,
    data: leads.data.map(toLeadDTO),
  };
}

async function getLeadById(
  id: string,
  user: SafeUser,
  organizationId: string,
): Promise<Lead> {
  const existingLead = await leadRepository.getLeadById(id, organizationId);
  if (!existingLead) {
    throw AppError.resource.notFound("Lead");
  }

  ensureOwnership(user, existingLead);

  return toLeadDTO(existingLead);
}

async function updateLeadStatus(
  id: string,
  data: UpdateLeadStatusInput,
  user: SafeUser,
  organizationId: string,
): Promise<UpdateLeadStatusResult> {
  const existingLead = await leadRepository.findLeadById(id, organizationId);
  if (!existingLead) {
    throw AppError.resource.notFound("Lead");
  }

  ensureOwnership(user, existingLead);
  ensureEditableLead(existingLead);
  ensureStatusChangeAllowed(existingLead, user);

  logger.info("Lead status updating", {
    leadId: id,
    oldStatus: existingLead.status,
    newStatus: data.status,
    userId: user.id,
  });

  if (data.status === PrismaLeadStatus.QUALIFIED) {
    const runQualification = async () =>
      prisma.$transaction(async (tx: DB): Promise<UpdateLeadStatusResult> => {
        const existingProspect = await prospectRepository.findByLeadId(
          id,
          organizationId,
          tx,
        );

        if (existingProspect) {
          const lead = await tx.lead.update({
            where: { id },
            data: {
              status: PrismaLeadStatus.QUALIFIED,
              convertedAt: existingLead.convertedAt ?? new Date(),
              convertedById: existingLead.convertedById ?? user.id,
            },
            include: leadInclude,
          });

          await leadRepository.createLeadActivity(
            {
              leadId: id,
              type: "STATUS_CHANGE",
              remark: data.remark,
              previousStatus: existingLead.status,
              newStatus: data.status,
              createdById: user.id,
            },
            tx,
          );

          return {
            lead: toLeadDTO(lead),
            message: "Lead qualified and converted to prospect",
            prospect: {
              id: existingProspect.id,
              prospectNo: existingProspect.prospectNo,
              isNew: false,
            },
          };
        }

        await prospectRepository.unlinkDeletedProspect(id, organizationId, tx);

        await assertWithinLimit(
          organizationId,
          "MAX_PROSPECTS",
          billingRepository.countProspects,
          tx,
        );

        const convertedAt = new Date();
        await tx.lead.update({
          where: { id },
          data: {
            status: PrismaLeadStatus.QUALIFIED,
            convertedAt,
            convertedById: user.id,
          },
        });

        const prospect = await prospectRepository.createWithGeneratedNumber(
          organizationId,
          {
            lead: { connect: { id } },
            organization: { connect: { id: organizationId } },
            stage: ProspectStage.REQUIREMENT,
            assignedTo: existingLead.assignedToId
              ? { connect: { id: existingLead.assignedToId } }
              : undefined,
          },
          tx,
        );

        await leadRepository.createLeadActivity(
          {
            leadId: id,
            type: "STATUS_CHANGE",
            remark: data.remark,
            previousStatus: existingLead.status,
            newStatus: data.status,
            createdById: user.id,
          },
          tx,
        );

        await prospectRepository.createActivity(
          {
            prospectId: prospect.id,
            type: ProspectActivityType.CONVERSION,
            title: "Lead converted",
            summary: `Converted from lead ${existingLead.leadNo}`,
            details: `Prospect ${prospect.prospectNo} created from lead ${existingLead.leadNo}.`,
            metadata: {
              sourceLeadId: existingLead.id,
              sourceLeadNo: existingLead.leadNo,
            },
            createdById: user.id,
          },
          tx,
        );

        const lead = await tx.lead.findFirst({
          where: { id, organizationId, deletedAt: null },
          include: leadInclude,
        });

        if (!lead) {
          throw AppError.resource.notFound("Lead");
        }

        return {
          lead: toLeadDTO(lead),
          message: "Lead qualified and converted to prospect",
          prospect: {
            id: prospect.id,
            prospectNo: prospect.prospectNo,
            isNew: true,
          },
        };
      });

    try {
      return await runQualification();
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const target = getUniqueErrorTarget(error);
      logger.warn("Lead qualification hit unique constraint", {
        leadId: id,
        leadNo: existingLead.leadNo,
        organizationId,
        userId: user.id,
        prismaCode: "P2002",
        target,
      });

      const existingProspect = await prospectRepository.findByLeadId(
        id,
        organizationId,
      );

      if (uniqueErrorTargetsField(error, "leadId") && existingProspect) {
        return prisma.$transaction(async (tx: DB) => {
          const lead = await tx.lead.update({
            where: { id },
            data: {
              status: PrismaLeadStatus.QUALIFIED,
              convertedAt: existingLead.convertedAt ?? new Date(),
              convertedById: existingLead.convertedById ?? user.id,
            },
            include: leadInclude,
          });

          return {
            lead: toLeadDTO(lead),
            message: "Lead qualified and converted to prospect",
            prospect: {
              id: existingProspect.id,
              prospectNo: existingProspect.prospectNo,
              isNew: false,
            },
          };
        });
      }

      if (uniqueErrorTargetsField(error, "prospectNo")) {
        try {
          return await runQualification();
        } catch (retryError) {
          if (!isUniqueConstraintError(retryError)) {
            throw retryError;
          }
          logger.warn("Lead qualification prospect number retry failed", {
            leadId: id,
            leadNo: existingLead.leadNo,
            organizationId,
            userId: user.id,
            prismaCode: "P2002",
            target: getUniqueErrorTarget(retryError),
          });
          throw controlledUniqueError(retryError);
        }
      }

      throw controlledUniqueError(error);
    }
  }

  const lead = await leadRepository.updateLead(
    id,
    {
      status: data.status as PrismaLeadStatus,
    },
    organizationId,
  );

  if (!lead) {
    throw AppError.resource.notFound("Lead");
  }

  // Create STATUS_CHANGE activity for non-QUALIFIED status changes
  await leadRepository.createLeadActivity({
    leadId: id,
    type: "STATUS_CHANGE",
    remark: data.remark,
    previousStatus: existingLead.status,
    newStatus: data.status,
    createdById: user.id,
  });

  return {
    lead: toLeadDTO(lead),
    message: "Lead status updated successfully",
  };
}

async function convertLeadToProspect(
  id: string,
  data: Omit<ConvertLeadToProspectInput, "leadId">,
  user: SafeUser,
  organizationId: string,
) {
  const existingLead = await leadRepository.findLeadById(id, organizationId);
  if (!existingLead) {
    throw AppError.resource.notFound("Lead");
  }

  ensureOwnership(user, existingLead);
  ensureEditableLead(existingLead);
  ensureStatusChangeAllowed(existingLead, user);

  if (existingLead.status !== "QUALIFIED") {
    throw AppError.validation.badRequest(
      "Only qualified leads can be converted to prospects",
    );
  }

  logger.info("Converting lead to prospect", {
    leadId: id,
    userId: user.id,
    status: existingLead.status,
  });

  return prospectService.convertLeadToProspect(
    { leadId: id, ...data },
    user,
    organizationId,
  );
}

async function getAssignableUsers(user: SafeUser, organizationId: string) {
  const where: Prisma.UserWhereInput = {
    organizationId,
    status: UserStatus.ACTIVE,
  };

  if (user.role === ROLES.EXECUTIVE) {
    where.id = user.id;
  } else if (user.role === ROLES.MANAGER) {
    where.OR = [{ id: user.id }, { role: ROLES.EXECUTIVE }];
  }

  return userRepository.findMany(where);
}

type LeadActivityRow = NonNullable<
  Awaited<ReturnType<typeof leadRepository.findLeadActivity>>
>;

/** API shape of a lead activity, including whether this user may still change it. */
const toLeadActivityDTO = (row: LeadActivityRow, user: SafeUser, now: Date) => {
  const modifiable = canModifyActivity(user, row, now);
  return {
    id: row.id,
    leadId: row.leadId,
    type: row.type,
    remark: row.remark,
    previousStatus: row.previousStatus,
    newStatus: row.newStatus,
    occurredAt: row.occurredAt.toISOString(),
    createdById: row.createdById,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    loggedLateMinutes: loggedLateMinutes(row.occurredAt, row.createdAt),
    isEdited: row.updatedById !== null,
    canEdit: modifiable,
    canDelete: modifiable,
  };
};

/** Whitelisted fields for audit snapshots. */
const leadActivitySnapshot = (row: LeadActivityRow) => ({
  activityId: row.id,
  type: row.type,
  occurredAt: row.occurredAt.toISOString(),
  remark: row.remark,
});

const getOwnedLead = async (leadId: string, user: SafeUser, organizationId: string) => {
  const existingLead = await leadRepository.findLeadById(leadId, organizationId);
  if (!existingLead) {
    throw AppError.resource.notFound("Lead");
  }
  ensureOwnership(user, existingLead);
  return existingLead;
};

/**
 * Logs something that happened with a lead. occurredAt is when it happened (any
 * past time, never the future); createdAt stays the time it was logged.
 */
async function createLeadActivity(
  leadId: string,
  data: CreateLeadActivityInput,
  user: SafeUser,
  organizationId: string,
) {
  await getOwnedLead(leadId, user, organizationId);

  // Don't allow STATUS_CHANGE type manually — it's system-generated
  if ((data.type as string) === "STATUS_CHANGE") {
    throw AppError.validation.badRequest(
      "STATUS_CHANGE activities are created automatically when status changes",
    );
  }

  const now = new Date();

  // A retry of a request that already succeeded returns the saved activity.
  if (data.clientRequestId) {
    const retried = await leadRepository.findLeadActivityByClientRequestId(
      leadId,
      data.clientRequestId,
    );
    if (retried) return toLeadActivityDTO(retried, user, now);
  }

  const occurredAt = data.occurredAt ? new Date(data.occurredAt) : now;
  assertOccurredAt({ occurredAt, now });

  try {
    const created = await leadRepository.createLeadActivity({
      leadId,
      type: data.type,
      remark: data.remark,
      occurredAt,
      clientRequestId: data.clientRequestId ?? null,
      createdById: user.id,
    });
    return toLeadActivityDTO(created, user, now);
  } catch (error) {
    if (data.clientRequestId && isUniqueConstraintError(error)) {
      const retried = await leadRepository.findLeadActivityByClientRequestId(
        leadId,
        data.clientRequestId,
      );
      if (retried) return toLeadActivityDTO(retried, user, new Date());
    }
    throw error;
  }
}

async function getLeadActivities(
  leadId: string,
  user: SafeUser,
  organizationId: string,
) {
  await getOwnedLead(leadId, user, organizationId);

  const activities = await leadRepository.getLeadActivities(leadId, organizationId);
  const now = new Date();
  return (activities ?? []).map((row) => toLeadActivityDTO(row, user, now));
}

/** Corrects a logged activity: its creator within 24 hours, admins any time. */
async function updateLeadActivity(
  leadId: string,
  activityId: string,
  data: UpdateLeadActivityInput,
  user: SafeUser,
  organizationId: string,
) {
  await getOwnedLead(leadId, user, organizationId);

  const row = await leadRepository.findLeadActivity(activityId, leadId);
  if (!row) {
    throw AppError.resource.notFound("Activity");
  }

  const now = new Date();
  if (row.type === "STATUS_CHANGE") {
    throw AppError.business.ruleViolation("Status changes can't be edited");
  }
  if (!canModifyActivity(user, row, now)) {
    throw AppError.authorization.forbidden(
      "You can edit your own activities for 24 hours after logging them",
    );
  }

  const occurredAt = data.occurredAt ? new Date(data.occurredAt) : row.occurredAt;
  assertOccurredAt({ occurredAt, now });

  const updated = await leadRepository.updateLeadActivity(activityId, {
    ...(data.type ? { type: data.type } : {}),
    ...(data.remark !== undefined ? { remark: data.remark } : {}),
    occurredAt,
    updatedById: user.id,
  });

  return {
    activity: toLeadActivityDTO(updated, user, now),
    before: leadActivitySnapshot(row),
    after: leadActivitySnapshot(updated),
  };
}

/** Soft-deletes a logged activity under the same rule as editing it. */
async function deleteLeadActivity(
  leadId: string,
  activityId: string,
  user: SafeUser,
  organizationId: string,
) {
  await getOwnedLead(leadId, user, organizationId);

  const row = await leadRepository.findLeadActivity(activityId, leadId);
  if (!row) {
    throw AppError.resource.notFound("Activity");
  }
  if (row.type === "STATUS_CHANGE") {
    throw AppError.business.ruleViolation("Status changes can't be deleted");
  }
  if (!canModifyActivity(user, row, new Date())) {
    throw AppError.authorization.forbidden(
      "You can delete your own activities for 24 hours after logging them",
    );
  }

  await leadRepository.updateLeadActivity(activityId, {
    deletedAt: new Date(),
    deletedById: user.id,
  });
  return leadActivitySnapshot(row);
}

export const leadService = {
  assignLead,
  convertLeadToProspect,
  createLead,
  createLeadActivity,
  getLeadActivities,
  updateLeadActivity,
  deleteLeadActivity,
  getLeadById,
  getLeads,
  getAssignableUsers,
  importLeads,
  softDeleteLead,
  updateLeadStatus,
  updateLead,
};
