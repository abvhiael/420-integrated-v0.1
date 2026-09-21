# CMP-0.12 — Qualification, evidence register and closeout

Status: **CLOSEOUT GATE SPECIFIED; RUNTIME CLOSEOUT BLOCKED**. This is a documentation-only increment. No executable CMP contracts, fixture vectors, deployed worker, SDK or funded end-to-end market are introduced or certified here. The authority is the [frozen ComputeMarket V1 architecture](../420-COMPUTE-MARKET-V1-ARCHITECTURE.md), its CMP-INV-001–030, and the [CMP-0 phase overview](CMP-0-PROTOCOL-SPECIFICATION.md). The [source/integration audit](CMP-0.1-SOURCE-AND-INTEGRATION-AUDIT.md) is pinned to `main` `277395931f5419af0728f3ea801800401a8bb336`; it must be refreshed against current `main` before closeout. Do not use retired recovery branches as authority. No new fixed Genesis predeploy, no privilege for a scheduler or AI adapter, and no extra escrow.

## 1. Two distinct outcomes

**Specification coverage:** CMP-0.1 source inventory and CMP-0.2–0.11 design increments are committed on draft PR #367; CMP-0.12 defines what would constitute admissible executable evidence. Previous CI at `45d316f52351efe79038536e9bbdb4ac1be50bf3` passed 420Docs #2649 and 420 Integrated #5265 for CMP-0.11. Those results qualify that previous commit's repository workflows, **not** this new commit or the CMP runtime.

**Operational closeout:** BLOCKED until every required gate below is linked to real checked-in implementation, executable tests, recorded pass result and exact tested commit. A proposed filename, document, mocked adapter, missing test, green Docs build or unrelated Go qualification cannot be labeled as a functioning compute market. If only documentation coverage is reviewed, call it a *specification milestone* and leave operational gates OPEN. Do not merge PR #367 as a production-ready CMP launch.

## 2. Reproducible evidence register

For each gate, record in an append-only closeout table: `gateId`, requirement and CMP invariant IDs, audited source path at immutable SHA, deployment address/network/verified runtime codehash where applicable, test path and exact invocation, positive and negative fixture identifiers, workflow URL/run/job IDs, commit SHA, objective pass/fail status, reviewer or operator attestation if applicable, and remaining limitations. An unexecuted test is **NOT RUN**, not PASS. A failed or missing test leaves its gate BLOCKED. Distinguish static source inspection, isolated unit test, integration test, chain receipt, operator trial and production deployment. Capture native-$420 value flows from transaction logs **and** reconciled state, rather than treating a facade event as movement of funds. This document records required gates, not fabricated evidence.

## 3. Required executable gates and implementation order

