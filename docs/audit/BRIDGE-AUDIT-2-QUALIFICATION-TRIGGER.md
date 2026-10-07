# BRIDGE-AUDIT-2 qualification trigger

BRIDGE-AUDIT-2 requires exact-head Level 1 Solidity qualification.

The primary audit branch is `audit/420bridge-complete-20261001`. The repository's Solidity PR workflow intentionally suppresses real PR Foundry shards for branch names matching `audit/*` or containing `-audit-`. A green wrapper on that branch is therefore not sufficient qualification evidence.

The neutral branch `qualification/bridge-a2-20261002` is qualification-only and must not be merged independently. It is moved to the exact same implementation/evidence SHA as the primary Bridge audit branch so the four real Foundry PR shards execute against the same repository state.

Skipped, cancelled, missing or superseded shard results are not passing evidence.
