import type { Prospect } from "@/contracts/types";
import type { ProspectFormValues } from "../types";

export const prospectToFormValues = (prospect: Prospect): ProspectFormValues => {
  return {
    firstName: prospect.lead?.firstName ?? "",
    lastName: prospect.lead?.lastName ?? "",
    email: prospect.lead?.email ?? "",
    mobile: prospect.lead?.mobile ?? "",
    alternateMobile: prospect.lead?.alternateMobile ?? "",
    address: prospect.lead?.address ?? "",
    city: prospect.lead?.city ?? "",
    state: prospect.lead?.state ?? "",
    pinCode: prospect.lead?.pinCode ?? "",
    companyName: prospect.lead?.companyName ?? "",
    gstin: prospect.lead?.gstin ?? "",
    leadSource: prospect.lead?.source ?? "",
    industry: prospect.lead?.industry ?? "",
    customIndustry: "",
    leadType: prospect.lead?.leadType ?? "NEW",
    leadDate: prospect.createdAt
      ? new Date(prospect.createdAt).toISOString().split("T")[0]
      : "",
    productInterested:
      prospect.lead?.productInterest?.name ??
      prospect.lead?.productInterested ??
      "",
    expectedValue: prospect.expectedValue ? String(prospect.expectedValue) : "",
    assignedToId: prospect.assignedToId ?? "",
    notes: prospect.notes ?? prospect.lead?.requiredDescription ?? "",
  };
};
