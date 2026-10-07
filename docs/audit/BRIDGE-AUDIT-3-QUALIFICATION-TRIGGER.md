# BRIDGE-AUDIT-3 qualification trigger

BRIDGE-AUDIT-3 requires exact-head Level 1 qualification of the canonical transfer lifecycle and outbound registration changes.

The primary audit branch is `audit/420bridge-complete-20261001`. The repository's Solidity PR workflow suppresses real PR Foundry shards for audit-named branches, so the neutral branch `qualification/bridge-a3-20261002` is qualification-only and must not be merged independently.

The neutral branch is pinned to the same exact implementation/evidence SHA as PR #463. Qualification requires:
- 420Bridge Fast Qualification;
- all four real Solidity PR shards;
- directly triggered Docs/Indexer/Genesis/Registry checks where applicable.

Skipped, cancelled, stale-SHA or wrapper-only results are not passing evidence.
