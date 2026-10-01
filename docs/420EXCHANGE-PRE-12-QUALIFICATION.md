# 420Exchange PRE-12 final pre-testnet closeout qualification

**Step:** PRE-12 — pre-testnet release candidate, reconciliation and handoff  
**Status:** COMPLETE  
**Qualification level:** Level 3 complete app-phase closeout  
**Qualified implementation SHA:** `12a86ab021395434bafca88870f26b7d34f955c1`  
**Reconciled main SHA:** `42c6a40cb476122f75250835c46d32e846a56881`  
**Audit branch:** `audit/exchange-pretestnet-phase-20260930`  
**Delivery PR:** #430

## Canonical exit criteria

PRE-12 required:

1. reconcile the completed PRE branch with latest `main`;
2. final gap audit PRE-01 through PRE-11;
3. no required pre-testnet implementation item remains PARTIAL/TODO;
4. all real trading actions remain disabled by default;
5. complete exact-head retained qualification suite;
6. record exact source SHA, artifacts, schemas and service versions;
7. enumerate each remaining LIVE GATE with owner, required endpoint/account/configuration, expected evidence and rollback;
8. update main Exchange status roadmap to live-testnet qualification;
9. merge only after exact-head checks are green.

All nine criteria are satisfied for the qualified implementation SHA.

## Final reconciliation

The audit branch was reconciled with current `main` twice during PRE-12 because `main` advanced while qualification was running.

Final reconciled base:

`42c6a40cb476122f75250835c46d32e846a56881`

Final qualified Exchange candidate:

`12a86ab021395434bafca88870f26b7d34f955c1`

At qualification time the branch was 0 commits behind `main` and mergeable.

Current-main non-Exchange authority was preserved during reconciliation. The only shared policy merge retained an Exchange-specific exception so PRE-12 could continue to receive the canonically required 420 Integrated exact-head qualification while the newer audit-branch skip policy remained intact for other audit branches.

## PRE-01 through PRE-11 gap audit

- PRE-01 — COMPLETE
- PRE-02 — COMPLETE
- PRE-03 — COMPLETE
- PRE-04 — COMPLETE
- PRE-05 — COMPLETE
- PRE-06 — COMPLETE
- PRE-07 — COMPLETE
- PRE-08 — COMPLETE
- PRE-09 — COMPLETE
- PRE-10 — COMPLETE
- PRE-11 — COMPLETE

No required pre-testnet Exchange architecture or integration service remains PARTIAL/TODO.

## Hard-OFF execution posture

The authoritative handoff records are:

- `exchange/pretestnet-readiness.json`
- `contracts/config/exchange/pretestnet-readiness-v1.json`

All LIVE GATES remain unresolved and `DISABLED_PRETESTNET`:

- `swapSubmission`
- `orderSigning`
- `orderPublication`
- `orderWithdrawal`
- `orderCancellation`
- `bridgeSubmission`
- `bridgeProofAcceptance`

Each gate records owner, required endpoint/account/configuration, expected live evidence and rollback procedure.

## Exact-head Level 3 qualification

Exact candidate:

`12a86ab021395434bafca88870f26b7d34f955c1`

Required closeout workflows:

- **420Exchange Web Verification** — run `36814053640` / #772 — **SUCCESS**
- **420 Integrated Qualification** — run `36814053435` / #6128 — **SUCCESS**
- **Solidity Contracts** — run `36814053481` / #3525 — **SUCCESS**
- **Genesis Address Authority** — run `36814053422` / #336 — **SUCCESS**

The Integrated run included successful offline-core, production dependency, pinned-Geth/live-engine and fault-matrix/soak qualification.

The Solidity run selected the full PR shard matrix and completed successfully.

The Genesis run completed canonical namespace/manifest authority plus the full current-main Foundry inventory successfully.

420Docs, 420Indexer, Registry and Explorer workflows skipped on the final reconciliation SHA under current-main audit-branch policy. Their relevant Exchange dependencies had already passed on the immediately preceding reconciled PRE-12 candidate, and the final reconciliation took their current-main versions authoritatively. They are not substitutes for the four exact-head PRE-12 gates above.

## Artifacts, schemas and services

PRE-12 retains and hands off:

- deterministic browser build metadata;
- deterministic pre-testnet package manifest;
- quote request/response/error/auth schemas;
- order publication/status/withdrawal schemas;
- V13.6 Exchange read API contract;
- PRE-05 authenticated quote provenance policy;
- PRE-06 guarded swap lifecycle;
- PRE-07/08 publication/cancellation lifecycle;
- PRE-09 bridge lifecycle;
- PRE-10 read-service/420Indexer adapter;
- PRE-11 security/operations/runbook/readiness controls.

## Handoff

The authoritative next-phase roadmap is:

`docs/420EXCHANGE-STATUS-ROADMAP.md`

Release transition:

`PRE_TESTNET_ENGINEERING_COMPLETE` → `LIVE_TESTNET_QUALIFICATION_PENDING`

Deferred live-testnet work remains intentionally blocked until a real testnet/deployment exists:

- real chain/genesis/RPC;
- deployed Exchange addresses/code hashes;
- live token/market/route/bridge configuration;
- live quote signer and chain-derived quote production;
- real balances/allowances/gas/nonce/simulation;
- real wallet/device matrix;
- live swap/order/cancellation/bridge execution;
- public hosting/DNS/TLS;
- operator/security signoff and Genesis go/no-go.

No mock or placeholder may satisfy those gates.

## Final decision

**PRE_TESTNET_ENGINEERING_COMPLETE**

**LIVE_TESTNET_QUALIFICATION_PENDING**

PRE-12 is complete. The qualified implementation SHA is eligible for merge to `main`.
