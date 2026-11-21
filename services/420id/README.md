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

## Free-hosting acceptance transport

Explicit AUTH420_MAIL_TRANSPORT=resend-https enables the fixed HTTPS
transactional-mail endpoint on port 443 without needing SMTP ports or paid
compute. AUTH420_RESEND_API_KEY and AUTH420_MAIL_FROM must be configured in
the deployment secret manager. SMTP remains selectable via smtp, never a
fallback. The acceptance service preserves the approved-mailbox restriction
and adds a durable global 90 email starts/UTC day cap. See LIVE-ACCEPTANCE.md.
No provider account, deployment, DNS verification or external delivery is
claimed by the repository implementation.


## AUTH-3 — account recovery and application sessions

The server-owned SessionManager consumes one fresh AUTH-2 proof (five-minute
maximum age) per issuance or recovery, with durable one-time proof consumption,
and binds opaque random 256-bit bearers to the approved application, exact RP,
account revision and stable application subject. Only SHA-256 digests persist.
Session policy: 24-hour idle window, seven-day absolute lifetime, explicit
rotation on renewal (no grace window or rolling absolute expiry), maximum
100 active sessions per account/application/RP. Each request rechecks current
account activity and revision. Individual logout, listing, targeted revocation and
all-session revocation are scoped to the current application/RP; recovery advances
the account revision and revokes prior sessions across application scopes.
Session validation is not a durable authorization grant; an application must
validate each request and establish its own permissions in subsequent steps.

Recovery is explicitly selected and uses the existing verified email login method
as its independent recovery authority. It cannot provision unknown mailboxes,
replace an existing passkey without a valid new user-verified WebAuthn registration,
or use the old session as recovery proof. Five-minute recovery ceremonies bind to
the initiating browser and application/RP; invalid or cancelled replacement leaves
the old credential intact. Successful replacement atomically removes the old
credential, installs the different key, advances revision, revokes all prior
sessions and consumes outstanding email challenges, preserving account identity and
app subjects. Sign in afresh after recovery. No wallet, asset or identity
controller authority changes. Mailbox compromise remains a material risk of the
already-authorized email authentication model; lost mailbox and passkey together
have no bypass or administrator impersonation mechanism.

The existing `AUTH420_MODE=acceptance` remains AUTH-2 only. Explicit
`AUTH420_MODE=session-acceptance` exposes the restricted BongGoggles-scoped
session and recovery harness; the server selects the app, never the client.
The same approved mailbox allowlist, HTTPS/Origin checks, request limits,
browser ceremony binding, security headers and rate caps apply. Secure HttpOnly
SameSite Strict host-only session cookie; no bearer in JSON, JS storage or logs.
Sign out before switching accounts or starting passkey recovery in that browser.
The standalone acceptance page is not public social-application integration,
cross-app SSO, a wallet session or unrestricted release.

Before deploying the optional mode apply migration 004 using the privileged
operator path, then separately extend the runtime role with only:
```sql
GRANT SELECT,INSERT ON account420.app_subjects TO account420_runtime;
GRANT INSERT,DELETE ON account420.session_proof_uses TO account420_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON account420.sessions TO account420_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON account420.recovery_challenges TO account420_runtime;
GRANT DELETE ON account420.passkeys TO account420_runtime;
```
Proof cleanup also requires SELECT(expires_at) on session_proof_uses; use
`GRANT SELECT(expires_at) ON account420.session_proof_uses TO account420_runtime;`.
Keep existing AUTH-2 runtime grants, do not grant DDL, and do not replace the
qualified live AUTH-2 environment with this mode until deployment is authorized.
No secret should be placed in source control. Existing testnet device and
administrative deferrals are unchanged. The AUTH-3 repository-level qualification
uses the existing exact-head PostgreSQL/race workflow with session and recovery
integration tests; live mode acceptance is separate.


## AUTH-4 — universal profiles and usernames (repository implementation)

420ID is the server-side authority for a single optional, account-owned
universal profile across approved app sessions. Profile fields: optional
globally unique case-insensitive ASCII username, display name (80 Unicode
characters), bio (500 characters), opaque content-addressed avatar reference
(`sha256:` + 64 lowercase hex digits), visibility, and optimistic revision.
The independent opaque profile ID is **not** an internal account ID, wallet
address, 420Names registration, or authentication credential. Private is the
default: no automatic public directory. Public lookup returns only the
deliberately published profile projection for **current** usernames of active
accounts; it never returns email or internal IDs. Reading one's own profile
does not create a database record.

