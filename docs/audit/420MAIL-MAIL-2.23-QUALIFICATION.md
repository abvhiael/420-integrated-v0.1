# 420Mail MAIL-2.23 Qualification

## Step

**MAIL-2.23 — Telegram Account Linking**

## Completion

- Status: **COMPLETE**
- Qualification level: **Level 1 — app-scoped step qualification**
- Qualified implementation SHA: `bf452ee57ce502f69697250c35c7683974a80389`
- Exact qualified PR merge-candidate SHA: `c2c537c8dc97d0f9745708d1e95e8d03fbe75150`
- Current `main` / base SHA: `721a7f358e802bce91835851721eb93c4340f501`
- Audit branch: `mail-2-11-email-wallet-onboarding-20261006`
- PR: #537

## Canonical requirement satisfied

MAIL-2.23 adds Telegram account linking through the provider-neutral connector framework established by MAIL-2.14.

It does not implement MAIL-2.24 Telegram → 420Mail Sync or MAIL-2.25 420Mail → Telegram Delivery.

## Implementation summary

Implemented/updated repository surfaces:

- `mail/telegram_link.go`
  - `TelegramProvider`
  - `TelegramAccount`
  - `TelegramLinkAuthority`
  - `TelegramConnectorAdapter`
  - `NewTelegramConnectorService`
  - account normalization and validation
  - canonical `telegram:{user-id}` connection IDs
  - unlink delegation
  - link-only capability declaration
  - unsupported pull/push/webhook paths
- `mail/telegram_link_test.go`
  - descriptor/capability containment
  - authorization delegation
  - canonical connection normalization
  - display-name fallback
  - malformed request rejection before authority
  - invalid authority-result rejection
  - dependency failure propagation
  - unlink binding and malformed connection rejection
  - explicit rejection of later capabilities
  - authenticated HTTP link/unlink
  - unauthenticated rejection
  - secret-bearing-field rejection
  - Telegram/Discord provider-registry coexistence
- `config/420mail-service-v1.json`
  - explicit Telegram linking authority, privacy, credential and capability policy
- `docs/420MAIL.md`
  - authority, connection, unlink, credential and scope boundaries
- `scripts/verify-420mail-audit.py`
  - retained MAIL-2.23 config/source/client/UI/capability checks

Existing provider-neutral surfaces are reused unchanged:

- `GET /v1/connectors/providers`
- `POST /v1/connectors/link`
- `POST /v1/connectors/unlink`
- typed `LinkConnector`
- typed `UnlinkConnector`
- generic thin-UI `LINK` rendering

## Exit criteria / invariants individually verified

### Canonical Telegram link authority

420Mail does not verify Telegram credentials itself.

A deployment-provided `TelegramLinkAuthority` receives only:
- authenticated Mail actor;
- opaque authorization reference.

The authority is responsible for validating the external Telegram authorization flow and returning the canonical Telegram account.

### Account result validation

A valid authority result requires:
- positive decimal Telegram user identifier;
- username or first name available for display;
- bounded username/first/last name values;
- `verified=true`;
- `non_custodial=true`;
- non-zero link timestamp.

Malformed authority results fail closed.

### Canonical provider-neutral connection

Successful linking returns:
- provider `telegram`;
- connection ID `telegram:{user-id}`;
- external ID = Telegram user ID;
- identity = authenticated 420Mail actor;
- active=true;
- non-custodial=true;
- linked/updated timestamp = authority link timestamp.

Display name prefers first/last name and falls back to `@username`.

### Unlink authorization and binding

Unlink requires:
- authenticated actor;
- provider `telegram`;
- valid `telegram:{user-id}` connection ID.

The adapter extracts the bound Telegram user ID and delegates unlink cleanup to `TelegramLinkAuthority`.

Malformed or cross-provider connection IDs fail before authority execution.

### Credential boundary

The generic link endpoint uses strict JSON decoding.

MAIL-2.23 does not accept or persist raw:
- Telegram bot token;
- access token;
- refresh token;
- client secret;
- phone-number credential;
- verification code;
- device/provider signing material.

A secret-bearing HTTP field is rejected before Telegram authority execution.

### Capability containment

Telegram advertises only:
- `LINK`

The adapter explicitly returns `ErrConnectorUnsupported` for:
- `PULL`;
- `PUSH`;
- webhook verification.

No Telegram wallet-verification capability is declared.

### Provider-neutral coexistence

Qualification proves Telegram and Discord adapters can coexist in the same deterministic connector registry without provider collision or framework specialization.

## Level 1 qualification

Workflow: **420Mail Audit Qualification**

- Run: **37516935098** (#339)
- Job: **112452174734**
- Qualified implementation SHA: `bf452ee57ce502f69697250c35c7683974a80389`
- Exact tested merge candidate: `c2c537c8dc97d0f9745708d1e95e8d03fbe75150`
- Current-main parent: `721a7f358e802bce91835851721eb93c4340f501`

Exact checkout evidence:
`HEAD is now at c2c537c Merge bf452ee57ce502f69697250c35c7683974a80389 into 721a7f358e802bce91835851721eb93c4340f501`

Results:
- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS
- verifier explicitly reported:
  `MAIL-2.23 Telegram account linking: qualified by app-scoped checks`

No superseded MAIL-2.23 candidate is claimed as evidence.

## Main reconciliation status

At MAIL-2.23 qualification:
- current `main`: `721a7f358e802bce91835851721eb93c4340f501`
- branch compare status: ahead
- branch behind count: 0
- PR mergeable: true

No additional main reconciliation commit was required during MAIL-2.23 because the branch remained current with `main`.

## Milestone status

MAIL-2.23 is an ordinary step inside the documented **External bridge milestone (MAIL-2.15 through MAIL-2.29)**.

- Level 2: **NOT RUN / NOT DUE**
- prior Mailbox Foundation and Wallet-native identity Level 2 evidence remains valid
- External bridge Level 2 remains deferred to the documented milestone boundary or an earlier material shared-dependency reason

## Intentionally deferred Level 3

Level 3 remains reserved for complete app-phase closeout.

No deliberate full repository Solidity inventory, duplicate Genesis full Foundry inventory, 420 Integrated/global qualification, Geth/global fault/soak suite, unrelated app audit, or broad repository closeout was run for this ordinary step.

Automatically triggered unrelated workflows are not claimed as MAIL-2.23 evidence.

## Live/deployment limitations

Repository completion does not claim:
- live Telegram credentials or provider availability;
- a production Telegram authorization implementation;
- live account revocation behavior;
- Telegram inbound synchronization;
- Telegram outbound delivery;
- production Telegram rate-limit/retry behavior;
- public-testnet Telegram qualification.

Those remain later roadmap/live testnet/security/operations gates.

## Evidence inheritance

This evidence file and companion roadmap/PR bookkeeping are documentation/evidence-only and inherit qualification from the exact implementation SHA above without recursive requalification.

## Next canonical step

**MAIL-2.24 — Telegram → 420Mail Sync**
