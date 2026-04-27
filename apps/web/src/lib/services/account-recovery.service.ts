import { prisma } from "@/lib/db";
import { hashSecret, randomToken, sha256 } from "@/lib/security";

const RESET_TTL_MINUTES = 15;

export const AccountRecoveryService = {
  async requestRecovery(emailRaw: string) {
    const email = emailRaw.trim().toLowerCase();
    if (!email) return { ok: true, usernameHint: "", resetToken: null as string | null };

    const token = randomToken(20);
    const tokenHash = sha256(token);
    const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60_000);

    await prisma.accountRecoveryToken.create({
      data: {
        email,
        tokenHash,
        expiresAt,
      },
    });

    const usernameHint = email.replace(/(.{2}).+(@.+)/, "$1***$2");
    return { ok: true, usernameHint, resetToken: token };
  },

  async resetPassword(tokenRaw: string, newPassword: string) {
    const tokenHash = sha256(tokenRaw.trim());
    const row = await prisma.accountRecoveryToken.findUnique({
      where: { tokenHash },
    });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new Error("Recovery token is invalid or expired.");
    }

    await prisma.userLoginOverride.upsert({
      where: { email: row.email },
      create: {
        email: row.email,
        passwordHash: hashSecret(newPassword),
      },
      update: {
        passwordHash: hashSecret(newPassword),
      },
    });

    await prisma.accountRecoveryToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });

    return { ok: true };
  },
};

