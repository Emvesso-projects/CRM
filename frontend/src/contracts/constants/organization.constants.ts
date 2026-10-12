export const ORGANIZATION_STATUS_VALUES = ["ACTIVE", "SUSPENDED"] as const;

/** Legal form of the business. Mirrors the backend contract. */
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

/** Select options, in display order. */
export const ORGANIZATION_TYPE_OPTIONS = ORGANIZATION_TYPE_VALUES.map(
  (value) => ({ value, label: ORGANIZATION_TYPE_LABELS[value] }),
);
