# 420Mail MAIL-2.17 Qualification

## Step

**MAIL-2.17 — 420Mail → Discord Delivery**

## Completion

- Status: **COMPLETE**
- Qualification level: **Level 1 — app-scoped step qualification**
- Qualified implementation SHA: `c27202362b97afa4e985de74b836b3b16bd96a7e`
- Exact qualified PR merge-candidate SHA: `aad903ed3ec0b6ca7aebf3dc7c8716cc0dbcf821`
- Current `main` / base SHA: `23ebff000a471bfbc4439894f797f3b17a530867`
- Audit branch: `mail-2-11-email-wallet-onboarding-20261006`
- PR: #537

## Canonical requirement satisfied

MAIL-2.17 adds authenticated outbound **420Mail → Discord delivery** on top of the provider-neutral connector framework and the linked Discord identity established by MAIL-2.15.

It does not implement MAIL-2.18 Discord wallet verification.

## Implementation summary

Implemented/updated repository surfaces:

- `mail/discord_delivery.go`
  - `DiscordDeliveryMessage`
  - `DiscordDeliveryReceipt`
  - `DiscordDeliveryAuthority`
  - `DiscordDeliveryRequest`
  - `DiscordDeliveryResult`
  - `DiscordDeliveryService`
  - destination/content/reply/idempotency validation
  - normalized provider handoff
  - provider receipt validation
- `mail/discord_link.go`
  - Discord adapter advertises `PUSH` only when its authority implements `DiscordDeliveryAuthority`
  - link-only/sync-only authorities continue to reject push as unsupported
  - Discord push parses and validates the provider-neutral connector payload and delegates to `DeliverDiscord`
  - provider response must return a Discord message snowflake, exact requested channel, and accepted timestamp
- `mail/discord_delivery_test.go`
  - capability declaration
  - owner/connection/idempotency pass-through
  - optional reply target
  - malformed input rejection before authority
  - invalid provider receipt rejection
  - provider/dependency failure propagation
  - link-only push rejection
  - authenticated HTTP delivery
  - unauthenticated rejection
  - strict secret-bearing-field rejection
- `mail/http.go`
  - authenticated `POST /v1/connectors/discord/deliver`
- `mail/client/client.go`
  - typed `DeliverDiscord`
- `mail/web/index.html`
  - **Send to Discord** action shown only when Discord declares `PUSH`
  - deployment shell supplies normalized connection/channel/content input
  - Mail generates the per-action idempotency key
- `config/420mail-service-v1.json`
  - explicit Discord outbound-delivery policy
- `docs/420MAIL.md`
  - documented delivery authority, request, receipt, idempotency and scope boundaries
- `scripts/verify-420mail-audit.py`
  - retained MAIL-2.17 config/source/API/client/UI checks

## Exit criteria / invariants individually verified

### Existing linked Discord identity remains canonical

Delivery requires:
- authenticated 420Mail identity;
- canonical linked Discord connection ID `discord:{snowflake}`;
- Discord connector with declared `PUSH` capability.

MAIL-2.17 does not add a second Discord account-link model.

### Provider-specific logic remains isolated

The generic connector service continues to own:
- provider registry;
- capability enforcement;
- normalized push request/result shape;
- required idempotency key;
- provider/connection/result validation.

Discord-specific channel/message validation remains confined to the Discord adapter/delivery service.

### Destination and content validation

Outbound delivery requires:
- valid Discord channel snowflake;
- non-empty content;
- content at most 2000 bytes;
- optional reply target must be a valid Discord message snowflake;
- idempotency key required and bounded.

Malformed requests fail before provider authority execution.

### Credential boundary

The dedicated endpoint accepts no raw Discord:
- access token;
- refresh token;
- client secret;
- bot token;
- signing material.

Credential use and persistence remain inside the Discord delivery authority / secure broker boundary.

Strict JSON decoding rejects unexpected secret-bearing request fields.

### Idempotent provider handoff