Usernames are canonicalized to lowercase ASCII `[a-z][a-z0-9_]{2,23}`,
case-insensitively unique in PostgreSQL, with reserved administrative names
blocked. A rename is allowed at most every 30 days. Previously claimed
usernames stay permanently reserved to the original owner to prevent
impersonation and alias takeover; they are not public redirects. Username
changes, profile edits and visibility switches require an active AUTH-3
application/RP-scoped session and an exact profile revision. Account locks
serialize those changes across applications, competing sessions and
suspension/recovery. Public lookup excludes suspended and closed accounts.
A browser cannot select another app, an internal account ID, or a profile
owner. Display names and bios reject controls/invisible formatting;
avatar references are **not** remote URLs, upload operations or a media-host
endorsement. Later Storage/420Media integration may resolve these references.

The previously qualified modes `AUTH420_MODE=acceptance` (AUTH-2) and
`AUTH420_MODE=session-acceptance` (AUTH-3) are byte-for-byte compatible at
the browser entry points and do not depend on migration 005. The **explicit**
`AUTH420_MODE=profile-acceptance` enables an additional restricted profile
editor and same-origin POST endpoints `/v1/profile/me`,
`/v1/profile/update`, `/v1/profile/lookup`. It keeps the approved-email
allowlist, session cookie, exact Origin/RP, browser flow binding, request-size,
rate-limit, no-store and security-header enforcement. The lookup endpoint
requires a valid allowlisted app session even for public profiles; no
unrestricted directory, profile search, social graph, cross-app SSO, reward,
wallet or on-chain authority is enabled.

Install migration `005_universal_profiles.sql` using the separate operator
credential before switching an acceptance environment to this mode. Extend
the `account420_runtime` role **only** with these table privileges (in
addition to the previously qualified AUTH-2/3 grants):

```sql
GRANT SELECT, INSERT, UPDATE ON account420.profiles TO account420_runtime;
GRANT SELECT, INSERT ON account420.profile_username_claims TO account420_runtime;
```

Profile-mode startup checks for both tables and required grants and fails
closed without them. AUTH-3 and AUTH-2 startup do not require these tables.
No schema DDL, mailbox secrets or migration credentials belong in the
running server. The new mode is **not live deployed** by the repository
commit; do not turn on public registrations or claim device/production
acceptance. AUTH-5 optional Wallet linking and AUTH-6 420Identity/420Names
remain separate and are not implied by usernames.

Qualification: `go test -race -tags account420_integration -count=1 ./services/420id`
with PostgreSQL 16 verifies username claim collisions, optimistic races,
private/public transitions, cross-app session isolation, stale tokens,
suspension, validation and HTTP controls. Run focused browser syntax checks
for `profile-session.mjs` and `profile-ui.mjs`, and retain existing
authentication regressions on the exact branch head.

## AUTH-5 — optional 420Wallet linking (repository implementation)

420ID accounts are **wallet-independent**. Link creation is always optional:
verified-email or passkey enrollment, sign-in, profile usage and session
recovery do not require a wallet. A wallet link is **not** an authentication
method for 420ID, proof of 420Names ownership, 420Identity credential,
wallet controller, spending delegation, application capability, token balance
or on-chain right. The association is private to the authenticated owner;
it is NOT included in any universal public profile or social lookup.

A signed wallet association requires BOTH:
1. A live app/RP-scoped AUTH-3 session issued through independent email or
   WebAuthn verification, checked again at each wallet API request; and
2. Explicit user consent plus a fresh wallet proof over an exact server-written
   EIP-191 `personal_sign` message. The message binds the HTTPS origin,
   relying-party hostname, approved app, opaque app subject, session UUID,
   configured EIP-155 chain ID, selected wallet address/type, random 256-bit
   nonce and 5-minute DB-time expiry. It disclaims login, spending, on-chain
   authorization and wallet permissions. Client-originated account IDs, chain
   selection, message bodies, expiry and subject identities are rejected.

