# BET-5D.4 — Testnet-dependent acceptance and settlement qualification

**Dependency:** active 420 Integrated testnet, registered validator/asset contracts, and independent operational evidence reporters.
**Status:** deferred. None of these tasks is represented as passed by Foundry unit tests.

| ID | Dependency | Testnet evidence and acceptance gate |
| --- | --- | --- |
| BET-5D4-TN-01 | Active chain and custody asset | Deploy approved W420/$420-backed custody, cross-check vault balances with token and accounting ledgers across restarts, failures and finality |
| BET-5D4-TN-02 | Independent source providers | Bind separately operated reporter keys, establish licenses and origin attestations for fixture data and make collusion/withholding evidence reviewable |
| BET-5D4-TN-03 | Real fixture reporting | Validate official end-of-event finality, postponements, cancellations, corrections, conflicting provider data and late challenges against actual provider feeds |
| BET-5D4-TN-04 | Adjudication operation | Exercise notices, challenge windows, adjudicator independence, frozen claims, void decisions, unauthorized callbacks and no-double-close evidence |
| BET-5D4-TN-05 | Chain faults | Test key rotation/revocation, chain reorganizations, transaction replacement, nonce replay, stale quotes, RPC outage and settlement retries |
| BET-5D4-TN-06 | Economic stress | Prove multi-market and correlated-outcome risk bounds; reconcile funded stakes, open profit liabilities, operator reserves and treasury claims |
| BET-5D4-TN-07 | Launch gating | Audit authorized collateral tokens, identity and geographic restrictions, regulatory approvals, operator onboarding and user refund processes |

**Pre-testnet scope:** deterministic Solidity unit, adversarial and fuzz tests; exact-SHA CI; per-market funds invariants; audit findings. The prototype certifier requires agreement from two configured reporting addresses but it cannot demonstrate operational independence or independently prove external sporting facts. An appointed arbiter may uphold the report or void it. A dispute carries evidence but does not supply cryptographic data-provider proof.

**Do not grant production resolver capability or operate real-money wagering until all release dependencies are independently qualified.**

## Qualification boundary and evidence policy

The following tests are local deterministic qualification, **not independent operational verification**:
- Test vault balance conservation before/after funded admission, winner payouts, loser-to-collateral accounting, and claim withdrawals.
- Fuzz test stake-sized admission and timeout refunds against exact custody accounting.
- Confirm market profit exposure and reserved collateral agree for the isolated fixture market.

**Outstanding pre-testnet work (blocking complete adversarial qualification):**
- Malicious ERC20 **remaining** scenarios: missing-return, rebasing, asset substitution, callback permutations, withdrawal manipulation. False-return, fee-on-transfer and reentrant collateral callbacks now have dedicated adversarial fixtures, pending exact-SHA evidence.
- Multi-market same-token aggregate solvency and correlated exposure limits; bounded invariants cannot substitute for a shared risk model.
- Replay and finality tests with actual provider attestations and robust cryptographic provenance, challenge bonds, evidence availability, appeals and arbiter accountability.
- External security review and frozen exact-SHA acceptance evidence.

**Operational verification cannot be simulated:** independent source ownership, contractual rights, adjudicator operational independence, confirmed real-game outcomes, transaction-failure recovery on a deployed chain and legally required controls require external evidence. They remain testnet/operations dependencies and must not be reported as complete.

`BET-5D4-TN-01..07` are release gates, not discretionary suggestions. PR merge must not imply live-betting authorization.

## Aggregate solvency implementation (pre-testnet)

`SportsFundedTickets420` now records nominal per-token total liabilities, collateral, unresolved stakes and accrued player credits. Both funding and withdrawals compare observed ERC-20 balance with the entire token's expected aggregate liability, not merely one market. This prevents another market sharing the same asset from silently subsidizing a shortfall and rejects negative or positive rebase drift. Multi-market collateral isolation and fuzzed accounting conservation tests were added. Rebased funds are deliberately fail-closed, including withdrawal; operational asset allowlisting and recovery policy still require review. These aggregate invariants cover nominal deposits and liabilities; cross-market correlated payouts and independently verified oracle outcomes remain a separate economic-risk and testnet qualification gate.

## BET-5D6 — Oracle-gated settlement and real-provider acceptance (additional gates)

These items supplement—not supersede—BET-5D4-TN-01..07. Contract and tooling pretestnet evidence is documented in `BET-5D6-PRETESTNET-HARDENING.md`. All items below require explicit independently verifiable live or external records before production.

| ID | Live/external dependency | Required acceptance proof |
| --- | --- | --- |
| BET-5D6-TN-01 | Approved fresh vault and Oracle gate on running chain | Exact chain ID, deployment transactions, runtime bytecode hashes, constructor dependencies and immutable market binding; irreversible Oracle-only fuse activated before any wagers |
| BET-5D6-TN-02 | Production capability registry | Prove Oracle gate exclusively resolves each market; demonstrate that previously authorized operator and legacy resolver principals cannot bypass it even with stale grants; record revocation transactions and governance evidence |
| BET-5D6-TN-03 | Live canonical result feeds | Confirm feed identity, FEED_OUTCOME/QUORUM_EQUAL mode, heartbeat, quorum, confidence, risk circuit breaker and safe restart; record provider and source epoch evidence |
| BET-5D6-TN-04 | Separate independent sports reporting organizations | Licensed original evidence, beneficial ownership and key custody proof; independently approved adjudicator and documented revocation/rotation procedure |
| BET-5D6-TN-05 | Live reorgs, outages and events | Disagreement, withheld data, late corrections, cancellation, abandonment, staleness, chain reorganization and transaction retry evidence with no unauthorized payout or lost refund |
| BET-5D6-TN-06 | Live correlated markets and custody | Same-event cross-market liability conservation, collateral balances, grouped cap enforcement, payout/refund idempotence and chain-finalized accounting after restart |
| BET-5D6-TN-07 | Independent deployment and regulatory review | Completed audits, vulnerability disposition, approved operator/territory restrictions, signed manifest, external acceptance and release authorization |

The prelaunch manifest intentionally contains unresolved addresses and code hashes. Its production verifier must reject incomplete configuration, and its success is never evidence of publisher independence or legal authorization by itself. Do not represent these tasks as complete before a deployed chain and authorized independent counterparties provide the evidence.
