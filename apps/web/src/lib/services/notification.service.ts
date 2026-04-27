import { prisma } from "@/lib/db";

type NotificationInput = {
  workspaceId: string;
  userId?: string | null;
  dealId?: string | null;
  type: string;
  title: string;
  message: string;
};

export const NotificationService = {
  async createNotification(input: NotificationInput) {
    return prisma.notification.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId ?? null,
        dealId: input.dealId ?? null,
        type: input.type,
        title: input.title,
        message: input.message,
      },
    });
  },

  async getNotificationsForWorkspace(workspaceId: string, userId?: string) {
    const where = {
      workspaceId,
      OR: [{ userId: null }, ...(userId ? [{ userId }] : [])],
    };
    const [unreadCount, records] = await Promise.all([
      prisma.notification.count({
        where: { ...where, isRead: false },
      }),
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);
    return { unreadCount, records };
  },

  async markAsRead(notificationIds: string[], workspaceId: string, userId?: string) {
    if (notificationIds.length === 0) return { count: 0 };
    const where = {
      id: { in: notificationIds },
      workspaceId,
      OR: [{ userId: null }, ...(userId ? [{ userId }] : [])],
    };
    return prisma.notification.updateMany({
      where,
      data: { isRead: true },
    });
  },
};

