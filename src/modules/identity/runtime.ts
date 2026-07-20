import { getRuntimeDatabaseConnection } from "@/platform/database/client";

import { readIdentityConfig } from "./config";
import { createAuthHttpHandlers } from "./http";
import { createAccountHttpHandlers } from "./account-http";
import { createAccountSecurityService } from "./account-security";
import { createIdentityPrivacyService } from "./privacy";
import { consumeIdentityRateLimit } from "./rate-limit";
import { createIdentityService } from "./service";

export function getIdentityHttpHandlers() {
  const config = readIdentityConfig(process.env);
  const { db } = getRuntimeDatabaseConnection();
  return createAuthHttpHandlers({
    config,
    service: createIdentityService(db, config),
    consumeRateLimit: ({ endpoint, clientIp, windowSeconds, max }) =>
      consumeIdentityRateLimit(
        db,
        config.authSecret,
        endpoint,
        clientIp,
        { windowSeconds, max },
      ),
  });
}

export function getAccountHttpHandlers() {
  const config = readIdentityConfig(process.env);
  const { db } = getRuntimeDatabaseConnection();
  return createAccountHttpHandlers({
    config,
    account: createAccountSecurityService(db, config),
    privacy: createIdentityPrivacyService(db, config),
  });
}
