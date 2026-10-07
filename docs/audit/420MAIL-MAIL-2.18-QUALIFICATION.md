# 420Mail MAIL-2.18 Qualification

## Step

**MAIL-2.18 — Discord Wallet Verification**

## Completion

- Status: **COMPLETE**
- Qualification level: **Level 1 — app-scoped step qualification**
- Qualified implementation SHA: `cee6b7ffc801e88f7945ffe74fcf45060ba8141b`
- Exact qualified PR merge-candidate SHA: `e2075872e05da33f788b8482d9be044e3f65dc80`
- Current `main` / base SHA: `23ebff000a471bfbc4439894f797f3b17a530867`
- Audit branch: `mail-2-11-email-wallet-onboarding-20261006`
- PR: #537

## Canonical requirement satisfied

MAIL-2.18 binds a linked Discord identity to a canonically verified wallet account while preserving the existing Wallet/Identity authority boundary established by MAIL-2.13.

Discord does not become a signing or verification authority. 420Mail does not accept wallet private material.

## Implementation summary

Implemented/updated repository surfaces:

- `mail/discord_wallet.go`
  - `DiscordWalletChallengeRequest`
  - `DiscordWalletChallenge`
  - `DiscordWalletVerificationRequest`
  - `DiscordWalletVerification`
  - durable `DiscordWalletVerificationState`
  - `DiscordWalletVerificationService`
  - domain-separated challenge digest
  - durable restart-safe challenge binding
  - canonical Wallet signature verification
  - replay-safe verified state
  - cross-user / cross-Discord-connection / account-substitution protection
- `mail/discord_wallet_test.go`
  - challenge binding
  - domain separation
  - canonical verification
  - successful replay behavior
  - cross-identity / cross-connection rejection
  - expiry rejection
  - malformed/overlong challenge rejection
  - wrong-account rejection
  - durable restart qualification
  - authenticated HTTP lifecycle
  - secret-bearing-field rejection
- `mail/discord_link.go`
  - Discord connector advertises `WALLET_VERIFY`
- `mail/discord_link_test.go`, `mail/discord_delivery_test.go`
  - existing capability expectations reconciled with MAIL-2.18
- `mail/store.go`
  - durable Mail schema advanced from v9 to **v10**
  - persisted non-secret Discord wallet verification challenge state
  - migration/clone/normalization/validation support
- `mail/http.go`
  - authenticated `POST /v1/connectors/discord/wallet/challenge`
  - authenticated `POST /v1/connectors/discord/wallet/verify`
- `mail/client/client.go`
  - typed `PrepareDiscordWalletVerification`
  - typed `VerifyDiscordWallet`
- `mail/web/index.html`
  - capability-gated **Verify Discord wallet** action
  - qualified Wallet deployment adapter remains responsible for obtaining canonical evidence
- `config/420mail-service-v1.json`
  - metadata store schema v10
  - explicit Discord wallet-verification policy
- `docs/420MAIL.md`
  - authority, challenge, persistence, replay and scope boundaries
- `scripts/verify-420mail-audit.py`
  - retained schema-v10 and MAIL-2.18 configuration/source/API/client/UI checks

## Exit criteria / invariants individually verified

### Discord identity binding

Every challenge binds:
- authenticated 420Mail identity
- canonical linked Discord connection ID
- Discord user snowflake derived from that connection
- chain ID
- wallet account
- explicit expiry

The challenge domain is:
`420/MAIL/DISCORD/WALLET-VERIFY/V1`

Changing the Discord connection/user, chain, account, owner, or expiry changes the challenge digest.

### Canonical Wallet authority

The challenge is prepared through the existing `WalletActionService` as a `MESSAGE_SIGNATURE` handoff.

The handoff must:
- match the requested chain/account/digest/expiry
- remain non-custodial
- require explicit Wallet approval

Verification is delegated to the existing Wallet verification authority and must return:
- kind `SIGNATURE`
- same handoff ID
- same authenticated Mail identity
- same wallet account
- `verified=true`
- `canonical=true`
- non-zero verification timestamp
- `non_custodial=true`

Discord itself is never accepted as canonical proof.

### Challenge TTL

Challenge lifetime is bounded to at most **10 minutes**.

