import { describe, expect, it } from "vitest";

import * as identity from "@/modules/identity";

describe("Identity public authentication boundary", () => {
  it("exports only Learning Hub orchestration entry points", () => {
    expect(identity.createIdentityService).toBeTypeOf("function");
    expect(Object.keys(identity)).toEqual(
      expect.arrayContaining([
        "createIdentityService",
        "parseSignUpCommand",
        "parseSignInCommand",
        "parseResetRequestCommand",
        "parseResetPasswordCommand",
      ]),
    );
    expect(Object.keys(identity)).not.toEqual(
      expect.arrayContaining(["auth", "handler", "toNextJsHandler"]),
    );
  });
});
