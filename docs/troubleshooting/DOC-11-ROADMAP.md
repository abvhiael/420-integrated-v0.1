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

### DOC-11.1 — Troubleshooting foundation and registry contract

- Define stable documentation error-ID format and namespace rules.
- Define required registry fields: ID, title, audience, surface, symptom, likely causes, authority source, severity, retry safety, diagnostic evidence, recovery steps, escalation and cross-links.
- Define canonical-versus-derived diagnosis rules.
- Establish safe-support and secret-handling requirements.
- Establish troubleshooting navigation and page layout.

### DOC-11.2 — Wallet, account and authorization troubleshooting

- Wallet connection and network mismatch.
- Smart-account discovery and authorization epochs.
- Capability/session/passkey failures.
- Signing/simulation failures.
- Recovery and lost-device states.
- Pending/failed transaction interpretation.

### DOC-11.3 — Chain, RPC and transaction troubleshooting

- RPC availability and method failures.
- Chain-ID/network mismatch.
- Transaction submission, replacement, nonce and gas failures.
- Receipt/finality/reorg interpretation.
- Safe retry/idempotency guidance.
- Canonical node versus gateway/proxy diagnosis.

### DOC-11.4 — Consensus, validator and node troubleshooting

- Validator eligibility/activation/exit issues.
- Proposer/attestation/QC/finality symptoms.
- Quorum loss and partition behavior.
- `fourtwentyd` and `node420` startup/health failures.
- Engine connectivity and signing safety.
- Recovery order and stop conditions.

### DOC-11.5 — Indexer, Explorer, Search, Analytics and status troubleshooting

- Stale or missing indexed data.
- Reorg/replay/rebuild states.
- Search/index mismatch.
- Explorer/Analytics derived-data discrepancies.
- Health/readiness/status interpretation.
- Canonical RPC fallback guidance.

### DOC-11.6 — Value movement and economic troubleshooting

- 420Pay, Token, Swap/Exchange and Bridge failures.
- Stake/reward/fee interpretation.
- Settlement, timeout, replay and refund states.
- Cross-chain proof/route/finality failures.
- Safe retry versus manual review boundaries.
- Explicit fund-risk and escalation warnings.

### DOC-11.7 — Shared protocol and provider troubleshooting

- Registry/Names/Identity/420-IS discovery failures.
- Randomness/oracle freshness and verification failures.
- Storage/Resource provider availability and proof failures.
- 420AI job/provider/SLA failures.
- Rights/Verify/Arbitration evidence and state issues.
- Messenger/Notifications/Attention delivery versus canonical-state distinctions.

### DOC-11.8 — Genesis application troubleshooting coverage

- Map every frozen Genesis application manual to troubleshooting entries.
- Ensure protocol-only and testnet-only boundaries remain explicit.
- Add application-specific symptom-to-recovery pages where shared entries are insufficient.
- Cross-link application manuals, developer guides and generated reference.
- Prevent duplicated or conflicting recovery instructions.

### DOC-11.9 — Search, diagnostics and support workflow

- Build searchable error-ID and symptom indexes.
- Add audience/surface/severity filters in documentation structure where practical.
- Define copy-safe diagnostic bundles that exclude secrets.
- Define escalation paths for user support, developer debugging and operator incidents.
- Add direct stable anchors suitable for later contextual deep links in DOC-14.

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