| Gate | Concrete required proof | Current disposition |
| --- | --- | --- |
| Q01 — authority/registration | Reconcile frozen address map and current `main`; deploy CMP modules at nonconflicting nonfixed addresses, verify runtime codehash, interface and dependencies, then authorized ProtocolRegistry publication; distinguish candidate from active registration. Preserve AI `0x042f`–`0x0433`, registry `0x0434`, gateway `0x043c`. | OPEN; design only. |
| Q02 — canonical encoding/identity | Check in versioned full ABI-word/Keccak and EIP-712 fixtures for requests, match, jobs, work units, attempts, manifests, receipts, policy and decisions; independently reproduce exact bytes in Solidity and Go/TypeScript. Negative tests for packed ABI, SHA3-256, wrong domain/chain/version/nonce and replay. | OPEN; executable vectors/parity not evidenced. |
| Q03 — authorization/registry | Real narrowly scoped EOA/ERC-1271 and capability-grant checks with nonce/expiry, immutable provider/node/resource ancestry, eligible offers/requests, dual-authorized match, frozen beneficiary/quote, capacity/region/privacy compatibility, stale-revision concurrency and unauthorized-action failures. | OPEN; CMP contracts and dedicated tests not evidenced. |
| Q04 — lifecycle/worker | Actual accepted funded job with bounded plan, isolated off-chain worker, verified executable bytes and privacy policy, correct signed per-attempt receipts, restart/reorg/retry and tamper tests; no consensus/finality dependency and no duplicate unit entitlement. | OPEN; no verified end-to-end worker. |
| Q05 — correctness/verification | Implement versioned objective verifier and evidence availability under frozen acceptance policy, policy-specific independent check/quorum, bounded metering, negative incorrect/missing/fabricated proofs and insufficient quorum, admissible partial settlement only when preaccepted. | OPEN; worker signature alone is not correctness. |
| Q06 — payer-isolated Vault economics | On registered Vault, prove actual native-$420 deposit, payer-bound reserve, quote cap, atomic accepted matching, frozen provider beneficiary, independently verified unit earnings, one provider claim, separate *actual* payer withdrawal/refund and full balance/liability reconciliation. Include interleaved multiple payers, concurrent retries, double claim, cancellation, partial award, insufficiency, frozen/emergency state and failure rollback. `cancelObligation` merely frees a Vault-wide internal balance and is **not** an external refund. | OPEN; existing Vault source/isolated tests do not establish payer segregation or CMP split settlement. |
| Q07 — dispute/stake/privacy | Implement policy-bound challenge and appeal deadlines, per-entitlement holds/release, independent evidence admissibility, objective stake slash and appeal tests, protected evidence access, leakage/logging and nonconfiscatory emergency tests; no punishment based only on allegation, reputation or worker receipt. | OPEN; specification only. |
| Q08 — client/AI interoperability | Source-bound provider-neutral SDK/API/UI, optional isolated node worker, indexed finalized chain state and 420AI adapter with explicit AI↔CMP mapping, non-AI job with no AI dependency, bounded funding and truthful facade/Vault reconciliation. Inject stale indexes, unavailable endpoints, invalid signature, reorg, denied access and adapter outage. | OPEN; planned paths are not shipped integration. |
| Q09 — invariant mapping/security | For each CMP-INV-001–030 below, link an executable positive and adversarial test and its exact passing run; run Foundry fuzz/invariants, cross-client fixtures, concurrency, recovery and privilege/recipient abuse tests. Audit public-data minimization and external-call/reentrancy safety. | OPEN; document mapping alone does not pass tests. |
| Q10 — repository qualification/closeout | Refresh source audit on latest `main`; resolve drift without changing frozen addresses; execute independently required contract, worker, SDK/UI, AI adapter and funded chain tests plus full 420Docs/420 Integrated workflows against **the same final head**. Publish exact commit, runs, deployed codehash/registry evidence, limitations and a signed closeout classification. | OPEN until every prior gate passes. |

## 4. Frozen invariant-to-test acceptance register

Every line is **UNVERIFIED AT CMP RUNTIME** until an actual checked-in test ID and exact executed result are appended; these are required tests, not claims that tests exist.