EOA signatures are verified locally with legacy Ethereum Keccak-256 and
secp256k1 public-key recovery, canonical low-s scalars and 27/28 or 0/1
recovery parity. The EOA validator is tested using the repository's separate
`compute/worker` real secp256k1 signer, not a Boolean mock. CONTRACT wallet
links are supported via configured EIP-1271 verification: a real HTTPS RPC
must return the pinned `eth_chainId`, deployed `eth_getCode` at the
`finalized` block, and an `eth_call` of
`isValidSignature(bytes32,bytes)` with the EIP-191 digest at `finalized`
that returns the 32-byte ABI-encoded magic `0x1626ba7e`. Unconfigured,
wrong-chain, missing-code, unavailable-finality, stale/redirected, invalid TLS,
malformed, reverted or failed RPC checks FAIL CLOSED, never falling back to an
EOA or simulated response. This intentionally excludes undeployed
counterfactual/EIP-6492 accounts until a separate chain-qualified integration.

The server first verifies the signature and then revalidates the **same**
challenge under the database account lock before consuming it and inserting
the link atomically. PostgreSQL partial unique indexes enforce at most one
active wallet per 420ID account and one owner per chain+address. Losing a
race cannot steal a wallet. Revoked sessions, mismatched app/RP,
different browser-flow cookie, incorrect session or account revision,
changed/expired/superseded nonce, forged signature, wrong chain or wrong
wallet cannot commit. Link history is retained with an `unlinked_at`
tombstone; unlink requires only the current authenticated 420ID session
and never destroys an account, login, profile or the wallet itself. A new
signature is mandatory for a later relink. No private keys, seed phrases,
signatures, on-chain calls or bearer cookies are persisted in browser storage.

The original `AUTH420_MODE=acceptance`, `session-acceptance` and
`profile-acceptance` entry pages and security boundaries remain
unchanged. The NEW opt-in `AUTH420_MODE=wallet-acceptance` requires
`AUTH420_WALLET_CHAIN_ID` (a positive explicitly configured decimal
EIP-155 chain ID; no guessed network), and optionally
`AUTH420_WALLET_RPC_URL` for deployed smart accounts. The latter MUST be
HTTPS with trusted certificate, no URL credentials or query/fragment, and
MUST be a chain-pinned trusted canonical execution provider supporting
finalized block tags. Without it, contract-wallet linking is unavailable;
EOA linking still works. The mode keeps the existing approved test mailbox
allowlist, same-origin HTTPS/CSP/no-store protections, request limits and
daily abuse caps; it does NOT launch public wallet registrations or SSO.

Migration `006_optional_wallet_links.sql` requires the operator database
credential and MUST NOT be applied using the unprivileged runtime service.
Before activating wallet-acceptance, extend the previously qualified
AUTH-2/3/4 runtime grants with ONLY these grants:

```sql
GRANT SELECT, INSERT, UPDATE ON account420.wallet_links TO account420_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON account420.wallet_link_challenges TO account420_runtime;
```

Runtime startup checks the actual table/grant readiness and fails closed
without them. Mode changes and real deployed EOA/EIP-1271 ceremony acceptance
remain separate from repository qualification and are NOT claimed live.
The 420Wallet provider is requested through the standard user-initiated
EIP-1193 `eth_requestAccounts`, then `eth_chainId` and `personal_sign`
operations, not a silent wallet connection. SmartAccount/EIP-1271 requires
live chain RPC and physical-wallet acceptance when testnet is available;
that external work remains in the existing live-testnet acceptance queue.

Relevant tests: `TestEOAWalletSignatureCryptography`,
`TestEIP1271FinalizedChainVerifier`,
`TestOptionalWalletLifecycleAndIsolation`,
`TestOptionalWalletActiveOwnershipRace`, and
`TestWalletHTTPRequiresConsentAndAUTH3`, with retained AUTH-1–4
PostgreSQL/race and HTTP qualification. No additional roadmap phase or
wallet-based recovery mechanism is introduced here.



## AUTH-6 — optional 420Identity and 420Names presentation integration

This integration is **read-only**, wallet-optional and explicitly separate from
AUTH-1–5. A 420ID account remains an off-chain account. It is not an
Identity420 profile, 420Names owner, legal identity, 420Names registration,
governance-authorized credential, wallet permission, recovery authority,
financial entitlement or SSO credential. No on-chain state is written and
no wallet is required to enroll, sign in, recover or use 420ID.

