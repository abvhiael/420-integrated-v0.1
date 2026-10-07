# 420Mail MAIL-2.27 Qualification

## Step

**MAIL-2.27 — Cross-Platform Verified Identity**

## Completion

- Status: **COMPLETE**
- Qualification level: **Level 1 — app-scoped step qualification**
- Qualified implementation SHA: `4c1c02f05a2a716b6525582de93c92d6d178e9e9`
- Qualified feature SHA before reconciliation: `d761b92767ee5d6b7b8de407b4bfd0e3dad87c61`
- Current `main` / reconciliation base SHA: `e75beb8779a7749ad58a9f9e1156e731b70d36db`
- Audit branch: `mail-2-11-email-wallet-onboarding-20261006`
- PR: #537

## Canonical requirement satisfied

MAIL-2.27 adds an authenticated cross-platform verified identity view across currently qualified external integration evidence.

Repository evidence contains no more detailed subordinate specification beyond the canonical roadmap name, so the implementation preserves existing authority boundaries and explicitly distinguishes proof strength instead of treating every linked provider as equivalently verified.

## Identity model

The authenticated 420Mail identity is the root identity.

Durable provider evidence is projected into `CrossPlatformVerifiedIdentity` records.

Current assurance classes:

- `PROVIDER_AUTHORITY_VERIFIED`
- `WALLET_VERIFIED`

Current evidence sources:

- Discord successful sync binding → provider-authority verified;
- Discord successful canonical wallet verification → wallet verified;
- Telegram successful sync binding → provider-authority verified.

For the same Discord connection, wallet verification supersedes provider-authority evidence.

Telegram is not falsely promoted to wallet-verified because no qualified Telegram wallet-verification primitive exists.

Signal is not included because MAIL-2.22 qualified its deep-sync condition as unsatisfied.

## Implementation summary

Implemented/updated repository surfaces:

- `mail/cross_platform_identity.go`
  - `VerifiedIdentityAssurance`
  - `VerifiedPlatformIdentity`
  - `CrossPlatformVerifiedIdentity`
  - `Service.CrossPlatformIdentity`
  - owner-isolated durable evidence projection
  - wallet-verification precedence
  - deterministic provider/connection ordering
- `mail/cross_platform_identity_test.go`
  - Discord + Telegram evidence unification
  - wallet evidence precedence
  - unverified Discord-wallet exclusion
  - foreign-owner exclusion
  - unauthenticated rejection
  - provider-only proof cannot claim wallet fields
  - deterministic ordering
  - HTTP behavior/authentication
- `mail/http.go`
  - authenticated `GET /v1/integrations/identity`
- `mail/client/client.go`
  - typed `CrossPlatformIdentity`
- `mail/web/index.html`
  - thin verified-identity status view
- `config/420mail-service-v1.json`
  - explicit root identity/evidence/assurance/privacy policy
- `docs/420MAIL.md`
  - proof-strength, provider, API/client, isolation and privacy boundaries
- `scripts/verify-420mail-audit.py`
  - retained MAIL-2.27 config/source/API/client/UI checks

## Exit criteria / invariants individually verified

### Root identity

The response root is the authenticated 420Mail actor.

No second canonical identity authority is introduced.

### Durable evidence only

The view is derived only from committed durable Mail state:
- `DiscordSync`;
- `TelegramSync`;
- verified `DiscordWalletVerifications`.

Transient link responses and caller-provided identity claims are not accepted as cross-platform verification evidence.

### Assurance preservation

`WALLET_VERIFIED` is only emitted from already-qualified canonical Discord wallet verification state.

It carries:
- chain ID;
- wallet account;
- wallet verification timestamp.

`PROVIDER_AUTHORITY_VERIFIED` does not expose chain/account claims.

### Assurance precedence

For one Discord connection:
- verified wallet evidence supersedes provider sync evidence;
- the connection appears once;
- proof is not duplicated at multiple strengths.

### Unverified-state rejection

Unverified Discord challenge state is excluded.

