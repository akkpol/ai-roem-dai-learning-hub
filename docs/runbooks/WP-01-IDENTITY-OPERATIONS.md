# WP-01 Identity Operations Runbook

**Scope:** PostgreSQL migration, Identity administration, Resend authentication
email delivery, signed delivery webhooks, scheduled retention/deletion work,
first-admin bootstrap, secret rotation, rollback, and incident recovery.

This runbook is an operator procedure. It does not authorize production data
fabrication, destructive acceptance tests, or bypassing the server-side
permission matrix.

## 1. Roles and runtime boundaries

Use separate PostgreSQL credentials:

- `DATABASE_URL` — pooled `learning_hub_app`; application reads and user/admin
  use cases. It can insert an email outbox intent but cannot update worker state.
- `IDENTITY_EMAIL_WORKER_DATABASE_URL` —
  `learning_hub_identity_email_worker`; claims and updates authentication email
  outbox rows and inserts delivery-ledger events. It cannot mutate Identity
  audit records.
- `IDENTITY_MAINTENANCE_DATABASE_URL` —
  `learning_hub_identity_maintenance`; deletion completion and bounded
  retention.
- migration credential — schema owner used only by the reviewed migration
  workflow.

Never reuse the migration credential in the application, webhook, or cron
runtime. Confirm the effective database, branch, role, and endpoint from the
provider before a migration or acceptance run; an environment-variable name is
not provider-identity evidence.

## 2. Required secrets and configuration

Configure Development, Preview, and Production independently:

- existing Identity variables: `AUTH_SECRET`, `AUTH_BASE_URL`,
  `AUTH_EMAIL_ENCRYPTION_KEY`, `AUTH_EMAIL_KEY_VERSION`,
  `AUTH_TERMS_VERSION`, `AUTH_PRIVACY_VERSION`, `AUTH_EMAIL_FROM`,
  `RESEND_API_KEY`, and `NEXT_PUBLIC_APP_URL`;
- Google OAuth variables: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `AUTH_TERMS_URL`, and `AUTH_PRIVACY_URL`. Google OAuth fails closed unless
  both credentials, both current policy versions, and both same-origin relative
  policy paths are configured;
- operations variables: `IDENTITY_EMAIL_WORKER_DATABASE_URL`,
  `IDENTITY_MAINTENANCE_DATABASE_URL`, `RESEND_WEBHOOK_SECRET`, and
  `CRON_SECRET`.

`CRON_SECRET` must be 32–256 characters. Resend webhook verification requires
the exact raw request body plus `svix-id`, `svix-timestamp`, and
`svix-signature`. Do not log any credential, token, email address, encrypted
payload, raw webhook body, or database URL.

## 3. Migration and rollback decision

1. Take a provider backup or disposable branch snapshot.
2. Verify the migration target identity and the schema-owner role.
3. Run all reviewed migrations, including
   `drizzle/0004_identity_operations.sql`, through the normal migration job.
4. Run the empty-database migration suite and the SESSION-006 PostgreSQL
   worker/ledger integration suite.
5. Verify:
   - `learning_hub_app` cannot update `identity_email_outbox`;
   - the email worker can claim/update outbox rows and insert delivery events;
   - the email worker cannot update/delete `identity_audit_events`;
   - the maintenance role can run bounded retention.

Migration `0004` is additive except for privilege hardening. Before enforcing
lease/payload constraints it moves legacy `sending` rows back to
`retry_wait` and purges payloads already in terminal states.

If migration validation fails, stop application rollout. Restore the
pre-migration branch/snapshot or correct forward on a new reviewed migration.
Do not drop the delivery ledger or weaken the role grants in-place. If the
schema is valid but runtime dispatch fails, disable the email cron while
leaving outbox rows intact for a later retry.

## 4. Resend domain and webhook

1. Use a dedicated sending subdomain and complete SPF, DKIM, and DMARC
   verification in Resend.
2. Set `AUTH_EMAIL_FROM` to that verified domain.
3. Configure the production webhook URL:
   `/api/webhooks/resend`.
4. Subscribe to email delivery events and store the signing secret as
   `RESEND_WEBHOOK_SECRET`.
5. Ensure the webhook path is reachable even when normal Preview/Production
   pages use Deployment Protection. Do not disable protection globally.
6. Send provider-sandbox messages and verify `sent`, `delivered`, `bounced`,
   `complained`, `failed`, duplicate, and out-of-order events in the immutable
   `identity_email_deliveries` ledger.

Resend send calls use the outbox UUID as the idempotency key. The worker owns a
five-minute database lease, retries retryable network/429/5xx/concurrent
idempotency failures with bounded exponential backoff, and purges encrypted
payloads on sent, expired, or dead-letter terminal states. Permanent provider
validation/auth/domain failures dead-letter instead of hot-looping.

## 5. GitHub Actions scheduler

`.github/workflows/identity-jobs.yml` invokes:

- `/api/jobs/identity/email-delivery` every five minutes, offset to minute 2;
- `/api/jobs/identity/retention` daily at 02:17 UTC.

Both routes are GET-only, accept no query parameters or account identifier, and
require `Authorization: Bearer <CRON_SECRET>`. Jobs are idempotent and tolerate
duplicate/concurrent scheduler delivery.