Owners with a previously consented, cryptographically signed AUTH-5 wallet link
may voluntarily select an on-chain **Identity420 profile ID** (32-byte hash)
and optionally a **Names420 label hash** (not human-readable name text). The
isolated AUTH-6 verifier requires a **pinned exact chain ID**, HTTPS RPC,
operator-reviewed nonzero Identity420 and Names420 deployment addresses, both
pinned runtime Keccak-256 code hashes, and contract protocolVersion() == 3.
All reads use the same **canonical finalized block hash**, passed via EIP-1898
`{blockHash,requireCanonical:true}`, with finality observation at most 30
minutes old; RPC failures, missing finalized support, hash/code/protocol drift
and unexpected ABI fail closed. User-provided profile/name identifiers cannot
override the configured chain, contract, block or wallet.

Identity420's canonical `profiles(bytes32)` is authoritative for the
profile's current controller and active state. That controller must match the
currently signed/linked wallet. A .420 presentation is verified **only** when
all of these match at the same finalized state:

1. Identity420 profile is active and its primaryName equals the chosen label
   hash;
2. Names420 `resolve(labelHash)` returns an unexpired name whose profileId is
   the chosen Identity420 profile and whose resolvedAddress is the linked
   wallet; name owner is nonzero;
3. Names420 `reverseResolve(linkedWallet)` returns the same label hash; and
4. Names420 `nameClaimsProfile(labelHash,profileId)` returns true.

Names ownership need not equal the Identity controller; the authoritative
Names contract controls name ownership, transfer and expiration. Name transfer
and expiry invalidate derived presentation immediately. A profile-only
verification never implies any .420 name. No credential, issuer trust class or
assurance status is synthesized from profile visibility or name agreement.
Identity420 `hasValidCredential` remains a separate read-only contract query,
never an application authorization grant.

`account420.identity_names_preferences` stores only a voluntarily selected
presentation preference for the private account, bound to the then-active
wallet and chain. It is NOT authority and is **reverified on every retrieval**.
If the wallet unlinks, account/session is revoked, controller moves,
profile deactivates, name expires/transfers, any bilateral link breaks, or
chain evidence becomes unavailable/stale, the old preference is not displayed
as verified. Saving uses an explicit consent flag, the current AUTH-3
session, the active AUTH-5 wallet link, account lock, and optimistic revision.
Clearing a preference needs only an authenticated account session; it does not
alter blockchain records or unlink a wallet. No internal account IDs, email,
bearer tokens or secrets appear in the projection.

The existing `acceptance`, `session-acceptance`, `profile-acceptance`
and `wallet-acceptance` modes remain unchanged. **Only**
`AUTH420_MODE=identity-acceptance` enables the new restricted
`/v1/identity/preview`, `/v1/identity/save`,
`/v1/identity/current`, `/v1/identity/clear` POST endpoints and
optional browser UI. They inherit the host/RP/Origin, approved-mailbox,
flow-cookie, 420ID session, rate-limit, no-store and request-size controls.
The UI shows exact hash identifiers, not invented human-readable names.
No application social profile is publicly published by this integration.

Before optionally activating AUTH-6 in restricted acceptance, an operator
must apply `007_identity_names_preferences.sql` through the separate
migration credential, then grant **only** the new table privileges:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE
 ON account420.identity_names_preferences TO account420_runtime;
```

At startup, AUTH-6 requires migration 007 and grants, in addition to
retained AUTH-2–5 schema and runtime grants. Existing modes do not query
migration 007. Required explicit configuration (no defaults or guessed
addresses): `AUTH420_WALLET_CHAIN_ID`,
`AUTH420_IDENTITY_NAMES_RPC_URL` (HTTPS, canonical finalized state),
`AUTH420_IDENTITY_ADDRESS`, `AUTH420_IDENTITY_CODE_HASH`,
`AUTH420_NAMES_ADDRESS`, and `AUTH420_NAMES_CODE_HASH`.
Hashes are Keccak-256 over the exact runtime contract code, not Solidity
source, ABI or predeploy artifacts. Use qualified frozen deployment
records and validate against actual finalized chain state; do not silently
replace frozen contract choices. Wallet EIP-1271 linkage remains subject
to its independently configured pinned chain verifier.

Repository tests use an actual TLS JSON-RPC fixture to exercise every
contract ABI and fail-closed binding, and PostgreSQL 16/race/HTTP tests
for consent, optionality, session isolation, concurrent revisions and
live revalidation. They do **not** certify an independently deployed
testnet node, real contract finality, code hash, on-chain transaction,
physical wallet or public service deployment. All applicable pending
live-testnet and deployment-security checks remain deferred without
being marked PASS. AUTH-7 cross-application SSO is separate and not
implemented by AUTH-6.


## AUTH-7 — approved cross-application single sign-on

**Implementation:** an opt-in, server-only confidential OAuth-style
authorization-code + PKCE S256 flow, not a shared cookie or wallet login.
Existing AUTH-2–6 modes and their web entry pages remain unchanged.
A verified central 420ID email/passkey session is required at
`https://auth.420integrated.org` (approved test email allowlist in acceptance),
followed by **explicit first-party user consent for a named destination**.
Authorization never occurs silently on a GET or as a side effect of a
Wallet/Names/Identity link, universal profile, or social app visit.

