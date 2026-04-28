"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { CommentService } from "@/lib/services/comment.service";

function pathForDealView(fromPath: "dealer" | "lender", dealId: string) {
  return fromPath === "dealer" ? `/dealer/deals/${dealId}` : `/lender/intake/${dealId}`;
}

export async function submitDealCommentAction(
  fromPath: "dealer" | "lender",
  dealId: string,
  body: string,
  parentCommentId: string | null,
  linkedEntityType: string | null,
  linkedEntityId: string | null,
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const t = body.trim();
  if (!t) return { error: "Comment is empty." } as const;
  try {
    await CommentService.createComment({
      dealId,
      authorId: session.user.id,
      authorWorkspaceId: session.user.workspaceId,
      body: t,
      parentCommentId: parentCommentId || undefined,
      linkedEntityType: linkedEntityType || undefined,
      linkedEntityId: linkedEntityId || undefined,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to post comment." } as const;
  }
  revalidatePath(pathForDealView(fromPath, dealId));
  return { ok: true } as const;
}

export async function resolveDealCommentAction(fromPath: "dealer" | "lender", dealId: string, commentId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  await CommentService.resolveComment(commentId, session.user.id, session.user.workspaceId);
  revalidatePath(pathForDealView(fromPath, dealId));
  return { ok: true } as const;
}
