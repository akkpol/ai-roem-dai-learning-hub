# SESSION-003 Authentication and Auth Email Execution Trace

**Work package:** WP-01 Platform Foundation and Identity
**Session:** SESSION-003
**Implementation branch:** `codex/wp-01-session-003`
**Starting revision:** `e5446736c0aacc0b1aa1b11d835a1ee188d2b0f6`
**Senior decision revision:** `8fb2f168f291f7cfaa1fcdce1ecb8d090f6e4d56`

## Authority

- Work only in the isolated SESSION-003 worktree.
- Preserve SESSION-002 migration/runtime credential separation, remote TLS
  checks, provider preflight safety, transactional outbox behavior, readiness,
  architecture boundaries, and secret-free errors.
- Stop after two local commits: implementation first, handoff second.
- Do not push, open a pull request, merge, deploy to Vercel Production, mutate
  the Neon default branch, open independent review, or declare WP-01 verified.

## Binding decisions

- Pin `better-auth` and `@better-auth/drizzle-adapter` to `1.6.23`; pin
  `resend` to `6.17.2`.
- Use one Learning Hub-owned outer Drizzle transaction. Instantiate Better Auth
  with the official Drizzle adapter bound to that transaction and call only its
  documented public server API.
- Do not write password hashes or create verification tokens directly. Do not
  use private Better Auth imports, undocumented adapter internals, database
  after hooks, casts that hide incompatibility, or a private-contract plugin.
- D-013 permits only a direct delete from mapped `identity_verifications` for
  the resolved account and exact `reset-password:` namespace, after a
  PostgreSQL row lock on that account and inside the same outer transaction as
  the public `requestPasswordReset` call, awaited encrypted email outbox write,
  and minimal audit write.
- All public signup, verification, and reset-request routes must use Learning
  Hub orchestrators. No raw Better Auth catch-all route is exposed.

## Compatibility proof completed before implementation planning

- Official Drizzle adapter accepted the transaction-scoped database through
  public TypeScript types without casts.
- Disposable Neon branch `br-red-haze-ao8qoy24`, compute
  `ep-withered-bird-aocw4gzj`, database
  `learning_hub_session_002_test` was verified non-default and non-protected.
- D-011/D-013 PostgreSQL suite passed: 1 file, 11 tests, exit 0. It covered
  atomic signup/reset rollback, awaited verification/reset callbacks,
  sequential and concurrent single-active reset tokens, rollback preservation,
  namespace/account isolation, generic unknown-email response, rate limiting,
  and the absence of a raw catch-all route.
- The disposable branch was deleted and its absence was confirmed. The Neon
  default branch `br-solitary-cell-aorxyd0b` was not mutated.

## SESSION-003 scope

- Better Auth email/password signup, sign-in, email verification, forgot/reset
  password, and sign-out.
- Core mapped authentication schema plus only the profile, policy acceptance,
  signup/reset audit, and encrypted authentication-email outbox rows required
  for the approved atomic invariants.
- `AuthEmailSender` port and a Resend adapter that is tested with a fake client;
  no real email delivery.
- Explicit auth API routes, responsive Thai auth pages, and focused automated
  acceptance coverage.

## Deferred scope

- Profile settings, device-session management UI, password change,
  TOTP/recovery codes, policy history, export/deletion/retention, Resend webhook
  delivery state, organizations, instructors, catalog, commerce, social login,
  SSO, passkeys, SMS/phone auth, WP-02, and later work packages.

## Official versioned references

- [Better Auth email/password](https://better-auth.com/docs/authentication/email-password)
- [Better Auth server API](https://better-auth.com/docs/concepts/api)
- [Better Auth rate limiting](https://better-auth.com/docs/concepts/rate-limit)
- [Better Auth Drizzle adapter](https://better-auth.com/docs/adapters/drizzle)
- [Better Auth Next.js integration](https://better-auth.com/docs/integrations/next)
- [Better Auth 1.6.23 password routes](https://github.com/better-auth/better-auth/blob/v1.6.23/packages/better-auth/src/api/routes/password.ts)
- [Resend send email API](https://resend.com/docs/api-reference/emails/send-email)