The caller idempotency key is passed unchanged through:
`DiscordDeliveryService` → generic connector `PUSH` → `DiscordConnectorAdapter` → `DiscordDeliveryAuthority`.

Retries are therefore expected to reuse the same key at the provider authority rather than silently create duplicate Discord messages.

MAIL-2.17 does not introduce a second Mail-side provider queue. The existing MAIL-2.10 queue remains the canonical internal Mail queue; external Discord delivery retry/idempotency remains in the connector/provider authority boundary.

### Provider receipt validation

A successful Discord authority result must contain:
- valid Discord message snowflake;
- exact requested channel ID;
- non-zero accepted timestamp.

The generic connector layer independently requires:
- matching provider;
- matching connection;
- non-empty external ID;
- non-zero accepted timestamp;
- accepted=true.

### Capability containment

Discord `PUSH` is declared only when `DiscordDeliveryAuthority` exists.

A link-only Discord authority continues to reject push with `ErrConnectorUnsupported`.

MAIL-2.17 does not add:
- Discord wallet verification;
- Discord webhook capability;
- raw credential handling;
- public indexing of outbound message content;
- on-chain Discord message bodies.

## Level 1 qualification

Workflow: **420Mail Audit Qualification**

- Run: **37504615387** (#266)
- Job: **112409960867**
- Qualified implementation SHA: `c27202362b97afa4e985de74b836b3b16bd96a7e`
- Exact tested merge candidate: `aad903ed3ec0b6ca7aebf3dc7c8716cc0dbcf821`
- Current-main parent: `23ebff000a471bfbc4439894f797f3b17a530867`

Exact checkout evidence:
`HEAD is now at aad903e Merge c27202362b97afa4e985de74b836b3b16bd96a7e into 23ebff000a471bfbc4439894f797f3b17a530867`

Results:
- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS
- verifier explicitly reported: `MAIL-2.17 420Mail to Discord delivery: qualified by app-scoped checks`

## Superseded attempt / diagnosed failure

### Run 37504487464 / job 112409523458
- Exact head — PASS
- Go format — FAIL
- downstream checks skipped
- diagnosis: formatting-only candidate failure in the new Discord delivery/client/HTTP files
- action: exact formatter diff applied

This run is superseded and is not completion evidence.

## Main reconciliation status

At MAIL-2.17 qualification:
- current `main`: `23ebff000a471bfbc4439894f797f3b17a530867`
- branch compare status: ahead
- branch behind count: 0
- PR mergeable: true

No new main reconciliation commit was required because current `main` remained the already-reconciled MAIL-2.16 base throughout MAIL-2.17 implementation.

## Milestone status

MAIL-2.17 is an ordinary step inside the documented **External bridge milestone (MAIL-2.15 through MAIL-2.29)**.

- Level 2: **NOT RUN / NOT DUE**
- prior Mailbox Foundation and Wallet-native identity Level 2 evidence remains valid
- External bridge Level 2 remains deferred to the documented milestone boundary or an earlier material shared-dependency reason

## Intentionally deferred Level 3

Level 3 remains reserved for complete app-phase closeout.

No full repository Solidity inventory, duplicate Genesis Foundry inventory, 420 Integrated/global qualification, Geth/global fault/soak suite, unrelated app audit, or deliberate repository-wide Docs qualification was run for this ordinary step.

Automatically triggered unrelated workflows are not claimed as MAIL-2.17 evidence.

## Live/deployment limitations

Repository completion does not claim:
- live Discord bot/OAuth/provider credentials;
- live Discord channel permissions;
- production Discord rate-limit/retry behavior;
- production provider credential refresh/revocation;
- live external idempotency implementation;
- public-testnet delivery qualification;
- Discord wallet verification.

Those remain later live/testnet/security/operations gates.

## Evidence inheritance

This evidence file and companion roadmap/PR bookkeeping are evidence/documentation-only and inherit qualification from the exact implementation SHA above without recursive requalification.

## Next canonical step

**MAIL-2.18 — Discord Wallet Verification**
