# 420Oracle V1 — Frozen Genesis Model

Status: **FROZEN FOR IMPLEMENTATION**

## Purpose
420Oracle is the provider-neutral external-data interface for 420 Integrated. It standardizes provider registration, feed identity, source authorization, observation freshness, quorum/aggregation, replay protection, and fail-closed reads. No single vendor is protocol-canonical.

## V1 boundary
420Oracle V1 consists of:
- `OracleIds420.sol` — canonical service/feed/aggregation identifiers.
- `OracleProviderRegistry420.sol` — governance-curated provider identity and narrow reporting operator authority.
- `OracleFeedRegistry420.sol` — canonical feed definitions, heartbeat/freshness policy, aggregation policy, and bounded source sets.
- `OracleRouter420.sol` — replay-safe observation intake and deterministic fail-closed aggregation.

The existing Swap `TWAPOracle` remains Swap-specific. It may become a source/adapter for 420Oracle feeds but is not the general oracle protocol.

## Data classes
V1 recognizes these canonical classes:
- `420/ORACLE/FEED/PRICE/V1`
- `420/ORACLE/FEED/PROOF_OF_RESERVE/V1`
- `420/ORACLE/FEED/OUTCOME/V1`
- `420/ORACLE/FEED/EXTERNAL_API/V1`
- `420/ORACLE/FEED/AUTOMATION/V1`
- `420/ORACLE/FEED/COMPUTATION/V1`

Randomness is deliberately **not** synthesized through ordinary feed aggregation. `420/ORACLE/SERVICE/RANDOMNESS_ROUTER/V1` is reserved for the generalized randomness interface, which may route native threshold/VRF, commit-reveal, or approved external VRF providers under randomness-specific replay/fallback rules.

## Aggregation
V1 supports:
1. `MEDIAN_NUMERIC` — deterministic median over fresh authorized numeric observations. For even source counts, the upper middle observation is returned after sorting.
2. `QUORUM_EQUAL` — exact `bytes32` result agreement from at least the configured minimum number of fresh authorized sources. If two distinct results independently satisfy quorum, the read fails closed as ambiguous.

## Freshness
Every feed has a nonzero heartbeat. An observation is usable only when:
- its provider remains active,
- the provider remains an active source for the feed,
- its timestamp is not in the future,
- it is no older than the feed heartbeat.

A read reverts when fewer than `minSources` fresh authorized observations exist.

## Authority
Provider operators have only submission authority for feeds on which governance explicitly activates them as sources. Provider registration does not grant custody, governance, bridge, validator, settlement, token-transfer, or arbitrary execution authority.

Governance controls provider/feed/source configuration through the existing governance timelock authority. No hidden owner or emergency operator is introduced.

## Replay and ordering
Every accepted observation has a globally unique nonzero `observationId`. Reuse is rejected. A provider cannot replace its feed observation with an equal or older timestamp.

## Bounded execution
A feed may contain at most 16 configured sources in V1. This bounds on-chain aggregation cost and prevents governance from creating unbounded read loops.

## Consumer rule
A consuming contract must treat successful `OracleRouter420` output—not a submitted provider transaction—as the canonical V1 oracle read. Consumers must fail closed on router reverts unless their own frozen specification explicitly defines another safe fallback.

## V1 invariants
- `ORACLE-INV-001` Provider authority is feed-scoped and reporting-only.
- `ORACLE-INV-002` No inactive provider contributes to a canonical read.
- `ORACLE-INV-003` No inactive feed produces a canonical read.
- `ORACLE-INV-004` No stale observation contributes to a canonical read.
- `ORACLE-INV-005` A canonical read requires configured quorum.
- `ORACLE-INV-006` Observation IDs cannot be replayed.
- `ORACLE-INV-007` Provider observations are monotonically timestamped per feed.
- `ORACLE-INV-008` Numeric aggregation is deterministic.
- `ORACLE-INV-009` Conflicting exact-result quorums fail closed.
- `ORACLE-INV-010` Source enumeration is bounded to 16.
- `ORACLE-INV-011` Ordinary oracle feeds never act as a randomness generator.
- `ORACLE-INV-012` 420Oracle never takes custody of user funds or canonical assets.

## Genesis addressing
This package does not allocate a new reserved system address. The existing system-address range remains frozen through `0x043c`. 420Oracle services are discoverable through ProtocolRegistry and the Genesis dApp/service map until an explicit deterministic-address allocation decision is made.
