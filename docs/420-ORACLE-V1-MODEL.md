# 420Oracle V1 — Frozen Genesis Model

Status: **FROZEN FOR IMPLEMENTATION**

## Purpose
420Oracle is the provider-neutral external-data interface for 420 Integrated. It standardizes provider registration, feed identity, source authorization, observation freshness, confidence, quorum/aggregation, replay protection, source/configuration epochs, deviation controls, circuit breakers, adapter boundaries, and fail-closed reads. No single vendor is protocol-canonical.

## V1 boundary
420Oracle V1 consists of:
- `OracleIds420.sol` — canonical service/feed/aggregation/source identifiers.
- `OracleProviderRegistry420.sol` — governance-curated provider identity and narrow reporting operator authority.
- `OracleFeedRegistry420.sol` — canonical feed definitions, heartbeat/freshness policy, aggregation policy, revisions, and bounded source sets/epochs.
- `OracleRiskPolicy420.sol` — per-feed minimum-confidence, maximum-deviation, and circuit-breaker policy.
- `OracleRouter420.sol` — replay-safe observation intake and deterministic fail-closed aggregation implementing `IOracle420`.
- `IOracle420.sol` — canonical consumer read interface and conservative read metadata.
- `IOracleSourceAdapter420.sol` — read-only normalization boundary for TWAP/external oracle sources.
- `TWAPOracleSourceAdapter420.sol` — read-only adapter for the existing Swap TWAP oracle.
- `IRandomnessRouter420.sol` — separate generalized-randomness interface boundary.

The existing Swap `TWAPOracle` remains Swap-specific. The adapter converts its Q96 numeric value into 18-decimal fixed-point output and reports confidence `0` because the TWAP source does not itself expose an explicit confidence metric. A consuming feed may therefore require stronger confidence or combine the TWAP with other sources.

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

Canonical numeric reads also return conservative source confidence and source spread metadata. Canonical exact-result reads return conservative confidence across the agreeing quorum.

## Freshness and epochs
Every feed has a nonzero heartbeat. An observation is usable only when:
- its provider remains active,
- the provider remains an active source for the feed,
- its timestamp is not in the future,
- it is no older than the feed heartbeat,
- its captured feed revision equals the current feed revision,
- its captured provider epoch equals the current provider epoch,
- its captured source epoch equals the current source epoch.

Feed reconfiguration increments the feed revision. Provider reactivation increments the provider epoch. Source reactivation increments the source epoch. Prior observations cannot become canonical again merely because an authority or source is re-enabled.

A read reverts when fewer than `minSources` eligible observations exist.

## Confidence, deviation, and circuit breakers
A configured `OracleRiskPolicy420` may require a minimum observation confidence. Observations below that threshold do not satisfy canonical quorum.

For numeric feeds, the router computes conservative spread between the lowest and highest eligible observations relative to the median. When a configured nonzero `maxDeviationBps` is exceeded, the canonical read fails closed.

Governance may halt an individual feed through the risk policy. A halted feed rejects canonical reads without deleting historical observations. Clearing the halt restores reads only if all other freshness, epoch, confidence, deviation, and quorum requirements still pass.

## Authority
Provider operators have only submission authority for feeds on which governance explicitly activates them as sources. Provider registration does not grant custody, governance, bridge, validator, settlement, token-transfer, or arbitrary execution authority.

Governance controls provider/feed/source/risk configuration through the existing governance timelock authority. No hidden owner or unrestricted emergency operator is introduced.

## Replay and ordering
Every accepted observation has a globally unique nonzero `observationId`. Reuse is rejected. A provider cannot replace its feed observation with an equal or older timestamp.

## Adapter boundary
Adapters are read-only normalization surfaces. They do not automatically become canonical providers and gain no custody, settlement, governance, bridge, validator, or arbitrary execution authority. Governance must still explicitly bind an authorized provider/source path before adapter-derived data can contribute to a canonical read.

External vendors such as Chainlink are therefore adapters/providers behind 420Oracle rather than protocol-canonical dependencies.

## Bounded execution
A feed may contain at most 16 configured sources in V1. This bounds on-chain aggregation cost and prevents governance from creating unbounded read loops.

## Consumer rule
A consuming contract must use the canonical `IOracle420` read interface and treat successful `OracleRouter420` output—not a submitted provider transaction—as the canonical V1 oracle read. Consumers must fail closed on router reverts unless their own frozen specification explicitly defines another safe fallback.

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
- `ORACLE-INV-013` Feed/provider/source reactivation cannot resurrect observations from a prior authority/configuration epoch.
- `ORACLE-INV-014` Configured minimum-confidence policy is enforced before quorum is accepted.
- `ORACLE-INV-015` Configured numeric deviation limits fail closed.
- `ORACLE-INV-016` A feed circuit breaker halts canonical reads without mutating historical observations.
- `ORACLE-INV-017` Oracle adapters are read-only normalization boundaries and are never canonical merely by deployment.
- `ORACLE-INV-018` Randomness requests/results use the separate randomness-router interface and cannot be inferred from ordinary feed aggregation.

## Genesis addressing
This package does not allocate a new reserved system address. The existing system-address range remains frozen through `0x043c`. 420Oracle services are discoverable through ProtocolRegistry and the Genesis dApp/service map until an explicit deterministic-address allocation decision is made.
