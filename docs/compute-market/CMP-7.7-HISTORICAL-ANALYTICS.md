# CMP-7.7 — Historical analytics

Status: **IMPLEMENTED — Level 1 exact-head qualification pending.**

## Canonical purpose

Provide bounded historical Compute analytics from canonical indexed event history without creating a scoring, correctness, payout or accounting authority.

## Requirements

- explicit chain and block range;
- bounded query range;
- canonical event ordering;
- unique job/reward identities with duplicate reward rejection;
- latest in-range job terminal-state accounting;
- policy-defined contribution/reward totals by metric;
- uint256-safe accumulation;
- explicit `authoritative:false` result.

## Implementation

`computeHistoricalAnalytics420` aggregates job creation/terminal state and `UsefulRewardAccounted` evidence over the canonical 420Indexer protocol-event journal. It exposes counts and typed metric totals and rejects duplicate reward IDs rather than silently double counting.

## Qualification

Level 1 runs the affected 420Indexer build/test suite, including duplicate-reward, range-bound and malformed numeric-state negatives.

## Next canonical step

**CMP-7.8 — Developer documentation**
