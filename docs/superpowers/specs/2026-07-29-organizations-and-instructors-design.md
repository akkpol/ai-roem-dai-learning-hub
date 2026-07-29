# Organizations and Instructors Design

**Status:** Approved for WP-02 implementation

**Date:** 2026-07-29

**Owner:** Product Owner

**Technical owner:** WP-02 Senior Engineer / Program Lead

## Goal

WP-02 makes the supply side of Learning Hub visible and usable. An active
account can create an organization, manage its members, prepare and submit an
instructor application, follow its status, and receive a reviewed decision.
An authorized reviewer can process applications without receiving organization
or finance permissions.

Remaining WP-01 Production operations evidence continues independently and is
not represented as WP-02 success.

## Owned domain

The `organizations` module owns `Organization`,
`OrganizationMembership`, `OrganizationInvitation`, `InstructorProfile`,
`InstructorApplication`, `InstructorApplicationEvidence`,
`InstructorReviewDecision`, and provider-neutral payout-readiness metadata.

It stores Identity account UUIDs as external references and consumes versioned
Identity events through the platform event contract. It does not import an
Identity repository.

## SESSION-007 journey

1. An active account opens `/organizations/new`.
2. The user enters a Thai/English display name, immutable unique slug,
   description, contact email, locale, and time zone.
3. Creation produces an active organization, active `owner` membership,
   redacted audit record, and `organization.created.v1` outbox event in one
   transaction.
4. The user lands on `/organizations/[organizationId]` and sees organization
   identity, current owner, and instructor-readiness status.
5. An owner or manager may edit organization identity except the slug.
6. Suspended or closed Identity actors are denied on the next request.

## State and authorization

- Organization status: `active | suspended`.
- Membership role: `owner | manager | member`.
- Membership status: `active | removed`.
- Every active organization has at least one active owner.
- Only an active owner or manager can edit organization identity.
- Membership invitations and role management begin in SESSION-008.
- All authorization is server-side and deny-by-default.

## Data and privacy

- Slugs are lowercase ASCII segments containing letters, numbers, and hyphens,
  3–63 characters, beginning and ending with an alphanumeric character.
- Display names are 2–160 characters; descriptions are optional up to 1,000
  characters.
- Contact email is normalized and never emitted in audit/event payloads.
- Locale accepts `th-TH` or `en-US`; time zone is an IANA identifier.
- Event payloads contain organization/account UUIDs and non-sensitive fields
  only.

## Public contracts

Service operations:

- `createOrganization`
- `listOrganizationsForActor`
- `getOrganizationWorkspace`
- `updateOrganizationIdentity`

HTTP routes:

- `GET/POST /api/organizations`
- `GET/PATCH /api/organizations/[organizationId]`

UI routes:

- `/organizations`
- `/organizations/new`
- `/organizations/[organizationId]`
- `/organizations/[organizationId]/settings`

## UI contract

The approved repository foundation is authoritative: React Aria (`base: aria`),
`aria-nova`, preset `b2fA`, semantic OKLCH tokens, Noto Sans Thai, Tailwind v4,
and Lucide icons. Do not rerun `shadcn init` or change the foundation.

The generated desktop/mobile concepts are composition references only:

- `C:\Users\akkap\.codex\generated_images\019faa97-a487-71c3-ba6e-fa9493daabc5\call_PccsgB3ut62FoKjShpBdc8eW.png`
- `C:\Users\akkap\.codex\generated_images\019faa97-a487-71c3-ba6e-fa9493daabc5\call_HLR7Ic9p915rYmj32pdOHx0n.png`

Use existing official components before adding new ones. Forms use
`FieldGroup`, `Field`, `FieldLabel`, `FieldDescription`, and `FieldError`.
Empty states use `Empty` and `EmptyMedia`. Every surface covers loading, empty,
success, validation, retry, disabled, forbidden, and stale-update states.

Browser acceptance uses 390×844 and 1440×900, keyboard-only navigation, visible
focus, no horizontal overflow, no console errors, and reduced-motion behavior.

## WP-02 session map

1. SESSION-007 — Organization Foundation and Workspace
2. SESSION-008 — Organization Membership
3. SESSION-009 — Instructor Application
4. SESSION-010 — Reviewer Workflow
5. SESSION-011 — Identity Lifecycle and WP-02 Acceptance

## SESSION-007 acceptance

1. Organization create/list/read/edit works end-to-end with automatic ownership.
2. Duplicate slugs return a field error without partial writes.
3. Organization, membership, audit, and outbox writes are atomic.
4. Actor and ownership allow/deny cases pass.
5. Empty migration, restricted runtime grants, and transaction/concurrency tests
   pass on the approved disposable PostgreSQL target.
6. Mobile, desktop, keyboard, focus, loading, empty, error, retry, and stale
   browser states pass.
7. Architecture, lint, typecheck, unit/integration tests, build, dependency
   audit, exact-head CI/Vercel, and independent R3 review pass.

## Out of scope

- Membership invitation and role management (SESSION-008)
- Instructor applications (SESSION-009)
- Reviewer decisions and suspension (SESSION-010)
- Courses, discovery, payments, enrollments, and learning delivery
- Binary uploads, notification center, and Production launch approval