### Strict authorization flow and trust boundaries

1. Each participating application's confidential backend registers its
   immutable app ID, human-readable display name, **one exact HTTPS callback
   URL** under `*.420integrated.org`, and an independent cryptographically
   random **32-byte base64url client secret** at the central 420ID deployment.
   Wildcards, HTTP callbacks, callback parameters/fragments, localhost, URL
   userinfo, IP literals, ambiguous paths and duplicate client IDs/secrets
   are rejected. Applications must be explicitly approved in the 420ID
   Store, not chosen from a browser-supplied account identifier.
2. The approved application's **backend** generates an independent 256-bit
   CSRF `state`, PKCE `codeVerifier` and S256 code challenge. Persist
   the verifier/state in its authenticated server-side flow store with a
   short lifetime and single-use redemption; never use localStorage, URLs or
   client-side secrets. Redirect the browser by a **top-level navigation**:
   `GET /sso/authorize?app=<app>&redirect_uri=<exact>&state=<43-char>&code_challenge=<43-char>&code_challenge_method=S256`.
   The central authority serves a static authorization page only for an exact
   registered client/callback and a strictly valid S256 request. No
   user-supplied query is reflected in HTML.
3. Sign in at 420ID with verified email or a passkey if no central session
   exists. The page displays the **server-registered** application name and
   asks the user to approve or cancel. The explicit same-origin
   `POST /v1/sso/authorize` checks the approved mailbox, central session,
   Origin, host, browser flow cookie, current account revision and consent.
   It creates a one-time random 256-bit authorization code, stores **only its
   SHA-256 digest**, with the source session, exact target app/callback,
   PKCE digest, browser binding and **90-second PostgreSQL expiry**.
   Reissuing for the same source/app replaces the previous code. No session
   bearer, account ID, passkey, wallet or cross-app subject enters the
   redirect query.
4. The browser is redirected only to the registered HTTPS app callback
   with `?code=...&state=...`. The app backend verifies its stored
   single-use `state`, then POSTs **from its backend** to
   `/v1/sso/token` with confidential HTTP Basic client authentication,
   the code, PKCE verifier and exact callback. Browsers, cookies, Origin
   requests, credentialed CORS, unknown apps and mismatched callbacks are
   denied. Under the account lock, 420ID atomically consumes the code and
   validates the **still-active** original central email/passkey session
   and account revision before minting a **distinct application-only
   256-bit opaque bearer** (digest-only at rest) and **opaque app-specific
   subject**. Target session idle expiry is at most 24 hours and absolute
   expiry at most seven days, **both capped by the source session**.
5. A participating application stores the received opaque bearer in its
   **backend** session store and sets a separate Secure, HttpOnly, SameSite
   app-host cookie. Each authenticated application request must call
   confidential `POST /v1/sso/introspect` with that app's client secret.
   Responses contain only `active`, its own `{app,sub}` subject, method and
   expiry, not internal account ID or linked wallet/identity. Tokens are
   not portable between app IDs. The original verified central session and
   current app session are jointly checked; revoking, suspending, expiring
   or recovering an account invalidates dependent SSO sessions.
6. Apps may call `POST /v1/sso/revoke` for their **own token only**.
   The 420ID browser offers explicit `POST /v1/sso/logout-all` to invalidate
   the account's central and app sessions and outstanding codes. Ordinary
   app logout does not revoke other applications. Ordinary central logout
   invalidates dependent SSO tokens through the parent-session check.
   Server-generated SSO codes/tokens are never permissions, spending approval,
   wallet controller evidence, identity credential, on-chain identity,
   paid entitlement or cross-app data-reading capability.

