import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createSession003Spike,
  type Session003Spike,
} from "../../spikes/session-003-spike-harness";

describe("SESSION-003 Better Auth transaction compatibility", () => {
  let spike: Session003Spike;

  beforeAll(async () => {
    spike = createSession003Spike(process.env);
    await spike.prepare();
  });

  afterAll(async () => {
    await spike.close();
  });

  it("rolls mapped auth and atomic signup rows back together", async () => {
    const email = `rollback-${crypto.randomUUID()}@example.test`;

    await expect(spike.signUp(email, { forceRollback: true })).rejects.toThrow(
      "session-003-forced-rollback",
    );

    await expect(spike.countSignupRows(email)).resolves.toEqual({
      accounts: 0,
      authFactors: 0,
      profiles: 0,
      policyAcceptances: 0,
      signupAudits: 0,
      emailOutbox: 0,
    });
  });

  it("awaits verification email persistence before signup returns", async () => {
    const email = `verify-${crypto.randomUUID()}@example.test`;

    const result = await spike.signUp(email);

    expect(result.verificationCallbackCompleted).toBe(true);
    await expect(spike.countSignupRows(email)).resolves.toEqual({
      accounts: 1,
      authFactors: 1,
      profiles: 1,
      policyAcceptances: 2,
      signupAudits: 1,
      emailOutbox: 1,
    });
  });

  it("rolls reset verification and encrypted outbox rows back together", async () => {
    const email = `reset-${crypto.randomUUID()}@example.test`;
    await spike.signUp(email);
    const before = await spike.countResetRows(email);

    await expect(
      spike.requestPasswordReset(email, { forceRollback: true }),
    ).rejects.toThrow("session-003-forced-rollback");

    expect(await spike.countResetRows(email)).toEqual(before);
  });

  it("awaits reset email persistence and stores no plaintext token", async () => {
    const email = `reset-commit-${crypto.randomUUID()}@example.test`;
    await spike.signUp(email);

    const result = await spike.requestPasswordReset(email);

    expect(result.resetCallbackCompleted).toBe(true);
    expect(result.plaintextToken).not.toHaveLength(0);
    expect(result.persistedPayload).not.toContain(result.plaintextToken);
    await expect(spike.countResetRows(email)).resolves.toEqual({
      verifications: 1,
      emailOutbox: 1,
      resetAudits: 1,
    });
  });

  it("invalidates the earlier sequential reset token and consumes the latest once", async () => {
    const email = `reset-sequential-${crypto.randomUUID()}@example.test`;
    await spike.signUp(email);

    const first = await spike.requestPasswordReset(email);
    const second = await spike.requestPasswordReset(email);

    await expect(spike.resetPassword(first.plaintextToken)).resolves.toBe(400);
    await expect(spike.resetPassword(second.plaintextToken)).resolves.toBe(200);
    await expect(spike.resetPassword(second.plaintextToken)).resolves.toBe(400);
    await expect(spike.countResetRows(email)).resolves.toMatchObject({
      verifications: 0,
      resetAudits: 2,
    });
  });

  it("serializes concurrent reset requests and leaves only the later request usable", async () => {
    const email = `reset-concurrent-${crypto.randomUUID()}@example.test`;
    await spike.signUp(email);
    let releaseFirstLock: (() => void) | undefined;
    const firstCanCommit = new Promise<void>((resolve) => {
      releaseFirstLock = resolve;
    });
    let announceFirstLock: (() => void) | undefined;
    const firstHasLock = new Promise<void>((resolve) => {
      announceFirstLock = resolve;
    });

    const firstRequest = spike.requestPasswordReset(email, {
      afterAccountLocked: async () => {
        announceFirstLock?.();
        await firstCanCommit;
      },
    });
    await firstHasLock;
    const secondRequest = spike.requestPasswordReset(email);
    await new Promise((resolve) => setTimeout(resolve, 25));
    releaseFirstLock?.();
    const [first, second] = await Promise.all([firstRequest, secondRequest]);

    await expect(spike.resetPassword(first.plaintextToken)).resolves.toBe(400);
    await expect(spike.resetPassword(second.plaintextToken)).resolves.toBe(200);
    await expect(spike.countResetRows(email)).resolves.toMatchObject({
      verifications: 0,
      emailOutbox: 2,
      resetAudits: 2,
    });
  });

  it.each(["after-invalidation", "after-outbox"] as const)(
    "rolls a failure %s back and preserves the previously committed reset token",
    async (forceFailureAt) => {
      const email = `reset-rollback-${forceFailureAt}-${crypto.randomUUID()}@example.test`;
      await spike.signUp(email);
      const previous = await spike.requestPasswordReset(email);
      const before = await spike.countResetRows(email);

      await expect(
        spike.requestPasswordReset(email, { forceFailureAt }),
      ).rejects.toThrow(`session-003-forced-${forceFailureAt}`);

      await expect(spike.countResetRows(email)).resolves.toEqual(before);
      await expect(spike.resetPassword(previous.plaintextToken)).resolves.toBe(
        200,
      );
    },
  );

  it("deletes only the resolved account reset-password namespace", async () => {
    const targetEmail = `reset-namespace-${crypto.randomUUID()}@example.test`;
    const otherEmail = `reset-other-${crypto.randomUUID()}@example.test`;
    await spike.signUp(targetEmail);
    await spike.signUp(otherEmail);
    const targetPrevious = await spike.requestPasswordReset(targetEmail);
    const otherPrevious = await spike.requestPasswordReset(otherEmail);
    await spike.seedVerificationRows(targetEmail, [
      "email-verification:keep-target",
      "other-purpose:keep-target",
    ]);

    await spike.requestPasswordReset(targetEmail);

    await expect(spike.listVerificationIdentifiers(targetEmail)).resolves.toEqual(
      expect.arrayContaining([
        "email-verification:keep-target",
        "other-purpose:keep-target",
      ]),
    );
    await expect(spike.resetPassword(targetPrevious.plaintextToken)).resolves.toBe(
      400,
    );
    await expect(spike.resetPassword(otherPrevious.plaintextToken)).resolves.toBe(
      200,
    );
  });

  it("keeps unknown-email responses generic and public rate limiting intact", async () => {
    const unknownEmail = `unknown-${crypto.randomUUID()}@example.test`;
    const request = (ip: string) =>
      spike.publicRequestPasswordReset(unknownEmail, { ipAddress: ip });

    const knownShape = await spike.publicRequestPasswordReset(
      `also-unknown-${crypto.randomUUID()}@example.test`,
      { ipAddress: "192.0.2.20" },
    );
    const unknownShape = await request("192.0.2.21");
    expect(unknownShape.status).toBe(200);
    expect(await unknownShape.json()).toEqual(await knownShape.json());
    expect(await spike.countResetRows(unknownEmail)).toEqual({
      verifications: 0,
      emailOutbox: 0,
      resetAudits: 0,
    });

    await expect(request("192.0.2.22")).resolves.toMatchObject({ status: 200 });
    await expect(request("192.0.2.22")).resolves.toMatchObject({ status: 200 });
    await expect(request("192.0.2.22")).resolves.toMatchObject({ status: 200 });
    const limited = await request("192.0.2.22");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("x-retry-after")).toMatch(/^\d+$/);
  });

  it("does not expose a raw Better Auth catch-all entry point", async () => {
    const route = await spike.database.execute(sql`
      select 1 as route_boundary_is_application_owned
    `);

    expect(route.rowCount).toBe(1);
    expect(spike.publicEntryPoints).toEqual([
      "sign-up",
      "verify-email",
      "sign-in",
      "forgot-password",
      "reset-password",
      "sign-out",
    ]);
    expect(spike.rawBetterAuthHandlerExposed).toBe(false);
  });
});
