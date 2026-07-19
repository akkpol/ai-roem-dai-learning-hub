import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.integration.test.ts"],
    exclude: [
      "tests/integration/identity/session-003-compatibility.integration.test.ts",
      "tests/integration/database/migrations.integration.test.ts",
    ],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