### Deployment controls

A separate `AUTH420_MODE=sso-acceptance` enables only the central
authorization surface and backend endpoints. Existing
`acceptance`, `session-acceptance`, `profile-acceptance`,
`wallet-acceptance`, and `identity-acceptance` modes remain unchanged.
The central source account is scoped to the existing
`bong-goggles` acceptance app, while authorized targets receive independent
SSO app subjects; any other target must be explicitly registered.

Set `AUTH420_SSO_CLIENTS` to a protected **server environment** JSON
array, using the schema:
```json
[
  {
    "app": "doobtube",
    "name": "DoobTube",
    "redirectUri": "https://doobtube.420integrated.org/auth/420id/callback",
    "secret": "<generate-a-distinct-32-byte-base64url-random-secret>"
  }
]
```
This is a format example **not** proof that such a live callback is installed,
or a request to register/deploy it. The operator must verify the real
recipient backend implements the callback before enabling the client.
Never commit real client secrets, publish them to JavaScript, or let a browser
call confidential token/introspection/revocation APIs. The shared
`sso-client.mjs` adapter has server-side exchange/introspection/revoke
helpers and a PKCE initiation helper; `sso-client.test.mjs` qualifies
callback CSRF/redirect and app-token scope. The consuming app must implement
its own server-side one-use flow storage and host-only app-session cookie;
**no existing BongGoggles, 420Town, DoobTube or other public frontend is
claimed integrated or deployed by this repository-only AUTH-7 task**.

Apply `008_sso.sql` through the existing **operator-only** migration
credential, not the running server. On top of the retained AUTH-2–6 grants:
```sql
GRANT SELECT, INSERT, UPDATE, DELETE
 ON account420.sso_codes TO account420_runtime;
GRANT SELECT, INSERT
 (sso_source_id) ON account420.sessions TO account420_runtime;
```
The second grant is redundant where the AUTH-3 runtime role already has
whole-table SELECT/INSERT, and may be omitted in that case. SSO-mode
startup checks the actual schema and privileges and fails closed until ready.
No application gets direct database access. Client secrets are never stored in
the account database; the configured manifest is protected by Render secret
custody. The existing allowlisted live AUTH-2 service remains unchanged until
an explicitly authorized deployment. Additional app backend callback
configuration, restricted live acceptance, provider and credential custody
and physical-device testing remain separate deployment/acceptance work.

### Qualification and adversarial coverage

`go test -race -tags account420_integration -count=1 -v ./services/420id`
with isolated PostgreSQL 16 covers code exchange, atomic replay races across
database connections, authorization consent, strict app and callback
registration, 90-second expiry, PKCE substitution, cross-app token
introspection, source session logout, recovery/revision suppression, app-only
logout and explicit global logout; also retains AUTH-1–6 tests. The dedicated
workflow adds `node --check` for the SSO UI and
`node --test services/420id/sso-client.test.mjs` for app integration
helpers, plus the existing browser/WebAuthn fuzz, build and static checks.
Simulated HTTP acceptance and local PostgreSQL tests do not establish
deployed cross-domain browser, TLS, client-backend or live provider acceptance.

**Next canonical step after AUTH-7: AUTH-8 wallet-independent BongGoggles
social activity.** AUTH-8 is not implemented by SSO.


## AUTH-11 — Monetization and reward activation (restricted foundation)

**Scope and existing canonical authority:** The already-merged BongGoggles
BG-18 reward framework, `ContributionRegistry420`,
`BongGogglesContributionVerifier420`, `BongGogglesRewardsAdapter420`,
`RewardCampaignRegistry420`, `RewardDistributor420` and `RewardPool420`
remain authoritative for reward qualification, campaign funding, accrual,
claim and release. AUTH-10 XP is private and non-economic and is **never**
an accepted source of reward claims, paid status, subscription balances
or token amounts. AUTH-11 does not deploy or fund those contracts and does
not automatically convert off-chain 420ID posts into on-chain contributions.

**Repository implementation:** `009_monetization_consents.sql` adds a
private account-owned, BongGoggles-only consent record with explicit
reward/creator programme opt-ins and an optimistic revision for
cross-instance replay protection. A 420ID-verified user can opt in **with
no wallet linked**, later link an optional wallet with the separate
AUTH-5 EIP-191/EIP-1271 flow, withdraw consent, or remain entirely
unenrolled. Opt-in alone is not eligibility, a claim, spend authority,
a payment authorization, a funded campaign or a grant of paid features.
Revocation updates the confidential introspection status on the next read;
a previously issued SSO session never carries a durable financial grant.

