import {
  CustodyService,
  DealSealLedger,
  TrustedTimestampService,
} from "@dealseal/custody-ledger";
import type { CustodyLedgerPort } from "@dealseal/custody-ledger";
import type { Env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { logger } from "../../lib/logger.js";
import { DefaultCustodyCommandInterpreter } from "./default-command-interpreter.js";
import { PostgresCustodyProjectionWriter } from "./postgres-custody-projection.js";
import { PostgresDealAggregateLoader } from "./postgres-deal-aggregate-loader.js";
import { RetryingCustodyProjectionWriter } from "./retrying-projection-writer.js";
import { StubCustodyLedger } from "./stub-custody-ledger.js";

export type CustodyRuntime = {
  service: CustodyService;
  /** False when production is missing QLDB configuration (commands are rejected). */
  commandsEnabled: boolean;
};

export function createCustodyRuntime(env: Env): CustodyRuntime {
  const loader = new PostgresDealAggregateLoader(prisma);
  const innerProjection = new PostgresCustodyProjectionWriter(prisma);
  const projection = new RetryingCustodyProjectionWriter(innerProjection, {
    maxAttempts: 5,
    baseDelayMs: 250,
  });
  const interpreter = new DefaultCustodyCommandInterpreter();
  const tsa = new TrustedTimestampService({ useMockTsa: true });

  const ledgerName = env.DEALSEAL_QLDB_LEDGER_NAME?.trim();
  let ledger: CustodyLedgerPort;
  let commandsEnabled: boolean;

  if (ledgerName) {
    const region = env.DEALSEAL_QLDB_REGION?.trim() || process.env.AWS_REGION || "us-east-1";
    ledger = new DealSealLedger(ledgerName, region);
    commandsEnabled = true;
    logger.info("custody_ledger_qldb", { ledgerName, region });
  } else if (env.NODE_ENV === "production") {
    ledger = new StubCustodyLedger();
    commandsEnabled = false;
    logger.error("custody_ledger_missing_in_production", {
      message: "Set DEALSEAL_QLDB_LEDGER_NAME to enable custody writes.",
    });
  } else {
    ledger = new StubCustodyLedger();
    commandsEnabled = true;
    logger.warn("custody_ledger_stub_dev", {
      message: "DEALSEAL_QLDB_LEDGER_NAME unset — using in-memory ledger stub.",
    });
  }

  const service = new CustodyService(ledger, tsa, projection, loader, interpreter);
  return { service, commandsEnabled };
}
