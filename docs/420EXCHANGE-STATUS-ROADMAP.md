# 420Exchange — release status and live-testnet qualification roadmap

**Current phase:** PRE-12 final pre-testnet closeout.  
**Release state:** `PRE_TESTNET_ENGINEERING_COMPLETE` candidate; `LIVE_TESTNET_QUALIFICATION_PENDING` once exact-head PRE-12 qualification is green.  
**Audit branch:** `audit/exchange-pretestnet-phase-20260930`.  
**Primary PR:** #430.  
**Authority:** repository state, canonical PRE roadmap, exact-head qualification evidence and machine-readable readiness manifest.  
**This document is not an authorization to trade or enable any LIVE GATE.**

## Pre-testnet engineering disposition

PRE-01 through PRE-10 are complete and revalidated against the accumulated Exchange architecture.

PRE-11 has implemented the remaining CI/security/packaging/operations closure:

- dedicated quote, order/cancel, read-service, bridge and browser qualification;
- browser CSP and backend exact-origin/no-ambient-credential policy;
- secret/log-redaction checks;
- deterministic pre-testnet package manifest;
- startup/degradation/restart coverage;
- hard assertions that all live trading gates default OFF;
- signer rotation, outage, Indexer backfill, pause, rollback and reconciliation runbook;
- machine-readable readiness manifest.

PRE-12 reconciles this branch with current `main`, performs the final gap audit, records the live-gate handoff and runs the complete exact-head retained qualification suite before merge.

Canonical implementation roadmap and detailed evidence:

- `docs/420EXCHANGE-PRE-TESTNET-COMPLETION-ROADMAP.md`
- `exchange/pretestnet-readiness.json`
- `contracts/config/exchange/pretestnet-readiness-v1.json`
- `docs/420EXCHANGE-PRE-11-OPERATIONS-RUNBOOK.md`

## Architecture now available before a live network

The repository now contains all application architecture and integration services that can reasonably be constructed offline:

| Surface | Pre-testnet disposition |
| --- | --- |
| Wallet/session authority | explicit EIP-1193 provider selection, session generation and invalidation; no hidden wallet fallback |
| Read-only UX | metadata-driven market/swap review with stale/error clearing and no wallet prompt |
| Executable quote service | versioned executable quote backend with bounded request/response policy and fail-closed deployment/route inputs |
| Quote provenance | Ed25519-authenticated canonical quote envelope, exact producer/key/deployment/account/chain/replay/transaction-fingerprint binding |
| Swap orchestration | authenticated quote → human review → explicit confirmation → fresh preflight → independently gated send → lifecycle reconciliation |
| Limit-order publication | canonical EIP-712 identity, maker/domain verification, idempotent publication and provenance-bound status |
| Maker cancellation | maker-only withdrawal plus HASH/NONCE cancellation with fresh settlement/order checks and racing-fill protection |
| Bridge lifecycle | route/manifest identity, independent proof verification, source/destination finality, exact beneficiary/asset/amount settlement and replay protection |
| Exchange read API | repository-owned V13.6 adapter over 420Indexer V1 with provenance/canonicality/finality/freshness and non-authoritative projection semantics |
| Operations/release | restrictive browser headers, backend origin/credential policy, redacted logs, deterministic packaging, restart/degradation tests, operator runbook and readiness manifest |

No additional offline application service is intentionally deferred.

## LIVE GATES — all remain OFF

The authoritative handoff is `exchange/pretestnet-readiness.json`.

The following gates must remain `DISABLED_PRETESTNET` until their live-testnet evidence is independently qualified:

1. `swapSubmission`
2. `orderSigning`
3. `orderPublication`
4. `orderWithdrawal`
5. `orderCancellation`
6. `bridgeSubmission`
7. `bridgeProofAcceptance`

Each gate now records:

- owning PRE step/operator boundary;
- required endpoint/account/configuration;
- expected live evidence;
- rollback procedure.

The readiness manifest itself has `READINESS_EVIDENCE_ONLY` authority and cannot enable a gate.

## Live-testnet qualification roadmap

The next phase begins only after PRE-12 exact-head qualification and merge.

### LT-01 — deployment and network binding

Supply and independently verify:

- actual testnet chain ID/genesis identity;
- qualified RPC endpoints;
- deployed Exchange contract addresses;
- runtime code hashes;
- deployment/manifest identity;
- token metadata;
- market/route/bridge configuration.

No placeholder or example endpoint may satisfy this gate.

### LT-02 — authenticated quote production

Operate the PRE-05 quote signer from externally managed key material and prove:

- producer/key identity and bounded rotation;
- deployed chain/router/manifest binding;
- live route/chain input freshness;
- replay rejection;
- browser verification of exact transaction fingerprint.

### LT-03 — live wallet and preflight qualification

Exercise real supported wallets and providers across account/network changes and prove:

- balances/allowances;
- gas and nonce;
- simulation/revert handling;
- approval separation;
- stale-session rejection;
- explicit user confirmation.

### LT-04 — swap execution

Enable `swapSubmission` only inside the controlled qualification environment and retain:

- submitted hash;
- canonical receipt/finality;
- failure/replacement/reorg behavior;
- fee and Indexer reconciliation;
- rollback evidence.

### LT-05 — order lifecycle

Qualify real:

- EIP-712 signing;
- order publication;
- accepted/partial/filled state;
- maker withdrawal;
- HASH/NONCE cancellation;
- racing fill/cancel outcomes;
- canonical settlement/Indexer reconciliation.

### LT-06 — bridge lifecycle

Qualify a real source-to-destination transfer:

- source submission/finality;
- proof acquisition;
- independent proof verification;
- destination claim/finality;
- exact beneficiary/asset/amount payout;
- replay rejection;
- reorg/retry/refund recovery.

### LT-07 — public service and client acceptance

Qualify:

- DNS/TLS/public hosting;
- quote/order/read API origins;
- monitoring/readiness;
- Chrome/Firefox/Brave and supported extension/mobile wallets;
- accessibility/keyboard/screen-reader behavior;
- outages, restart, rollback and Indexer backfill drills.

### LT-08 — operator/security and Genesis decision

Require:

- independent security/permission review;
- final deployment/package provenance;
- secrets/key handling approval;
- accounting and treasury reconciliation;
- named operator/security signoff;
- exact release-head qualification;
- final Genesis go/no-go.

## Release control

A green pre-testnet build does **not** enable trading.

The transition after PRE-12 is:

`PRE_TESTNET_ENGINEERING_COMPLETE` → `LIVE_TESTNET_QUALIFICATION_PENDING`

Only successful live-testnet qualification may resolve individual LIVE GATES.

