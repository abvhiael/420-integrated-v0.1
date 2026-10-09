# S-10 — Operational soak, CMP-9 and CMP-10 handoff

**Disposition: NO-GO for operational qualification, source and funded testnet evidence outstanding.** This document and the manifest validator define a **fail-closed handoff**. Neither an offline manifest, asserted PASS flag nor unit-test fixture demonstrates operational source ingestion, chain settlement or successful soak.

## Canonical operational gates
All require actual independent live evidence on the exact release candidate: sustained ingest continuity; rate-limit/backoff behavior; restart/backfill correctness; source rescoring/correction; Indexer rollback and reorg restoration; source key rotation; trusted attester revocation; disaster recovery; funded-budget exhaustion; emergency pause; emergency rollback. Handoffs to **CMP-9.13 scientific demonstration, CMP-9.14 operational soak, CMP-9.15 CMP-0 closeout and CMP-10 security** are independent additional gates, not tests that can be inherited as passed.

The offline `compute/ingestion/src/soak.mjs` evaluates a complete named checklist, rejects absent gates and unreferenced passing checks, prohibits fixture-only GO, demands independently reviewed operator evidence and a qualified prior S-09. It **does not authenticate a supplied evidence reference**, validate a real transaction receipt, poll a network, rotate keys, execute a fault, certify a provider or establish governance approval. A real operator and an independent reviewer must verify signed original logs/receipts and deployment attestations before declaring GO.

## Preconditions and live-testnet dependencies
1. S-02 approved real Folding@home and named BOINC read-only sources, transport DNS pinning and rate-limit proof.
2. S-03 approved and independently authenticated work-unit acceptance sources; CMP-5.7 attester onboarding, revocation and corrections.
3. S-04 cryptographic Wallet proof, real external identity ownership, revocation/consent and persistent replay protection.
4. S-05 persistent canonical-work mapping, chain and reorg recovery, CMP-5.6 one-time claim consumption.
5. S-06 production 420Indexer event/read endpoint plus 420Compute UI authority labels, privacy and stale-source drills.
6. S-07 approved economic policy and funded testnet budget, without assuming points/credits are cryptocurrency.
7. S-08 actual canonical external-to-CMP-6 reward path, Vault funding, transaction receipts, Wallet payout and conservation.
8. S-09 **real, independently reviewed** BOINC and Folding@home funded contributions, exact-release Level 2 evidence.
9. S-10 sustained workloads, failure injection, secure key lifecycle, operator/independent sign-off and CMP-9.13/9.14/9.15/CMP-10 handoff evidence.

**Exit criteria:** authoritative documented NO-GO and enumerated blockers can be delivered offline; a **qualified operational GO is not possible** before testnet. The current no-go blocks production claims and payouts. No scope reduction, fixture promotion, service activation, live payout or expensive global rerun is authorized by this step.

**Follow-on:** CMP-9 public testnet scientific demonstration/soak/operational closeout and CMP-10 security campaigns, and later accumulated Level-3 app phase qualification. S-10 itself remains operationally pending until real evidence exists.
