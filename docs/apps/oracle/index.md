# 420Oracle / Oracle Interface Layer

420Oracle is the provider-neutral external-data protocol for 420 Integrated. It accepts observations from explicitly authorized providers, applies feed freshness, epoch, quorum, confidence, deviation, and circuit-breaker policy, and exposes canonical reads through `contracts/src/interfaces/IOracle420.sol`.

## Runtime components

- `OracleProviderRegistry420` — provider identity and reporting-operator authority.
- `OracleFeedRegistry420` — feed metadata, heartbeat, aggregation mode, bounded source membership, feed revisions, and source epochs.
- `OracleRiskPolicy420` — minimum confidence, maximum deviation, and per-feed halt policy.
- `OracleRouter420` — replay-safe observation intake and deterministic canonical reads.
- `IOracle420` — runtime consumer ABI: `readNumeric` and `readResult`.
- `IOracleSourceAdapter420` — read-only normalization boundary.
- `TWAPOracleSourceAdapter420` — read-only adapter for the canonical Swap TWAP.
- `IRandomnessRouter420` — separate randomness boundary; ordinary Oracle feeds never synthesize generalized randomness.

The protocol has no user-facing frontend and does not require an indexer or database for correctness. Provider submission infrastructure is off-chain operator infrastructure and is deliberately outside canonical chain authority.

## Trust and authority

Governance configures providers, feeds, source membership, and risk policy. Providers receive reporting-only authority for feeds on which they are active sources. They receive no custody, governance, bridge, validator, settlement, token-transfer, or arbitrary-call authority.

Canonical consumers use successful `OracleRouter420` output, not raw provider transactions. Reads fail closed when the feed is inactive, data is stale, epochs are obsolete, quorum is insufficient, confidence policy is not satisfied, the feed is halted, or numeric spread exceeds configured limits.

## Discovery and addressing

The canonical service ID is `420/service/oracle/v1`. The Oracle router is registry-resolved through `ProtocolRegistry`; there is no fixed Oracle Genesis address. Deployment order and post-deployment requirements are recorded in `contracts/config/420oracle-genesis.json`.

## Interface compatibility note

The repository also retains `contracts/src/interfaces/genesis/IOracle420.sol`, a frozen Genesis interface-layer v1.0 artifact with an older `price/isFresh/isSafe` ABI. It is not ABI-compatible with the runtime Oracle V1 router. The frozen file is retained because the interface-layer policy requires a major-version migration for semantic changes. Runtime Oracle code must import `contracts/src/interfaces/IOracle420.sol`; it must not silently substitute the legacy frozen ABI.

## Build and test

From `contracts/`:

```bash
forge build src/oracle src/interfaces/IOracle420.sol src/interfaces/IOracleSourceAdapter420.sol src/interfaces/IRandomnessRouter420.sol
forge test --match-path 'test/Oracle420*.t.sol' -vvv
```

Repository-model verification:

```bash
python3 scripts/verify-420oracle-audit.py
python3 scripts/verify-genesis-interface-layer.py
```

## Deployment

1. Resolve the canonical governance timelock and ProtocolRegistry.
2. Deploy provider registry.
3. Deploy feed registry bound to the provider registry.
4. Deploy risk policy.
5. Deploy router bound to provider registry, feed registry, and risk policy.
6. Optionally deploy approved read-only source adapters.
7. Publish the router under `420/service/oracle/v1` through ProtocolRegistry with code/interface/dependency commitments.
8. Configure providers, feeds, sources, and risk policies through governance.
9. Submit fresh test observations and execute canonical read smoke tests.
10. Retain deployment addresses, code hashes, registry publication transaction, configuration decisions, and exact-head qualification evidence.

Live provider credentials, provider/feed policy, chain deployment addresses, and production monitoring are environment-specific and must not be invented in repository configuration.
