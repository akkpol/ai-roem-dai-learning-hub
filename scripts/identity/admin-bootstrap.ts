import { z } from "zod";

const optionsSchema = z.object({
  accountId: z.string().uuid(),
  confirmation: z.literal("bootstrap-first-platform-admin"),
});

function readArgument(argv: string[], name: string): string | undefined {
  return argv
    .find((argument) => argument.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
}

export function readBootstrapOptions(argv: string[]) {
  return optionsSchema.parse({
    accountId: readArgument(argv, "account"),
    confirmation: readArgument(argv, "confirm"),
  });
}

async function main() {
  const options = readBootstrapOptions(process.argv.slice(2));
  const operatorUrl = process.env.IDENTITY_OPERATOR_DATABASE_URL;
  if (!operatorUrl) throw new Error("operator database configuration is invalid");
  const [{ bootstrapFirstPlatformAdmin }, { createDatabaseConnection }, { readDatabaseConfig }] =
    await Promise.all([
      import("../../src/modules/identity/administration"),
      import("../../src/platform/database/client"),
      import("../../src/platform/database/config"),
    ]);
  const connection = createDatabaseConnection(
    readDatabaseConfig({ ...process.env, DATABASE_URL: operatorUrl }),
  );
  try {
    const result = await bootstrapFirstPlatformAdmin(
      connection.db,
      options.accountId,
    );
    console.info("identity.admin_bootstrap.completed", {
      accountId: options.accountId,
      grantId: result.grantId,
    });
  } finally {
    await connection.close();
  }
}

main().catch((error: Error) => {
  console.error("identity.admin_bootstrap.failed", { errorName: error.name });
  process.exitCode = 1;
});
