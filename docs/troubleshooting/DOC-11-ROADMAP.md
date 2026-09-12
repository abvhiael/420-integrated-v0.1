---
title: DOC-11 troubleshooting and error registry roadmap
audience:
  - user
  - developer
  - operator
category: troubleshooting
status: active
version: current
---

# DOC-11 — Troubleshooting and error registry

DOC-11 builds the canonical ecosystem-wide troubleshooting system for 420 Integrated. It turns symptoms, stable error identifiers, failed actions, degraded services and recovery procedures into a predictable documentation surface that can be searched by users, developers and operators without exposing secrets or confusing derived service state with canonical protocol state.

## Phase policy

DOC-11 is monolithic. DOC-11.1 through DOC-11.10 remain on one branch and one pull request. Individual substeps are not merged separately. The phase merges once, after the final coverage audit, reconciliation against current `main`, exact-head 420Docs Qualification and exact-head 420 Integrated Qualification are green.

Branch: `docs/doc-11-troubleshooting-error-registry`

## Scope and authority

The troubleshooting registry documents symptoms, stable documentation identifiers, affected surfaces, severity, authority source, diagnostic evidence, safe recovery order, retry semantics, escalation boundaries and related canonical documentation.

DOC-11 does not invent runtime error codes, contract selectors, RPC methods, deployment addresses or protocol authority. Machine-derived selectors and generated reference remain owned by DOC-10. Runtime/application sources remain authoritative for actual emitted errors and behavior. Troubleshooting pages translate those facts into safe diagnosis and recovery guidance.

No troubleshooting flow may ask a user to reveal private keys, seed phrases, passkeys, recovery secrets, signer material or other authentication secrets.

## Roadmap

### DOC-11.1 — Troubleshooting foundation and registry contract — COMPLETE

- [x] Define stable documentation error-ID format and namespace rules.
- [x] Define required registry fields: ID, title, audience, surface, symptom, likely causes, authority source, severity, retry safety, diagnostic evidence, recovery steps, escalation and cross-links.
- [x] Define canonical-versus-derived diagnosis rules.
- [x] Establish safe-support and secret-handling requirements.
- [x] Establish troubleshooting navigation and page layout through the reusable entry template.

Deliverables:

- `docs/troubleshooting/registry-contract.md`
- `docs/troubleshooting/entry-template.md`

### DOC-11.2 — Wallet, account and authorization troubleshooting — COMPLETE

- [x] Wallet connection and network mismatch.
- [x] Smart-account discovery and authorization epochs.
- [x] Capability/session/passkey failures.
- [x] Signing/simulation failures.
- [x] Recovery and lost-device states.
- [x] Pending/failed transaction interpretation.

Deliverables:

- `docs/troubleshooting/wallet-account-authorization.md`
- stable `TRB-WALLET-001` through `TRB-WALLET-011`
- troubleshooting index navigation into the Wallet/account registry

### DOC-11.3 — Chain, RPC and transaction troubleshooting — COMPLETE

- [x] RPC availability and method failures.
- [x] Chain-ID/network mismatch.
- [x] Transaction submission, replacement, nonce and gas failures.
- [x] Receipt/finality/reorg interpretation.
- [x] Safe retry/idempotency guidance.
- [x] Canonical node versus gateway/proxy diagnosis.

Deliverables:

- `docs/troubleshooting/chain-rpc-transactions.md`
- stable `TRB-CHAIN-*`, `TRB-RPC-*` and `TRB-TX-*` entries covering identity, transport, method policy, ambiguous write submission, nonce/gas/replacement/pending/revert states, reorg/finality and derived-view disagreement
- troubleshooting index navigation into the chain/RPC/transaction registry

### DOC-11.4 — Consensus, validator and node troubleshooting — COMPLETE

- [x] Validator eligibility/activation/exit issues.
- [x] Proposer/attestation/QC/finality symptoms.
- [x] Quorum loss and partition behavior.
- [x] `fourtwentyd` and `node420` startup/health failures.
- [x] Engine connectivity and signing safety.
- [x] Recovery order and stop conditions.

Deliverables:

- `docs/troubleshooting/consensus-validator-node.md`
- stable `TRB-CONSENSUS-*` and `TRB-NODE-*` entries covering validator lifecycle, proposer/attestation/QC/finality, quorum loss, partitions, safety halt/equivocation, process health, Engine connectivity, consensus/execution divergence, remote signer uncertainty and restart recovery
- troubleshooting index navigation into the consensus/validator/node registry

### DOC-11.5 — Indexer, Explorer, Search, Analytics and status troubleshooting — COMPLETE

- [x] Stale or missing indexed data.
- [x] Reorg/replay/rebuild states.
- [x] Search/index mismatch.
- [x] Explorer/Analytics derived-data discrepancies.
- [x] Health/readiness/status interpretation.
- [x] Canonical RPC fallback guidance.

Deliverables:

- `docs/troubleshooting/indexer-explorer-search-analytics-status.md`
- stable `TRB-INDEXER-*`, `TRB-EXPLORER-*`, `TRB-SEARCH-*`, `TRB-ANALYTICS-*` and `TRB-STATUS-*` entries
- canonical-RPC-first fallback order and explicit derived-service non-authority rules
- troubleshooting index navigation into the derived-service registry