Expired challenges fail closed before canonical proof is accepted.

### Durable restart-safe binding

Non-secret challenge metadata is persisted in Mail schema v10:
- handoff ID
- Mail owner
- Discord connection/user
- chain
- account
- digest
- expiry
- verified state/timestamp
- version

Raw signature evidence is not persisted.

The durable state survives store restart and prevents a Wallet proof from being detached from the Discord identity it was originally issued for.

### Replay safety

After successful canonical verification, replay of the same verification request returns the durable verified binding and does not invoke canonical Wallet verification again.

### Isolation / substitution resistance

Qualification covers:
- wrong Mail actor
- wrong Discord connection
- wrong wallet account returned by Wallet authority
- expired challenge
- malformed connection/account/chain
- excessive challenge TTL
- raw private-key field injection at HTTP boundary

All fail closed.

### Privacy and authority boundary

MAIL-2.18 does not:
- persist private keys, seed phrases, passkey private material, or raw verification evidence
- grant Discord signing authority
- allow Discord provider evidence to replace canonical Wallet verification
- publish verification binding to public 420Search
- put proof material or private content on-chain

## Level 1 qualification

Workflow: **420Mail Audit Qualification**

- Run: **37507536380** (#281)
- Job: **112419895971**
- Qualified implementation SHA: `cee6b7ffc801e88f7945ffe74fcf45060ba8141b`
- Exact tested merge candidate: `e2075872e05da33f788b8482d9be044e3f65dc80`
- Current-main parent: `23ebff000a471bfbc4439894f797f3b17a530867`

Exact checkout evidence:
`HEAD is now at e207587 Merge cee6b7ffc801e88f7945ffe74fcf45060ba8141b into 23ebff000a471bfbc4439894f797f3b17a530867`

Results:
- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS
- verifier explicitly reported: `MAIL-2.18 Discord wallet verification: qualified by app-scoped checks`

## Superseded attempts / diagnosed failures

### Run 37507094989 / job 112418405389

- Exact head — PASS
- Go format — FAIL
- later checks skipped
- diagnosis: formatting-only candidate failure in new client/test/store changes
- action: exact formatter output applied

### Run 37507422166 / job 112419503440

- Exact head — PASS
- Go format — PASS
- Go test — FAIL
- race/vet/verifier skipped
- diagnosis: stale MAIL-2.17 test expectation still treated `WALLET_VERIFY` as a forbidden later capability after MAIL-2.18 intentionally introduced it
- action: capability expectation updated while continuing to reject unconfigured Discord webhook capability

Neither superseded run is completion evidence.

## Main reconciliation status

At MAIL-2.18 qualification:
- current `main`: `23ebff000a471bfbc4439894f797f3b17a530867`
- branch compare status: ahead
- branch behind count: 0
- PR mergeable: true

No additional main reconciliation commit was required because current `main` remained the already-reconciled base throughout MAIL-2.18.

## Milestone status

MAIL-2.18 is an ordinary step inside the documented **External bridge milestone (MAIL-2.15 through MAIL-2.29)**.

- Level 2: **NOT RUN / NOT DUE**
- prior Mailbox Foundation and Wallet-native identity Level 2 evidence remains valid
- External bridge Level 2 remains deferred to the documented milestone boundary or an earlier material shared-dependency reason

## Intentionally deferred Level 3

Level 3 remains reserved for complete app-phase closeout.

No deliberate full repository Solidity inventory, duplicate Genesis full Foundry inventory, 420 Integrated/global qualification, Geth/global fault/soak suite, unrelated app audit, or broad repository closeout was run for this ordinary step.

Automatically triggered unrelated workflows are not claimed as MAIL-2.18 evidence.

## Live/deployment limitations

Repository completion does not claim:
- live Discord OAuth/provider credentials
- live Wallet signature UX
- production RPC/signature-verification evidence
- public-testnet Discord↔wallet binding
- production provider availability
- downstream cross-platform verified identity behavior

Those remain later roadmap/live testnet/security/operations gates.

## Evidence inheritance

This evidence file and companion roadmap/PR bookkeeping are documentation/evidence-only and inherit qualification from the exact implementation SHA above without recursive requalification.

## Next canonical step

**MAIL-2.19 — Signal Integration Boundary**
