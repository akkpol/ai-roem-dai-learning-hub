import type { DatabaseTransaction } from "@/platform/database/transaction";

import type { IdentityConfig } from "../config";
import { identityEmailOutbox } from "../schema";
import {
  encryptAuthEmailIntent,
  hashAuthEmailRecipient,
  type AuthEmailIntent,
} from "./crypto";

export async function enqueueAuthEmail(
  transaction: DatabaseTransaction,
  config: IdentityConfig,
  accountId: string,
  intent: AuthEmailIntent,
  expiresAt: Date,
): Promise<void> {
  await transaction.insert(identityEmailOutbox).values({
    accountId,
    template: intent.template,
    recipientHash: hashAuthEmailRecipient(intent.email, config.emailEncryptionKey),
    encryptedPayload: encryptAuthEmailIntent(intent, config.emailEncryptionKey),
    keyVersion: config.emailKeyVersion,
    expiresAt,
  });
}