### DOC-11.6 — Value movement and economic troubleshooting — COMPLETE

- [x] 420Pay, Token, Swap/Exchange and Bridge failures.
- [x] Stake/reward/fee interpretation.
- [x] Settlement, timeout, replay and refund states.
- [x] Cross-chain proof/route/finality failures.
- [x] Safe retry versus manual review boundaries.
- [x] Explicit fund-risk and escalation warnings.

Deliverables:

- `docs/troubleshooting/value-movement-economics.md`
- stable `TRB-PAY-*`, `TRB-TOKEN-*`, `TRB-SWAP-*`, `TRB-BRIDGE-*`, `TRB-STAKE-*` and fee-related `TRB-TX-*` coverage
- explicit fail-safe guidance for ambiguous payment/swap/bridge outcomes, replay protection, source/destination finality, settlement/refunds and duplicate-write prevention
- troubleshooting index navigation into the value-movement/economics registry

### DOC-11.7 — Shared protocol and provider troubleshooting — COMPLETE

- [x] Registry/Names/Identity/420-IS discovery failures.
- [x] Randomness/oracle freshness and verification failures.
- [x] Storage/Resource provider availability and proof failures.
- [x] 420AI job/provider/SLA failures.
- [x] Rights/Verify/Arbitration evidence and state issues.
- [x] Messenger/Notifications/Attention delivery versus canonical-state distinctions.

Deliverables:

- `docs/troubleshooting/shared-protocol-provider.md`
- stable `TRB-REGISTRY-*`, `TRB-NAMES-*`, `TRB-IDENTITY-*`, `TRB-RANDOM-*`, `TRB-ORACLE-*`, `TRB-STORAGE-*`, `TRB-AI-*`, `TRB-RIGHTS-*`, `TRB-VERIFY-*`, `TRB-ARBITRATION-*`, `TRB-MESSENGER-*`, `TRB-NOTIFY-*` and `TRB-ATTENTION-*` coverage
- provider-neutral recovery order that preserves original object/job/request IDs and never promotes provider-local success into canonical success
- troubleshooting index navigation into the shared-protocol/provider registry

### DOC-11.8 — Genesis application troubleshooting coverage — COMPLETE

- [x] Map every frozen Genesis application manual to troubleshooting entries.
- [x] Ensure protocol-only and testnet-only boundaries remain explicit.
- [x] Add application-specific symptom-to-recovery entries where shared entries are insufficient.
- [x] Cross-link application manuals, developer guides and generated reference through the shared registry model.
- [x] Prevent duplicated or conflicting recovery instructions.

Deliverables:

- `docs/troubleshooting/genesis-application-coverage.md`
- explicit mapping for all 20 frozen Genesis/testnet manual targets
- `TRB-APP-001` through `TRB-APP-003` for AppStore catalogue disagreement, Governance presentation disagreement and Faucet request-policy ambiguity
- protocol-only 420 Gaming Protocol preserved outside the standalone application matrix
- testnet-only/no-value Faucet scope preserved
- troubleshooting index navigation into the Genesis application coverage matrix

### DOC-11.9 — Search, diagnostics and support workflow — COMPLETE

- [x] Build searchable error-ID and symptom indexes.
- [x] Add audience/surface/severity discovery rules in the documentation structure.
- [x] Define copy-safe diagnostic bundles that exclude secrets.
- [x] Define escalation paths for user support, developer debugging and operator incidents.
- [x] Add stable deep-link rules suitable for later contextual links in DOC-14.

Deliverables:

- `docs/troubleshooting/search-diagnostics-support.md`
- exact-ID and symptom-first search guidance
- audience/severity/surface routing and quick-routing table
- minimum copy-safe diagnostic bundle plus explicit forbidden-secret list
- user/developer/operator escalation workflows
- stable `/troubleshooting/<registry-page>/#trb-domain-nnn` deep-link contract for DOC-14
- troubleshooting index navigation into search/diagnostics/support guidance

### DOC-11.10 — Ecosystem troubleshooting coverage audit and closeout

- Audit every required troubleshooting domain and frozen Genesis application.
- Verify stable IDs are unique and cross-linked.
- Verify canonical/derived authority language.
- Verify retry, finality, value-risk and secret-safety guidance.
- Verify navigation/search discoverability.
- Verify no troubleshooting entry promotes examples, plans, localhost values or unverified state into canonical authority.
- Reconcile with current `main`, run exact-head qualification, then merge once.

## Exit condition

A user, developer or operator can start from either a visible symptom or stable troubleshooting ID, identify which subsystem and authority source matters, collect safe diagnostic evidence, understand whether a retry is safe, follow an ordered recovery path, distinguish canonical chain/protocol state from derived service state, and escalate with useful non-secret context. Every frozen Genesis application and major infrastructure/protocol family has an explicit troubleshooting path, and all entries are searchable, uniquely identified and cross-linked to canonical task guidance and generated reference.
