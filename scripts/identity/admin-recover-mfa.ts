import { z } from "zod";

const environmentSchema = z.enum(["development", "test", "preview", "production"]);
const optionsSchema = z.object({
  accountId: z.string().uuid(),
  incidentId: z.string().regex(/^[A-Z][A-Z0-9-]{2,63}$/),
  environment: environmentSchema,
  confirmation: environmentSchema,
});

function readArgument(argv: string[], name: string): string | undefined {
  return argv
    .find((argument) => argument.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
}

export function readRecoverMfaOptions(
  argv: string[],
  env: NodeJS.ProcessEnv,
) {
  const options = optionsSchema.parse({
    accountId: readArgument(argv, "account"),
    incidentId: readArgument(argv, "incident"),
    environment: readArgument(argv, "environment"),
    confirmation: readArgument(argv, "confirm-environment"),
  });
  if (
    options.environment !== options.confirmation ||
    options.environment !== env.IDENTITY_OPERATOR_ENVIRONMENT
  ) {
    throw new Error("break-glass environment confirmation does not match");
  }
  return options;
}

async function main() {
  const options = readRecoverMfaOptions(process.argv.slice(2), process.env);
  const operatorUrl = process.env.IDENTITY_OPERATOR_DATABASE_URL;
  if (!operatorUrl) throw new Error("operator database configuration is invalid");
  const [{ recoverPlatformAdminMfa }, { createDatabaseConnection }, { readDatabaseConfig }] =
    await Promise.all([
      import("../../src/modules/identity/administration"),
      import("../../src/platform/database/client"),
      import("../../src/platform/database/config"),
    ]);
  const connection = createDatabaseConnection(
    readDatabaseConfig({ ...process.env, DATABASE_URL: operatorUrl }),
  );
  try {
    const result = await recoverPlatformAdminMfa(connection.db, {
      accountId: options.accountId,
      incidentId: options.incidentId,
      environment: options.environment,
      confirmationEnvironment: options.confirmation,
      operatorEnvironment: process.env.IDENTITY_OPERATOR_ENVIRONMENT,
    });
    console.info("identity.admin_recover_mfa.completed", {
      accountId: options.accountId,
      incidentId: options.incidentId,
      revokedSessions: result.revokedSessions,
    });
  } finally {
    await connection.close();
  }
}

main().catch((error: Error) => {
  console.error("identity.admin_recover_mfa.failed", {
    errorName: error.name,
  });
  process.exitCode = 1;
});
