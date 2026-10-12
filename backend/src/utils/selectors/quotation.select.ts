export const quotationListInclude = {
  assignedTo: {
    select: { id: true, firstName: true, lastName: true, email: true, managerId: true },
  },
  createdBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  organization: {
    select: {
      id: true,
      name: true,
      prefix: true,
      address: true,
      gstin: true,
      mobile: true,
      email: true,
      companyLogo: true,
      qrCode: true,
      signature: true,
      bankName: true,
      accountHolderName: true,
      accountNumber: true,
      ifscCode: true,
      branchName: true,
      accountType: true,
    },
  },
} as const;

export const quotationInclude = {
  ...quotationListInclude,
  deletedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  approvedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  rejectedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  statusHistory: {
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      reason: true,
      changedAt: true,
      changedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: { changedAt: "desc" as const },
  },
  attachments: {
    select: {
      id: true,
      quotationId: true,
      organizationId: true,
      key: true,
      originalName: true,
      mimeType: true,
      size: true,
      type: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
} as const;