Scheduled GitHub Actions run only from the latest commit on the repository
default branch. Configure these repository settings after the application
Production deployment is ready:

- variable `IDENTITY_JOBS_BASE_URL`: the canonical HTTPS Production origin,
  without `/api` or credentials;
- secret `CRON_SECRET`: the exact same 32–256 character value configured in
  Vercel Production;
- variable `IDENTITY_EMAIL_DISPATCH_ENABLED=true`;
- variable `IDENTITY_RETENTION_ENABLED=true`.

Keep both enable variables false or absent until the matching database roles,
Resend configuration, and Production readiness check pass. Use
`workflow_dispatch` to invoke one selected job after merge; manual dispatch is
intentionally independent of the schedule-enable variables. Verify the response
and application telemetry before enabling schedules. Repository write access
therefore authorizes a one-off Production job invocation and must remain
restricted.

GitHub documents five minutes as the shortest schedule interval and warns that
scheduled runs can be delayed or dropped during high load. The workflow offsets
execution from minute zero, while application leases, idempotency, retry, and
oldest-pending-age monitoring remain the reliability controls. Email delivery
and retention use separate concurrency groups so a delayed five-minute run
cannot replace the daily retention run. A manual protected GET proves route
behavior, not scheduler execution.

## 6. First admin and normal role operations

1. Create and verify a real operator account through the normal user journey.
2. Enable TOTP 2FA and store recovery material with that operator.
3. Use the privileged operator environment and run:

   ```powershell
   npm run admin:bootstrap -- --account=<uuid> --confirm=bootstrap-first-platform-admin
   ```

4. Sign in with a fresh MFA-authenticated session.
5. Use `/admin/identity/accounts` to find a target by exact UUID or exact
   normalized email. Add the second platform admin through the normal audited
   grant flow.

Before Production, there must be at least two active platform admins owned by
different people with separate 2FA recovery material. Platform admins cannot
change their own role, status, or security state. Support operators receive
only the minimal support DTO and session-revocation action; platform admin does
not silently inherit that support permission.

## 7. Retention and deletion completion

The daily maintenance job uses a batch limit of 100 and is safe to rerun. It:

- removes expired verification/session/rate-limit records;
- purges terminal encrypted email payloads;
- removes email outbox and immutable delivery metadata after 90 days;
- completes due account deletions, purges credentials/sessions/PII, and emits
  the account-closed audit/event;
- removes/anonymizes policy and audit history two years after closure.

For operator inspection, run `npm run identity:retention` without `--execute`
against a confirmed non-production target. Execution requires the existing
non-production environment and provider-target acknowledgements. Never run a
destructive retention acceptance test against Production.

## 8. Secret rotation

- Rotate `CRON_SECRET`, deploy it, then verify both job routes reject the old
  value and accept the new value.
- Rotate `RESEND_WEBHOOK_SECRET` by adding a new provider endpoint/secret,
  deploying the new secret, delivering a signed test event, then removing the
  old endpoint.
- Rotate `RESEND_API_KEY` after deploying the replacement; revoke the old key
  only after a provider send succeeds.
- Rotate `AUTH_EMAIL_ENCRYPTION_KEY` with a reviewed multi-key migration. Do not
  replace the key while pending outbox payloads still reference the old
  `AUTH_EMAIL_KEY_VERSION`.
- Rotate database credentials per role and verify effective role/branch before
  revoking the old credential.

## 9. Monitoring and incidents

Alert on oldest pending outbox age, retry/dead-letter count, webhook rejection,
job failure, authorization denied by action, and database readiness latency.
Telemetry uses bounded correlation IDs/account UUIDs where appropriate and
never raw email labels.

For email backlog:

1. Set `IDENTITY_EMAIL_DISPATCH_ENABLED=false` if repeated sends are possible.
2. Inspect state counts and lease expiry without decrypting payloads.
3. Confirm provider/domain health and credential validity.
4. Re-enable dispatch; expired leases are reclaimed and provider idempotency
   prevents duplicate sends.

For a lost platform-admin MFA factor, follow the incident process and run
the existing break-glass CLI with the privileged operator credential in
`IDENTITY_OPERATOR_DATABASE_URL` and the exact target in
`IDENTITY_OPERATOR_ENVIRONMENT`:

```powershell
npm run admin:recover-mfa -- --account=<uuid> --incident=INC-123 `
  --environment=production --confirm-environment=production
```

It may only revoke sessions and reset 2FA for an already-active platform
admin; it cannot grant a role, change email, or reactivate a suspended
account. Before Production, two operators must tabletop this procedure and
retain the incident evidence.

## 10. Acceptance evidence

Automated build/tests do not require live provider secrets. Final production
acceptance separately records:

- exact commit and migration/provider target identity;
- green CI, PostgreSQL concurrency/privilege suite, and dependency audit;
- desktop/mobile/keyboard/focus/error/retry/destructive browser evidence using
  `npm run test:e2e:identity-operations`;
- verified Resend domain, signed webhook events, retry/dead-letter behavior,
  and payload purge;
- GitHub Actions Production scheduler logs for both jobs;
- two independent platform admins and the break-glass tabletop result.

Use exact `PASS`, `FAIL`, `NOT RUN`, or `BLOCKED` for each item. Missing provider
credentials, disposable accounts, plan capability, or two-admin ownership must
not be reported as a local implementation failure or as a false production
success.
