import { prisma } from "@/lib/db";

export async function getMembership(userId: string, workspaceId: string) {
  return prisma.membership.findFirst({
    where: { userId, workspaceId },
    select: { id: true, role: true },
  });
}

export async function getWorkspaceSubscription(workspaceId: string) {
  return prisma.subscription.findUnique({
    where: { workspaceId },
  });
}
