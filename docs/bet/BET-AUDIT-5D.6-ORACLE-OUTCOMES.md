# 420Bet 5D.6 — Verified sports outcomes through Oracle Interface Layer

## Source of truth
Canonical `contracts/src/interfaces/IOracle420.sol` provides `readResult(feedId)` with `resultHash`, `updatedAt`, `agreeingSources` and `confidenceBps`. The production `OracleRouter420` owns provider authorization, feed mode, risk policy and freshness. `SportsOutcomeCertification420` owns two attesters, challenge period and adjudicator dispute/void outcome. Neither surface alone proves the other.

## Bounded integration
`SportsOracleOutcomeGate420` requires both FINAL certification and an oracle read with the configured minimum quorum, minimum confidence and maximum age. Feed identifiers are derived from the market ID. The result commitment is domain-separated by chain ID, market registry, market ID, selected winner and certification evidence. The same transaction calls the existing `SportsFundedTickets420.resolve`, which enforces funded status, authenticated settlement authority, market cutoff, event lifecycle, selection match and existing accounting invariants. All failed verification reverts without changing the ticket.

**Critical deployment dependency:** The gate is secure only if the gate is the **sole principal** with the vault's `BET_SPORT_TICKET_RESOLVE` capability for each protected market. A preexisting direct resolver grant bypasses the oracle and must be revoked before production enablement. This repository's current vault is not globally forced to use the gate; no claim of universal mandatory oracle enforcement is made. Since the adapter does not itself establish full source-provider organizational independence, real oracle feed registration/verification remains an operational release prerequisite.

Canonical feeds must be configured for `AGGREGATION_QUORUM_EQUAL`, with each observation hash equal to the exact `commitment(marketId,selection,evidence)` value. Fee/value price or generic numeric feeds are not sports outcome feeds.

## Level 1 bounded qualification
`.github/workflows/420bet-sports-5d6.yml` runs `SportsOracleOutcomeGate420Test` with inherited funded-ticket tests. New tests exercise correct result payouts, stale/orphan feed rejection, insufficient quorum, low confidence, cross-market replay, halted feeds, repeat settlement and invalid constructor. The oracle fixture is local and **does not** establish deployed oracle-source integrity.

## Testnet / external prerequisites
- Independently controlled and appropriately authorized publishers and data provenance for sports events.
- Live 420Oracle router/feed registration, mode and risk-policy correctness, observations with required source count and confidence.
- Demonstrable revocation of every direct vault resolver grant except the oracle gate, with deployment manifest binding exact gate/router/feed addresses and code hashes.
- Event-specific finality, challenge/appeal evidence, outages, cancellations and late sports revisions.
- Real token, chain, compliance and independent security audit certification.

These remain release gates under `docs/bet/BET-5D4-TESTNET-ROADMAP.md`; no simulated oracle test satisfies them. Roadmap discovery by repository code search did not locate the exact 5D.6 original exit matrix; do not imply this narrower implementation supersedes it.
