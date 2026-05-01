import { randomUUID } from "node:crypto";
import type { Command, CustodyService } from "@dealseal/custody-ledger";
import {
  DEAL_CREATED_COMMAND,
  STIPULATION_UPLOADED_COMMAND,
} from "./default-command-interpreter.js";
import { logger } from "../../lib/logger.js";

type Actor = {
  userId: string;
  role: string;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
};

function toSystemCtx(actor: Actor) {
  return {
    ip_address: actor.ipAddress ?? "0.0.0.0",
    user_agent: actor.userAgent ?? "server",
    device_fingerprint: actor.deviceFingerprint ?? "server",
  };
}

async function runCommandSafely(service: CustodyService, command: Command, actor: Actor): Promise<void> {
  try {
    const out = await service.handleCommand(command, toSystemCtx(actor));
    if (!out.projection.ok) {
      logger.error("custody_projection_deferred_after_qldb", {
        eventId: out.event.metadata.event_id,
        dealId: command.deal_id,
        err: out.projection.errorMessage,
      });
    }
  } catch (err) {
    logger.error("custody_domain_hook_failed", {
      commandType: command.commandType,
      dealId: command.deal_id,
      err: String(err),
    });
  }
}

export async function emitDealCreatedCustodyEvent(
  service: CustodyService,
  input: {
    dealId: string;
    dealType: string;
    lenderId: string;
    actor: Actor;
  },
): Promise<void> {
  const command: Command = {
    commandId: randomUUID(),
    commandType: DEAL_CREATED_COMMAND,
    deal_id: input.dealId,
    body: {
      deal_type: input.dealType,
      lender_id: input.lenderId,
    },
    issuedBy: { user_id: input.actor.userId, role: input.actor.role },
  };
  await runCommandSafely(service, command, input.actor);
}

export async function emitStipulationUploadedCustodyEvent(
  service: CustodyService,
  input: {
    dealId: string;
    documentName: string;
    mimeType: string;
    contentSha256Hash: string;
    actor: Actor;
  },
): Promise<void> {
  const command: Command = {
    commandId: randomUUID(),
    commandType: STIPULATION_UPLOADED_COMMAND,
    deal_id: input.dealId,
    body: {
      document_name: input.documentName,
      mime_type: input.mimeType,
      content_sha256_hash: input.contentSha256Hash,
    },
    issuedBy: { user_id: input.actor.userId, role: input.actor.role },
  };
  await runCommandSafely(service, command, input.actor);
}