| Invariant | Required positive/negative executable assertion |
| --- | --- |
| CMP-INV-001 | Run workload only in off-chain worker; induce worker failure and prove consensus/finality unaffected. |
| CMP-INV-002 | Allocate and query distinct provider/node/resource/offer/request/match/job/receipt/settlement IDs; reject type cross-use. |
| CMP-INV-003 | Attempt duplicate/reassigned canonical ID; original binding persists. |
| CMP-INV-004 | Try to move node between providers; require new identity instead. |
| CMP-INV-005 | Provider/resource registration cannot call Vault, validator, governance, bridge or wallet capabilities. |
| CMP-INV-006 | Request-scoped funding has bounded asset/amount/action and rejects excess and cross-request use. |
| CMP-INV-007 | Match exactly satisfies both accepted constraints; modified offer/request or hidden matcher fails. |
| CMP-INV-008 | After match, beneficiary, price, resource and verification policy edits fail. |
| CMP-INV-009 | Across all units, replicas, attempts and fees, settled total never exceeds actual requester limit. |
| CMP-INV-010 | Provider beneficiary derives from immutable canonical match; arbitrary recipient argument fails. |
| CMP-INV-011 | Unused balance remains payer-attributed and demonstrably withdrawn/refunded, including shared-Vault interleaving. |
| CMP-INV-012 | Every lifecycle change checks actor/capability/prerequisites; arbitrary admin setter fails. |
| CMP-INV-013 | Terminal job rejects restart, new paid attempt or renewed reserve. |
| CMP-INV-014 | Domain/chain/nonce-bound signed receipt replay and cross-job reuse fail. |
| CMP-INV-015 | Cumulative readings require prior-receipt link and monotonic bounded values; rollback or broken link fails. |
| CMP-INV-016 | Signed but incorrect execution cannot become verified or payable. |
| CMP-INV-017 | Accepted versioned policy is frozen and governs objective verification; silent downgrade fails. |
| CMP-INV-018 | Retry, replica alias, reorg and concurrent settlement cannot double-pay a unit/job entitlement. |
| CMP-INV-019 | One payer/provider/resource obligation cannot consume another party's reserved balance. |
| CMP-INV-020 | Suspension stops fresh assignment without altering independently earned existing claims. |
| CMP-INV-021 | Stake balance moves only through authorized deposit/withdraw/objective slash paths. |
| CMP-INV-022 | Slash requires exact preaccepted objective misconduct policy, admissible evidence and appeal window. |
| CMP-INV-023 | Trust signal publication/reputation changes cannot match, verify, settle, redirect or slash by themselves. |
| CMP-INV-024 | Private input/output/secret bytes absent from canonical state and public logs; encrypted authorized evidence remains retrievable for verifier. |
| CMP-INV-025 | Emergency halt blocks scoped new actions without confiscating, redirecting, forging or reopening claims. |
| CMP-INV-026 | Reconstruct accepted job, commitments, entitlement and disposition from immutable canonical state and retained specs after restart/reorg. |
| CMP-INV-027 | Substitute scheduler without changing accepted terms, work IDs, beneficiary or authority. |
| CMP-INV-028 | Resource revision cannot broaden capabilities on already accepted job. |
| CMP-INV-029 | Replaced endpoint/manifest cannot mutate bound provider/resource/economics or divert results. |
| CMP-INV-030 | Complete a non-AI job through canonical ComputeMarket with AI contracts/services unavailable. |

## 5. Minimum funded end-to-end scenario suite

Run all scenarios against deployed registered CMP components and an authorized, registered Vault with real native-$420 value (testnet or controlled local chain); record tx hashes, state snapshots and event traces. Scenario A: funded single-partition non-AI success, accepted match, signed manifest, real worker receipt, independent verification, challenge-window finality, provider claim and payer remainder withdrawal; reconcile `deposit = paid provider + paid fees + refunded payer + still encumbered`, with zero encumbrance at terminal closeout. Scenario B: multi-partition replicated job, retry after failed receipt, objective verification and payment at most once per canonical unit under total cap. Scenario C: cancellation/expiry and incorrect result produce no unearned provider transfer and actually return the right payer's unused funds; execute concurrent jobs from unrelated payers in one Vault. Scenario D: partial verified entitlement and contested unit remain isolated; bound appeal closes and changes only authorized held amount; objective slash touches only separately authorized stake. Scenario E: 420AI request via its bounded adapter and a standalone non-AI request produce reconciled CMP/AI lifecycle and actual Vault movements. All scenarios must include negative unauthorized actor, receipt replay, wrong beneficiary, reorg/restart and audit-log/privacy assertions.

## 6. Closeout decision and next engineering work

**Current outcome: CMP-0.12 closeout criteria documented; production/operational closeout BLOCKED.** Priority implementation sequence: canonical IDs/auth/policy and registries; immutable matching/lifecycle; payer-segregated Vault adapter; isolated worker/receipts; verifier and entitlement finality; dispute/privacy; SDK and AI adapter; actual funded end-to-end and 30-invariant matrix. Do not invent passing tests or deployment evidence to fill empty cells. Keep PR #367 draft and unmerged while implementation gates are open. If a later decision is to merge *documentation only*, first explicitly retitle/scope that change as a nonoperational specification, independently reconcile latest `main` and rerun exact-head Docs and Integrated qualification; that documentation merge must not be described as runtime closeout.