**Two read surfaces / privilege boundaries:**

- New isolated `AUTH420_MODE=monetization-acceptance` composes the
  previously qualified central `420id` SSO source with restricted universal
  profiles, optional wallet signing and an independent account-only
  `POST /v1/monetization/status` and
  `POST /v1/monetization/consent`. It requires the approved
  `bong-goggles` confidential SSO client manifest, pinned
  `AUTH420_WALLET_CHAIN_ID`, and all retained email/session
  allowlist, CSRF, HTTPS, rate limits and backend secret boundaries.
  Existing `AUTH420_MODE` values remain unchanged.
- Authenticated confidential `/v1/sso/introspect` includes a
  wallet-address-free, nonfinancial readiness projection **only** for
  BongGoggles. Other clients never receive this field; an invalid or
  inactive source session never receives it. No browser supplies app IDs,
  wallet links or reward status to this backend.
- Opt-in `rewardStage`: `not_enrolled`, `wallet_required`, or
  `canonical_verification_required`. Creator stage:
  `not_enrolled` or `operator_programme_required`.
  `canClaim`, `paid`, `paymentAuthorized`, and
  `financialAuthority` are always false. These stages are review
  readiness and **not** eligibility or accrued balances.

**Migration and privilege boundary (operator credential only):**

```sql
GRANT SELECT, INSERT ON account420.monetization_consents TO account420_runtime;
GRANT UPDATE(reward_opt_in,creator_opt_in,revision,updated_at)
 ON account420.monetization_consents TO account420_runtime;
```

The runtime role must not receive DELETE or unrestricted UPDATE privileges,
and must have the previously qualified AUTH-5/7 wallet and SSO privileges.
Only the operator may migrate. The runtime is disabled until these
requirements pass its separate readiness gate.

**Economic boundary / next integration:** A canonical reward can only be
accrued through the on-chain verifier and correctly funded campaign,
and paid after wallet-confirmed canonical claim and actual release.
No local 420ID consent or XP is a substitute for that protocol. Paid creator
features, pricing, payment checkout, merchant receivables or sponsor
activation require separately verified product/economic configuration and
an authoritative 420Pay or contract settlement record. This step
introduces no unapproved paid tiers or token distributions.

**Live status:** This repository-only implementation is not evidence that
Neon 009 grants, Render 420ID combined mode, Render social service,
Cloudflare same-host `/social-api` ingress, or canonical funded reward
campaigns are deployed. Keep new features disabled until actual browser,
operator, SSO, privacy and rollback acceptance is qualified.

**Qualification:** The account and social workflows run real PostgreSQL 16,
Go race and HTTP/consent/revocation tests, with new browser and
BongGoggles routing regressions. Record exact successful head and run IDs
on the AUTH-11 PR, not as unverified claims in this document.


## AUTH-12 — security, privacy and adversarial hardening

The secure acceptance paths now reject non-ASCII JSON field names,
case-folded duplicate keys and decoded key aliases. No registration,
authorization, SSO exchange or monetization opt-in can exploit Go's
case-insensitive struct field matching to override a checked value.
SSO and wallet schema preflights check each PostgreSQL privilege
independently; the previous multiple-privilege string incorrectly
treated one existing grant as sufficient.

The explicit `monetization-acceptance` serving path now rejects a database
role that can DELETE/TRUNCATE any consent, UPDATE the entire consent
table, or modify `account_id`/`app_id`. Use `SELECT,INSERT` and
column-scoped `UPDATE(reward_opt_in,creator_opt_in,revision,updated_at)`
only. Operator migrations remain privileged and separate.

Confidential SSO introspection locks the current account, source session
and child session while calculating the app-scoped readiness state. This
prevents a revoked source session and a new opt-in/unlink state being read
from two inconsistent snapshots. Browser opt-in controls clear on sign-out,
tab visibility loss and rejected data, and ignore a late response issued by
the prior session.

See `docs/audit/AUTH-12-SECURITY-PRIVACY-QUALIFICATION.md` for the
threat model, retained tests and non-production release boundary.
