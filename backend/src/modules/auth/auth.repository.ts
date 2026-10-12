import { Prisma } from "@prisma/client";
import { prisma, DB } from "../../config/db";
import { safeUserSelect } from "../../utils/selectors";

export const authRepository = {
  
  async findUserByEmail(email: string, tx?: DB) {
    const db = tx || prisma;
    return db.user.findUnique({
      where: { email },
      select: safeUserSelect,
    });
  },

  async findUserByEmailWithPassword(email: string, tx?: DB) {
    const db = tx || prisma;
    return db.user.findUnique({
      where: { email },
      include: {
        organization: {
          select: {
            status: true,
          },
        },
      },
    });
  },

  async findUserForPasswordReset(email: string, tx?: DB) {
    const db = tx || prisma;
    return db.user.findUnique({
      where: { email },
      include: {
        organization: {
          select: {
            status: true,
          },
        },
      },
    });
  },

  async findUserById(id: string, tx?: DB) {
    const db = tx || prisma;
    return db.user.findUnique({
      where: { id },
      select: safeUserSelect,
    });
  },

  async findUserByIdWithPassword(id: string, tx?: DB) {
    const db = tx || prisma;
    return db.user.findUnique({
      where: { id },
    });
  },

  async createUser(data: Prisma.UserCreateInput, tx?: DB) {
    const db = tx || prisma;
    return db.user.create({
      data,
      select: safeUserSelect,
    });
  },

  async updateUserLastLogin(id: string, tx?: DB) {
    const db = tx || prisma;
    return db.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
      select: safeUserSelect,
    });
  },

  async updateUserProfile(
    id: string,
    data: Prisma.UserUncheckedUpdateInput,
    tx?: DB,
  ) {
    const db = tx || prisma;
    return db.user.update({
      where: { id },
      data,
      select: safeUserSelect,
    });
  },

  async updateUserPassword(
    id: string,
    password: string,
    tx?: DB,
  ) {
    const db = tx || prisma;
    return db.user.update({
      where: { id },
      data: {
        password,
        passwordChangedAt: new Date(),
      },
      select: safeUserSelect,
    });
  },

  async createRefreshToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    ip?: string,
    userAgent?: string,
    tx?: DB,
  ) {
    const db = tx || prisma;
    return db.refreshToken.create({
      data: {
        token: tokenHash,
        userId,
        expiresAt,
        ip: ip ?? null,
        userAgent: userAgent ?? null,
      },
    });
  },

  async findRefreshToken(tokenHash: string, tx?: DB) {
    const db = tx || prisma;
    return db.refreshToken.findUnique({
      where: { token: tokenHash },
      include: {
        user: {
          include: {
            organization: {
              select: {
                status: true,
              },
            },
          },
        },
      },
    });
  },

  async markTokenAsReplaced(tokenHash: string, tx?: DB) {
    const db = tx || prisma;
    return db.refreshToken.update({
      where: { token: tokenHash },
      data: { replacedAt: new Date() },
    });
  },

  async markAsUsedAfterRotation(tokenHash: string, tx?: DB) {
    const db = tx || prisma;
    return db.refreshToken.update({
      where: { token: tokenHash },
      data: { isUsedAfterRotation: true },
    });
  },

  async deleteRefreshToken(tokenHash: string, tx?: DB) {
    const db = tx || prisma;
    try {
      return await db.refreshToken.delete({
        where: { token: tokenHash },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return null;
      }
      throw error;
    }
  },

  async deleteAllUserRefreshTokens(userId: string, tx?: DB) {
    const db = tx || prisma;
    return db.refreshToken.deleteMany({
      where: { userId },
    });
  },

  async deleteOldTokens(tx?: DB) {
    const db = tx || prisma;
    const oneMinuteAgo = new Date(Date.now() - 60000);
    return db.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { replacedAt: { lt: oneMinuteAgo } },
        ],
      },
    });
  },

  async createPasswordResetOtp(
    data: {
      userId: string;
      otpHash: string;
      expiresAt: Date;
      requestedIp?: string;
      requestedUserAgent?: string;
    },
    tx?: DB,
  ) {
    const db = tx || prisma;
    return db.passwordResetOtp.create({
      data: {
        userId: data.userId,
        otpHash: data.otpHash,
        expiresAt: data.expiresAt,
        requestedIp: data.requestedIp ?? null,
        requestedUserAgent: data.requestedUserAgent ?? null,
      },
    });
  },

  async findPasswordResetOtp(otpHash: string, tx?: DB) {
    const db = tx || prisma;
    return db.passwordResetOtp.findUnique({
      where: { otpHash },
      include: {
        user: {
          include: {
            organization: {
              select: {
                status: true,
              },
            },
          },
        },
      },
    });
  },

  async findLatestPendingPasswordResetOtp(userId: string, tx?: DB) {
    const db = tx || prisma;
    return db.passwordResetOtp.findFirst({
      where: {
        userId,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async incrementPasswordResetOtpFailures(id: string, tx?: DB) {
    const db = tx || prisma;
    return db.passwordResetOtp.update({
      where: { id },
      data: { failedAttempts: { increment: 1 } },
    });
  },

  async markPasswordResetOtpUsed(
    id: string,
    consumedIp?: string,
    consumedUserAgent?: string,
    tx?: DB,
  ) {
    const db = tx || prisma;
    return db.passwordResetOtp.updateMany({
      where: {
        id,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        usedAt: new Date(),
        consumedIp: consumedIp ?? null,
        consumedUserAgent: consumedUserAgent ?? null,
      },
    });
  },

  async revokeUnusedPasswordResetOtps(
    userId: string,
    excludeId?: string,
    tx?: DB,
  ) {
    const db = tx || prisma;
    return db.passwordResetOtp.updateMany({
      where: {
        userId,
        usedAt: null,
        revokedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      data: {
        revokedAt: new Date(),
      },
    });
  },

  async revokePasswordResetOtp(id: string, tx?: DB) {
    const db = tx || prisma;
    return db.passwordResetOtp.updateMany({
      where: {
        id,
        usedAt: null,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  },

  async deleteOldPasswordResetOtps(tx?: DB) {
    const db = tx || prisma;
    const retentionCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return db.passwordResetOtp.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: retentionCutoff } },
          { usedAt: { lt: retentionCutoff } },
          { revokedAt: { lt: retentionCutoff } },
        ],
      },
    });
  },

  // --- Pending signups -----------------------------------------------------
  // Signup's first request lands here; the second consumes it and creates the
  // organization. Kept apart from the OTP tables above because a pending signup
  // has no user to hang off and no history worth keeping.

  /**
   * Replace any pending signup for this address with a fresh one.
   *
   * Delete-then-create rather than the reset flow's revoke-then-create: `email`
   * is unique, so a retained old row would block the new one — and the row holds
   * a bcrypt hash, so keeping spent copies buys nothing. Call inside a
   * transaction so a request cannot land between the two statements.
   */
  async replacePendingSignup(
    data: {
      email: string;
      firstName: string;
      lastName: string;
      mobile: string;
      companyName: string;
      orgType: string;
      orgMobile: string;
      address: string;
      orgEmail: string | null;
      authorizedPerson: string | null;
      dateOfRegistration: Date | null;
      gstin: string | null;
      remark: string | null;
      passwordHash: string;
      otpHash: string;
      expiresAt: Date;
      requestedIp?: string;
      requestedUserAgent?: string;
    },
    tx?: DB,
  ) {
    const db = tx || prisma;
    await db.pendingSignup.deleteMany({ where: { email: data.email } });
    return db.pendingSignup.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        mobile: data.mobile,
        companyName: data.companyName,
        orgType: data.orgType,
        orgMobile: data.orgMobile,
        address: data.address,
        orgEmail: data.orgEmail,
        authorizedPerson: data.authorizedPerson,
        dateOfRegistration: data.dateOfRegistration,
        gstin: data.gstin,
        remark: data.remark,
        passwordHash: data.passwordHash,
        otpHash: data.otpHash,
        expiresAt: data.expiresAt,
        requestedIp: data.requestedIp ?? null,
        requestedUserAgent: data.requestedUserAgent ?? null,
      },
    });
  },

  async findPendingSignupByOtpHash(otpHash: string, tx?: DB) {
    const db = tx || prisma;
    return db.pendingSignup.findUnique({ where: { otpHash } });
  },

  async findPendingSignupByEmail(email: string, tx?: DB) {
    const db = tx || prisma;
    return db.pendingSignup.findUnique({ where: { email } });
  },

  async incrementPendingSignupFailures(id: string, tx?: DB) {
    const db = tx || prisma;
    return db.pendingSignup.update({
      where: { id },
      data: { failedAttempts: { increment: 1 } },
    });
  },

  async deletePendingSignup(id: string, tx?: DB) {
    const db = tx || prisma;
    return db.pendingSignup.deleteMany({ where: { id } });
  },

  /**
   * Consume a pending signup.
   *
   * The `count` the caller checks is what makes this single-use under
   * concurrency: two simultaneous confirms of the same code must not both go on
   * to create an organization. Same guarantee markPasswordResetOtpUsed gets from
   * its conditional updateMany — do not "simplify" either to an id-only write.
   */
  async consumePendingSignup(id: string, tx?: DB) {
    const db = tx || prisma;
    return db.pendingSignup.deleteMany({
      where: { id, expiresAt: { gt: new Date() } },
    });
  },

  /**
   * Purge abandoned signups. A much shorter tail than the OTP tables' 24h:
   * these rows carry a password hash, so there is no reason to keep an expired
   * one around for a day.
   */
  async deleteOldPendingSignups(tx?: DB) {
    const db = tx || prisma;
    const retentionCutoff = new Date(Date.now() - 60 * 60 * 1000);
    return db.pendingSignup.deleteMany({
      where: { expiresAt: { lt: retentionCutoff } },
    });
  },

  /**
   * Helper to fetch active refresh tokens for a user, ordered by creation.
   */
  async getActiveRefreshTokens(userId: string, tx?: DB) {
    const db = tx || prisma;
    return db.refreshToken.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },

  /**
   * Helper to rotate tokens and keep session count under control.
   */
  async rotateRefreshTokens(userId: string, tokensToKeep: string[], tx?: DB) {
    const db = tx || prisma;
    return db.refreshToken.deleteMany({
      where: {
        userId,
        id: { notIn: tokensToKeep },
      },
    });
  },
};
