# 420ID — AUTH-1 shared account architecture

420ID is an off-chain, wallet-optional application account authority. This foundation does not create a public login service, replace Identity420, or change Genesis. An account is not a wallet address, a legal identity, a credential, a reward entitlement, a smart-account permission, or a Registry service identity.

## Authority and data boundary

- PostgreSQL schema `account420` owns opaque internal UUIDv4 accounts, lifecycle state and revision. Its app-subject relation owns random, stable, app-scoped identifiers. No wallet, email, profile name, role, credential, or token balance is stored in AUTH-1.
- A single shared account can enroll separately into approved applications without exposing a global browser identifier. The consuming application stores its own social graph and content against its own subject. Cross-application resolution is server-only and never establishes consent or capability.
- The server controls the application allowlist. Do not accept an application name or internal identifier from a browser as authentication. Enrollment, status changes and lookups are trusted-server primitives only. No HTTP ingress, credentials, session issuance, cookies or token signing are introduced at this stage.
- PostgreSQL enforces foreign keys, per-account/application uniqueness, global subject uniqueness and valid lifecycle values. Account row locking serializes enrollment with lifecycle changes; repeat enrollment returns the original subject. Closed accounts are terminal; suspension suppresses resolution, and revision checks reject stale state changes.
- 420Identity remains the contract authority for controller, issuer and credential state. 420Names remains the authority for .420 ownership; Wallet/CapabilityRegistry retain all on-chain approvals. Existing wallet-address applications must not silently reinterpret a 420ID subject as an address or replace existing authorization checks.
- Public visitor access remains under each application's existing public-read policy. A later authenticated member may perform only app-authorized off-chain actions; a linked wallet must be proven independently for monetary or canonical actions. No retroactive token liability or financial grants are created by enrollment.
- Migrate with a privileged operator connection; runtime service owns only its approved data schema. Applications must not receive database credentials or direct table access. Run behind a trusted service boundary until authentication and session qualification are implemented. Do not expose account IDs in public logs or user responses; only app-specific subject is suitable as an application identifier, and it is not a bearer secret.
- No existing application or account is migrated in AUTH-1. Integration requires explicit adapters, authentication and consent in their assigned steps.

## Implementation and qualification

`account.go` provides the server-owned store and migration. Run the isolated database qualification against a **disposable** PostgreSQL database with `ACCOUNT420_TEST_DSN` (the integration suite requires the database name `account420_test` and never drops schemas). `go test -race -tags account420_integration -count=1 ./services/420id` includes durable, multi-connection, state-transition and cross-app isolation tests. The dedicated pull-request workflow checks the exact commit. No live network or chain is required for this foundation.

## Assigned workstream

The user-assigned AUTH-1 is the architecture foundation; its qualification is recorded against the implementation commit by the dedicated check. The next assigned step is AUTH-2, email and passkey authentication. AUTH-3 account recovery and session management; AUTH-4 universal profiles and usernames; AUTH-5 optional 420Wallet linking; AUTH-6 420Identity and 420Names integration; AUTH-7 cross-application single sign-on; AUTH-8 wallet-independent BongGoggles social activity; AUTH-9 wallet-independent messaging and games; AUTH-10 community contribution and XP tracking; AUTH-11 monetization and reward activation; AUTH-12 security, privacy and adversarial qualification; AUTH-13 ecosystem integration remain separate. No later step is claimed implemented by AUTH-1.

## AUTH-2 — Email and passkey authentication

The server-side Auth service adds passwordless verified-email enrollment and
sign-in to the shared account store; no wallet address, on-chain Identity or
financial permission is created. Email verification is an independent login
method. Mailboxes are ASCII dot-atom local parts with case preserved and
lowercase DNS domains; no provider-specific alias collapsing. Existing
unmapped AUTH-1 accounts are not silently linked.

- BeginEmail sends a 256-bit single-use code via a configured transactional
  Mailer (implicit-TLS authenticated SMTP adapter included); only a challenge ID
  is returned to the caller. PostgreSQL stores the digest, a ten-minute
  expiry, five valid-format failed attempts and a durable 60-second per-mailbox
  cooldown. Resend supersedes older codes; wrong codes do not create accounts.
- FinishEmail atomically consumes the code, creates or resolves the same
  verified account, and rejects suspended/closed state. Only an authenticated
  email completion can issue a five-minute initial registration ceremony.
- WebAuthn is intentionally limited to discoverable, user-verified ES256
  credentials, none attestation and no extensions. One initial credential per
  account/RP; no add/remove/recovery endpoints. Origin and RP are configured
  server-side and must be an exact HTTPS host. Registration checks the
  attestation object, RP hash, flags, COSE key and credential ID; login checks
  the signed authenticator data and client JSON, challenge, origin, RP,
  credential ID, user handle, backup eligibility and counter. Zero counters
  are supported, nonzero counters must advance. Challenges are atomically
  consumed across processes. This does not establish device provenance.
- browser.mjs converts standard WebAuthn creation/assertion options and binary
  responses; it does not ship an independent login page or session manager.
- Authentication is a server-only ephemeral result containing account identity,
  revision and proof method. Never serialize it, never accept it from a client,
  and recheck lifecycle on issuing future sessions. No JWT, cookie, recovery
  or application/financial authorization is issued in AUTH-2.

Deployment requires an approved HTTPS RP origin, configured real SMTP relay
and secrets, a private trusted server integration, request/response limits,
source/global abuse controls, same-origin request validation, no-store
responses and no code/PII logging. The per-mailbox cooldown is not a complete
public ingress abuse control. No public endpoint is enabled by this step.
Schedule expired challenge cleanup via PurgeExpired; no credential or account
rows are removed. AUTH-3 owns session and recovery, AUTH-7 owns cross-app SSO
and AUTH-8+ own social app integration. The library is not a public launch
approval.

Qualification: existing account workflow checks the exact head with
PostgreSQL 16, race-enabled unit and integration tests, static analysis,
bounded CBOR fuzzing and browser adapter tests. Real provider deliverability
and physical authenticator testing require deployment configuration and are
not claimed by synthetic test fixtures. WebAuthn verification profile follows
https://www.w3.org/TR/webauthn-3/ with intentionally unsupported features rejected.

## AUTH-2 live acceptance supplement

The restricted public HTTP boundary and deployable 420ID binary are now
provided by acceptance.go, acceptance.html, acceptance.mjs and cmd/420id.
It is intentionally acceptance-only until AUTH-3 and subsequent integration:
proof of email or passkey authentication is not an app session. The public
listener requires an explicit acceptance mode and a server-owned test mailbox
allowlist. See [LIVE-ACCEPTANCE.md](LIVE-ACCEPTANCE.md) for configuration,
verified TLS, relay, database permissions, DNS, browser/device qualification
and evidence handling. Never expose the internal Store/Auth primitives to
untrusted callers or deploy the acceptance service with real-user data.
