---
title: DOC-11 troubleshooting and error registry roadmap
audience:
  - user
  - developer
  - operator
category: troubleshooting
status: complete
version: current
---

# DOC-11 — Troubleshooting and error registry — COMPLETE

DOC-11 builds the canonical ecosystem-wide troubleshooting system for 420 Integrated. It turns symptoms, stable documentation identifiers, failed actions, degraded services and recovery procedures into a predictable documentation surface that can be searched by users, developers and operators without exposing secrets or confusing derived service state with canonical protocol state.

## Phase policy

DOC-11 is monolithic. DOC-11.1 through DOC-11.10 remain on one branch and one pull request. Individual substeps are not merged separately. The phase merges once, after the final coverage audit, reconciliation against current `main`, exact-head 420Docs Qualification and exact-head 420 Integrated Qualification are green.

Branch: `docs/doc-11-troubleshooting-error-registry`

## Scope and authority

The troubleshooting registry documents symptoms, stable documentation identifiers, affected surfaces, severity, authority source, diagnostic evidence, safe recovery order, retry semantics, escalation boundaries and related canonical documentation.

DOC-11 does not invent runtime error codes, contract selectors, RPC methods, deployment addresses or protocol authority. Machine-derived selectors and generated reference remain owned by DOC-10. Runtime/application sources remain authoritative for actual emitted errors and behavior. Troubleshooting pages translate those facts into safe diagnosis and recovery guidance.

No troubleshooting flow may ask a user to reveal private keys, seed phrases, passkeys, recovery secrets, signer material or other authentication secrets.

## Roadmap

### DOC-11.1 — Troubleshooting foundation and registry contract — COMPLETE
- [x] Stable documentation error-ID format and namespace rules.
- [x] Required registry fields, authority, retry, secret-safety and page-layout contract.

### DOC-11.2 — Wallet, account and authorization troubleshooting — COMPLETE
- [x] Wallet/network, SmartAccount, capability/session/passkey, signing/simulation, recovery and transaction-state coverage.

### DOC-11.3 — Chain, RPC and transaction troubleshooting — COMPLETE
- [x] RPC availability/policy, chain identity, transaction submission/replacement/nonce/gas, finality/reorg and retry/idempotency coverage.

### DOC-11.4 — Consensus, validator and node troubleshooting — COMPLETE
- [x] Validator lifecycle, proposer/attestation/QC/finality, quorum/partition, `fourtwentyd`/`node420`, Engine and signing-safety coverage.

### DOC-11.5 — Indexer, Explorer, Search, Analytics and status troubleshooting — COMPLETE
- [x] Derived-service freshness/rebuild/discrepancy/readiness and canonical-RPC fallback coverage.

### DOC-11.6 — Value movement and economic troubleshooting — COMPLETE
- [x] 420Pay, Token, Swap/Exchange, Bridge, Stake, rewards/fees, settlement/refunds and fund-risk retry boundaries.

### DOC-11.7 — Shared protocol and provider troubleshooting — COMPLETE
- [x] Registry/Names/Identity, Randomness/Oracle, Storage/Resource, 420AI, Rights/Verify/Arbitration and Messenger/Notifications/Attention coverage.

### DOC-11.8 — Genesis application troubleshooting coverage — COMPLETE
- [x] All 20 frozen Genesis/testnet manual targets mapped into DOC-11.
- [x] `TRB-APP-001` through `TRB-APP-003` added only where shared-domain coverage is insufficient.
- [x] Gaming Protocol protocol-only and Faucet testnet-only/no-value boundaries preserved.

### DOC-11.9 — Search, diagnostics and support workflow — COMPLETE
- [x] Exact-ID/symptom search, audience/surface/severity routing, copy-safe diagnostics, escalation and DOC-14 deep-link contract.

### DOC-11.10 — Ecosystem troubleshooting coverage audit and closeout — COMPLETE
- [x] Audit every required troubleshooting domain and frozen Genesis application.
- [x] Verify stable-ID uniqueness/meaning and cross-link model.
- [x] Verify canonical-versus-derived authority language.
- [x] Verify retry/idempotency, finality, value-risk and consensus-safety guidance.
- [x] Verify secret-safe diagnostics and escalation rules.
- [x] Verify navigation/search discoverability and stable contextual anchors.
- [x] Verify examples, localhost values, plans, derived provider claims and unverified state are never promoted into canonical authority.

Deliverable:

- `docs/troubleshooting/coverage-audit.md`

## Exit condition

**Content exit condition satisfied.** A user, developer or operator can start from either a visible symptom or stable troubleshooting ID, identify which subsystem and authority source matters, collect safe diagnostic evidence, understand whether a retry is safe, follow an ordered recovery path, distinguish canonical chain/protocol state from derived service state, and escalate with useful non-secret context. Every frozen Genesis application and major infrastructure/protocol family has an explicit troubleshooting path, and all entries are searchable, uniquely identified in purpose and cross-linked to canonical task guidance and generated reference.

Final merge remains gated on reconciliation with current `main`, then exact-head 420Docs Qualification and exact-head 420 Integrated Qualification on the reconciled branch head. See `coverage-audit.md` for the DOC-11.10 audit record.
