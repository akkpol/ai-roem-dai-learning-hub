import { describe, expect, it } from "vitest";
import { readRuntimeEnv } from "@/platform/config/runtime-env";

describe("readRuntimeEnv", () => {
  it("accepts an explicit application URL", () => {
    expect(
      readRuntimeEnv({
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://learning.example.com",
      }),
    ).toEqual({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://learning.example.com",
    });
  });

  it("rejects a malformed application URL", () => {
    expect(() =>
      readRuntimeEnv({ NODE_ENV: "development", NEXT_PUBLIC_APP_URL: "not-a-url" }),
    ).toThrow();
  });
});
