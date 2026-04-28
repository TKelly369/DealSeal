import { prisma } from "@/lib/db";
import { NotificationService } from "@/lib/services/notification.service";
import type { Prisma } from "@/generated/prisma";

const MENTION_RE = /@userId:([a-zA-Z0-9-]+)/g;

export type DealTimelineItem =
  | {
      kind: "custody";
      id: string;
      at: string;
      eventType: string;
      actorRole: string;
      label: string;
    }
  | {
      kind: "comment";
      id: string;
      at: string;
      body: string;
      parentCommentId: string | null;
      linkedEntityType: string | null;
      linkedEntityId: string | null;
      isException: boolean;
      isResolved: boolean;
      resolvedAt: string | null;
      author: { id: string; name: string | null; email: string | null };
      resolvedBy: { id: string; name: string | null; email: string | null } | null;
    };

function custodyLabel(eventType: string, metadata: Prisma.JsonValue): string {
  const m = (metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {}) as Record<string, unknown>;
  const ev = m.event;
  if (eventType === "INITIAL_DISCLOSURE_ACCEPTED" || (typeof ev === "string" && ev === "INITIAL_DISCLOSURE_ACCEPTED")) {
    return "Initial disclosure accepted and uploaded";
  }
  if (m.documentType) return `Document event · ${String(m.documentType)}`;
  return `Custody · ${eventType.replace(/_/g, " ").toLowerCase()}`;
}

async function assertUserCanAccessDeal(
  userId: string,
  workspaceId: string,
  deal: { id: string; dealerId: string; lenderId: string },
) {
  const onThisDeal =
    workspaceId === deal.dealerId || workspaceId === deal.lenderId
      ? await prisma.membership.findFirst({ where: { userId, workspaceId } })
      : null;
  if (onThisDeal) return;
  const ok = await prisma.deal.findFirst({
    where: { id: deal.id, OR: [{ dealerId: workspaceId }, { lenderId: workspaceId }] },
  });
  if (!ok) throw new Error("Not authorized for this deal.");
}

async function pickWorkspaceIdForMentionedUser(mentionedUserId: string, deal: { dealerId: string; lenderId: string }) {
  const memberships = await prisma.membership.findMany({ where: { userId: mentionedUserId } });
  if (memberships.find((x) => x.workspaceId === deal.dealerId)) return deal.dealerId;
  if (memberships.find((x) => x.workspaceId === deal.lenderId)) return deal.lenderId;
  return memberships[0]?.workspaceId ?? deal.lenderId;
}

async function computeIsException(
  dealId: string,
  linkedEntityType: string | null | undefined,
  linkedEntityId: string | null | undefined,
): Promise<{ isException: boolean }> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { negotiableInstrument: { select: { hdcStatus: true } } },
  });
  if (deal?.negotiableInstrument?.hdcStatus === "DEFECTIVE") {
    return { isException: true };
  }
  if (linkedEntityType === "COMPLIANCE_CHECK" && linkedEntityId) {
    const c = await prisma.complianceCheck.findFirst({
      where: { id: linkedEntityId, dealId },
      select: { status: true },
    });
    if (c?.status === "BLOCKED") return { isException: true };
  }
  return { isException: false };
}

export const CommentService = {
  async listTimelineForDeal(
    dealId: string,
    custodyEvents: Array<{
      id: string;
      eventType: string;
      actorRole: string;
      timestamp: Date;
      metadata: Prisma.JsonValue;
    }>,
  ): Promise<DealTimelineItem[]> {
    const comments = await prisma.dealComment.findMany({
      where: { dealId },
      orderBy: { createdAt: "asc" },
      include: {
        author: { select: { id: true, name: true, email: true } },
        resolvedBy: { select: { id: true, name: true, email: true } },
      },
    });

    const system: DealTimelineItem[] = custodyEvents.map((e) => ({
      kind: "custody",
      id: `c-${e.id}`,
      at: e.timestamp.toISOString(),
      eventType: e.eventType,
      actorRole: e.actorRole,
      label: custodyLabel(e.eventType, e.metadata),
    }));

    const human: DealTimelineItem[] = comments.map((c) => ({
      kind: "comment",
      id: c.id,
      at: c.createdAt.toISOString(),
      body: c.body,
      parentCommentId: c.parentCommentId,
      linkedEntityType: c.linkedEntityType,
      linkedEntityId: c.linkedEntityId,
      isException: c.isException,
      isResolved: c.isResolved,
      resolvedAt: c.resolvedAt?.toISOString() ?? null,
      author: c.author,
      resolvedBy: c.resolvedBy,
    }));

    return [...system, ...human].sort((a, b) => a.at.localeCompare(b.at));
  },

  async createComment(input: {
    dealId: string;
    authorId: string;
    authorWorkspaceId: string;
    body: string;
    parentCommentId?: string | null;
    linkedEntityType?: string | null;
    linkedEntityId?: string | null;
  }) {
    const deal = await prisma.deal.findUnique({ where: { id: input.dealId } });
    if (!deal) throw new Error("Deal not found");
    await assertUserCanAccessDeal(input.authorId, input.authorWorkspaceId, deal);

    const { isException: autoEx } = await computeIsException(
      input.dealId,
      input.linkedEntityType,
      input.linkedEntityId,
    );
    const comment = await prisma.dealComment.create({
      data: {
        dealId: input.dealId,
        authorId: input.authorId,
        body: input.body,
        parentCommentId: input.parentCommentId || null,
        linkedEntityType: input.linkedEntityType || null,
        linkedEntityId: input.linkedEntityId || null,
        isException: autoEx,
        isResolved: false,
      },
    });

    MENTION_RE.lastIndex = 0;
    const mentioned = new Set<string>();
    for (;;) {
      const m = MENTION_RE.exec(input.body);
      if (!m?.[1]) break;
      mentioned.add(m[1]);
    }
    for (const userId of mentioned) {
      const u = await prisma.user.findUnique({ where: { id: userId } });
      if (!u) continue;
      const ws = await pickWorkspaceIdForMentionedUser(userId, deal);
      await NotificationService.createNotification({
        workspaceId: ws,
        userId,
        dealId: deal.id,
        type: "DEAL_COMMENT_MENTION",
        title: "Mentioned on a deal",
        message: `You were mentioned on deal ${deal.id}.`,
      });
    }

    return comment;
  },

  async resolveComment(commentId: string, resolvingUserId: string, workspaceId: string) {
    const row = await prisma.dealComment.findUnique({
      where: { id: commentId },
      include: { deal: true },
    });
    if (!row) throw new Error("Comment not found");
    await assertUserCanAccessDeal(resolvingUserId, workspaceId, row.deal);
    return prisma.dealComment.update({
      where: { id: commentId },
      data: { isResolved: true, resolvedById: resolvingUserId, resolvedAt: new Date() },
    });
  },
};
