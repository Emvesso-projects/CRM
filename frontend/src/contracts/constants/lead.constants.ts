export const LEAD_SOURCE_VALUES = [
  "COLD_CALL",
  "EMAIL",
  "REFERENCE",
  "SOCIAL_MEDIA",
  "WEBSITE",
  "ADVERTISE",
  "GOOGLE_ADS",
  "EVENT",
  "TRADE_SHOW",
  "FACEBOOK",
  "INSTAGRAM",
  "LINKEDIN",
  "OTHER",
] as const;

export const LEAD_INDUSTRY_VALUES = [
  "IT",
  "BANKING",
  "BANKING_FINANCE",
  "EDUCATION",
  "MANUFACTURING",
  "HEALTHCARE",
  "REAL_ESTATE",
  "RETAIL",
  "ECOMMERCE",
  "AUTOMOBILE",
  "CONSTRUCTION",
  "TRAVEL_TOURISM",
  "MEDIA_ENTERTAINMENT",
  "FOOD_BEVERAGES",
  "SCIENCE_TECHNOLOGY",
  "OTHER",
] as const;

export const LEAD_TYPE_VALUES = ["NEW", "EXISTING"] as const;

export const LEAD_STATUS_VALUES = [
  "NEW",
  "ATTEMPTED_CONTACT",
  "CONTACTED",
  "QUALIFIED",
  "UNQUALIFIED",
] as const;

export const LEAD_ACTIVITY_TYPE_VALUES = [
  "STATUS_CHANGE",
  "IN_PERSON_MEETING",
  "VIRTUAL_MEETING",
  "CALL",
  "EMAIL",
  "TEXT",
  "WHATSAPP",
  "MEETING",
  "SITE_VISIT",
  "NOTE",
] as const;

// Subset that users can manually create (STATUS_CHANGE is system-generated only)
export const LEAD_MANUAL_ACTIVITY_TYPE_VALUES = [
  "IN_PERSON_MEETING",
  "VIRTUAL_MEETING",
  "CALL",
  "EMAIL",
  "TEXT",
  "WHATSAPP",
  "MEETING",
  "SITE_VISIT",
  "NOTE",
] as const;
