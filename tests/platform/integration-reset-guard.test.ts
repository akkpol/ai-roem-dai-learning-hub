import { describe, expect, it } from "vitest";

import { assertSafeIntegrationReset } from "../integration/database/global-setup";

describe("assertSafeIntegrationReset", () => {
  it("rejects a local test database without its exact acknowledgement", () => {
    expect(() => assertSafeIntegrationReset(
      "postgresql://migrator:secret@127.0.0.1/learning_hub_test",
      {},
    )).toThrow("Refusing destructive integration reset");
  });

  it("rejects a remote test database without the exact acknowledgement", () => {
    expect(() => assertSafeIntegrationReset(
      "postgresql://migrator:secret@db.example.com/learning_hub_test",
      { REMOTE_TEST_DATABASE_RESET_ACK: "other_test" },
    )).toThrow("Refusing destructive integration reset");
  });

  it("allows a remote test database with its exact acknowledgement", () => {
    expect(() => assertSafeIntegrationReset(
      "postgresql://migrator:secret@db.example.com/learning_hub_test",
      { REMOTE_TEST_DATABASE_RESET_ACK: "learning_hub_test" },
    )).not.toThrow();
  });

  it("rejects a non-test database even when acknowledged", () => {
    expect(() => assertSafeIntegrationReset(
      "postgresql://migrator:secret@127.0.0.1/learning_hub",
      { REMOTE_TEST_DATABASE_RESET_ACK: "learning_hub" },
    )).toThrow("Refusing destructive integration reset");
  });
});
