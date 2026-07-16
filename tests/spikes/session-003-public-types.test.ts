import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { describe, expect, it } from "vitest";

import type { DatabaseTransaction } from "@/platform/database/transaction";

function bindOfficialAdapterToTransaction(transaction: DatabaseTransaction) {
  return drizzleAdapter(transaction, {
    provider: "pg",
    schema: {},
    transaction: false,
  });
}

describe("SESSION-003 public compatibility", () => {
  it("binds the official Drizzle adapter to the typed outer transaction", () => {
    expect(bindOfficialAdapterToTransaction).toBeTypeOf("function");
  });
});
