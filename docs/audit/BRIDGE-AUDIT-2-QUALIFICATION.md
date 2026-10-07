# BRIDGE-AUDIT-2 — Canonical chain identity qualification

**Status:** COMPLETE  
**Qualification level:** Level 1 step-specific  
**Qualified implementation SHA:** `fdb6c49217b0e9626c2de1f0664a20be2b90767a`  
**Audit branch / PR:** `audit/420bridge-complete-20261001` / PR #463  
**Qualification-only branch / PR:** `qualification/bridge-a2-20261002` / PR #467 — DO NOT MERGE  
**Main/base SHA at qualification:** `98e545225d54379086f0c520afcb84b4d4d97288`  
**Divergence at qualification:** 21 ahead / 0 behind

## Qualified outcome

BRIDGE-AUDIT-2 makes `BridgeChainRegistry420` authoritative to active Bridge route admission and execution.

- ACTIVE routes must resolve both source and destination `routeChainId` values to active canonical chain-registry identities.
- Activation snapshots source/destination chain keys and network fingerprints.
- `GatewayRouter420` revalidates the stored chain binding on inbound and outbound execution.
- Chain deactivation, route-ID rebinding or network-fingerprint drift makes an existing route fail closed until explicit reactivation.
- Exchange Bridge qualification rejects stale canonical route-chain bindings.
- `contracts/config/bridge/chain-identities-v1.json` inventories the external launch-catalog chain identities and keeps the local 420 testnet identity inactive until the canonical testnet genesis/network fingerprint is frozen.
- Adversarial coverage includes unknown and inactive chains, duplicate route IDs, rebinding, fork/testnet fingerprint drift, stale direction changes, and direction-specific routes.

## Exact-head Level 1 evidence

Required evidence was taken only from the exact implementation SHA above.

| Workflow | Run | Result |
| --- | ---: | --- |
| 420Bridge Fast Qualification | #2 / `36954236824` | PASS |
| Solidity Contracts | #3914 / `36954236897` | PASS |
| Solidity `pr-shards (0)` | job `110674516719` | PASS |
| Solidity `pr-shards (1)` | job `110674516727` | PASS |
| Solidity `pr-shards (2)` | job `110674516825` | PASS |
| Solidity `pr-shards (3)` | job `110674516717` | PASS |
| 420Docs Qualification | #4127 / `36954236896` | PASS |
| 420Indexer | #1531 / `36954236971` | PASS |
| Genesis Address Authority | #716 / `36954236876` | PASS |
| 420Registry REG-AUDIT-1 | #467 / `36954236858` | PASS |
| 420Registry REG-AUDIT-4 | #551 / `36954236992` | PASS |

The aggregate `foundry` job is intentionally skipped on pull requests and is not counted as evidence. Earlier wrapper runs whose real PR shards were skipped are superseded and are not qualification evidence.

## Exit decision

**BRIDGE-AUDIT-2 COMPLETE.**

No Level 2 or Level 3 suite is consumed by this step. Level 2 remains reserved for the BRIDGE-AUDIT-8 repository-side milestone and Level 3 for BRIDGE-AUDIT-10 final closeout.