No successful verification is inferred merely from:
- an existing challenge;
- a connection-ID shape;
- a provider name;
- user input.

### Owner isolation

Only durable evidence whose `Owner` exactly equals the authenticated Mail actor is included.

Foreign-user Discord/Telegram records are excluded.

### Provider scope

Current supported provider identity evidence:
- Discord;
- Telegram.

Signal is intentionally excluded due to the unsatisfied MAIL-2.22 deep-sync gate.

### Deterministic ordering

Accounts are ordered by:
1. provider ascending;
2. connection ID ascending.

### Security/privacy boundary

MAIL-2.27 does not expose:
- provider access credentials;
- Telegram/Discord authorization references;
- wallet private keys;
- seed phrases;
- raw signature evidence;
- private Mail message bodies.

No public indexing or on-chain body exposure is introduced.

## Level 1 qualification

Workflow: **420Mail Audit Qualification**

- Run: **37523804478** (#394)
- Job: **112475578448**
- Qualified feature SHA: `d761b92767ee5d6b7b8de407b4bfd0e3dad87c61`
- Exact tested merge candidate: `4c1c02f05a2a716b6525582de93c92d6d178e9e9`
- Exact tested current-main parent: `e75beb8779a7749ad58a9f9e1156e731b70d36db`

Exact checkout evidence:
`HEAD is now at 4c1c02f Merge d761b92767ee5d6b7b8de407b4bfd0e3dad87c61 into e75beb8779a7749ad58a9f9e1156e731b70d36db`

Results:
- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS
- verifier explicitly reported:
  `MAIL-2.27 cross-platform verified identity: qualified by app-scoped checks`

## Superseded attempt

### Run 37523691044 / job 112475201473

- Exact head — PASS
- Go format — FAIL
- tests/race/vet/verifier skipped
- diagnosis: formatting-only alignment in `mail/cross_platform_identity_test.go`
- action: exact formatter diff applied

The superseded run is not completion evidence.

## Main reconciliation

During qualification, `main` advanced from the prior base to:
`e75beb8779a7749ad58a9f9e1156e731b70d36db`.

GitHub generated and qualified exact merge candidate:
`4c1c02f05a2a716b6525582de93c92d6d178e9e9`

Its parents are:
- current main: `e75beb8779a7749ad58a9f9e1156e731b70d36db`;
- feature SHA: `d761b92767ee5d6b7b8de407b4bfd0e3dad87c61`.

The audit branch was then fast-forwarded directly to that **same already-qualified merge SHA**.

No new implementation SHA was created by reconciliation.

After reconciliation:
- branch behind `main`: 0;
- PR mergeable: true.

## Milestone status

MAIL-2.27 is an ordinary step inside the documented **External bridge milestone (MAIL-2.15 through MAIL-2.29)**.

- Level 2: **NOT RUN / NOT DUE**
- prior Mailbox Foundation and Wallet-native identity Level 2 evidence remains valid
- External bridge Level 2 remains due at MAIL-2.29 unless an earlier material shared-dependency reason requires it

## Intentionally deferred Level 3

Level 3 remains reserved for complete app-phase closeout.

No deliberate full repository Solidity inventory, duplicate Genesis full Foundry inventory, 420 Integrated/global qualification, Geth/global fault/soak suite, unrelated app audit, or broad repository closeout was run for this ordinary step.

Automatically triggered unrelated workflows are not claimed as MAIL-2.27 evidence.

## Limitations / blockers

No repository-side blocker remains for MAIL-2.27 completion.

Current proof coverage intentionally reflects qualified provider capabilities:
- Discord can reach wallet-verified assurance;
- Telegram currently reaches provider-authority verification only;
- Signal is excluded until its deep-sync condition is legitimately satisfied.

## Evidence inheritance

This evidence file and companion roadmap/PR bookkeeping are documentation/evidence-only and inherit qualification from the exact implementation SHA above without recursive requalification.

## Next canonical step

**MAIL-2.28 — Integration-Specific Filters**
