import { getRuntimeDatabaseConnection } from "@/platform/database/client";

import { readCoreAuthConfig, readIdentityConfig } from "./config";
import { createAuthHttpHandlers } from "./http";
import { createAccountHttpHandlers } from "./account-http";
import { createAccountSecurityService } from "./account-security";
import { createIdentityPrivacyService } from "./privacy";
import { consumeIdentityRateLimit } from "./rate-limit";
import { createIdentityService } from "./service";
import { createIdentityAdministrationService } from "./administration";
import { createIdentityAdminHttpHandlers } from "./admin-http";
import { createIdentityAuthorizationService } from "./authorization";
import { createGoogleLoginHandlers } from "./google-login";

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

export function getGoogleLoginHandlers() {
  const config = readCoreAuthConfig(process.env);
  const { db } = getRuntimeDatabaseConnection();
  return createGoogleLoginHandlers(db, config);
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

export function getIdentityAdminHttpHandlers() {
  const config = readIdentityConfig(process.env);
  const { db } = getRuntimeDatabaseConnection();
  const authorization = createIdentityAuthorizationService(db, config);
  return createIdentityAdminHttpHandlers({
    authenticate: authorization.authenticateRequest,
    administration: createIdentityAdministrationService(db),
    trustedOrigin: new URL(config.baseUrl).origin,
  });
}
