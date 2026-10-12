export const ORGANIZATION_STATUS_VALUES = ["ACTIVE", "SUSPENDED"] as const;

/**
 * Statuses accepted by the organization list filter. "ARCHIVED" is virtual —
 * it is not a column value, and organizationService.getAllOrganizations
 * translates it into a deletedAt check. Never accept it as a writable status.
 */
export const ORGANIZATION_STATUS_FILTER_VALUES = [
  ...ORGANIZATION_STATUS_VALUES,
  "ARCHIVED",
] as const;

/**
 * Legal form of the business. Stored as plain TEXT on Organization.orgType, so
 * adding a value needs no migration — but renaming or removing one does, to
 * rewrite the rows that hold it. Mirrored in the frontend contracts.
 */
export const ORGANIZATION_TYPE_VALUES = [
  "PROPRIETORSHIP",
  "PARTNERSHIP",
  "LLP",
  "PRIVATE_LIMITED",
  "PUBLIC_LIMITED",
  "OTHER",
] as const;

export const ORGANIZATION_TYPE_LABELS: Record<
  (typeof ORGANIZATION_TYPE_VALUES)[number],
  string
> = {
  PROPRIETORSHIP: "Proprietorship",
  PARTNERSHIP: "Partnership",
  LLP: "Limited Liability Partnership",
  PRIVATE_LIMITED: "Private Limited",
  PUBLIC_LIMITED: "Public Limited",
  OTHER: "Other",
};
