// Intentionally excluded from the normal suite: this is the observed failing compatibility contract.
import { memoryAdapter } from "better-auth/adapters/memory";
import { betterAuth } from "better-auth";
import { expect, it } from "vitest";

it("invalidates the previous reset token when a new one is requested", async () => {
  const resetTokens: string[] = [];
  const auth = betterAuth({
    baseURL: "http://localhost:3000/api/auth",
    secret: "session-003-reset-token-reproduction-secret",
    database: memoryAdapter({
      user: [],
      session: [],
      account: [],
      verification: [],
      rateLimit: [],
    }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      sendResetPassword: async ({ token }) => {
        resetTokens.push(token);
      },
    },
  });
  const email = "reset-reproduction@example.test";
  await auth.api.signUpEmail({
    body: {
      name: "Reset Reproduction",
      email,
      password: "correct-horse-battery-staple-old",
    },
  });
  await auth.api.requestPasswordReset({ body: { email } });
  await auth.api.requestPasswordReset({ body: { email } });

  expect(resetTokens).toHaveLength(2);
  await expect(
    auth.api.resetPassword({
      body: {
        newPassword: "correct-horse-battery-staple-new",
        token: resetTokens[0],
      },
    }),
  ).rejects.toMatchObject({ statusCode: 400 });
});
