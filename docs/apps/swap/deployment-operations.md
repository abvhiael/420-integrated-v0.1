# 420 Swap deployment and predeploy operations

## Scope

This runbook covers deterministic repository-side preparation for the four frozen 420 Swap system predeploys:

- `GenesisDEXFactory` — `0x000000000000000000000000000000000000042b`
- `PublicBatchAuction` — `0x000000000000000000000000000000000000042c`
- `TWAPOracle` — `0x000000000000000000000000000000000000042d`
- `ApprovedQuoteAssetRegistry` — `0x0000000000000000000000000000000000000439`

`CanonicalSwapExecutor420` and `CanonicalConstantProductPool420` are deployment components, not frozen-address predeploys. Their compiler artifacts are retained for provenance, but they must not be silently assigned new frozen addresses.

## Canonical constructor identities

All four frozen Swap contracts inherit `GenesisResidentAccess420` and therefore embed these immutable constructor identities:

- GovernanceTimelock: `0x0000000000000000000000000000000000000429`
- ProtocolRegistry: `0x0000000000000000000000000000000000000434`
- `genesisConfigHash`: one shared global Genesis configuration commitment

The first two values are already frozen by repository address authority.

The shared `genesisConfigHash` is not currently frozen by repository authority. SWAP-AUDIT-6 tooling therefore fails closed: it may retain compiler output, storage layout, immutable-reference locations and symbolic predeploy state, but it must not claim a final runtime code hash until global Genesis authority supplies a canonical bytes32 value.

## Reproduction

From repository root:

```bash
cd contracts
forge build \
  src/system/SystemAccess.sol \
  src/system/GenesisResidentAccess420.sol \
  src/swap/GenesisDEXFactory.sol \
  src/swap/PublicBatchAuction.sol \
  src/swap/TWAPOracle.sol \
  src/swap/ApprovedQuoteAssetRegistry.sol \
  src/swap/CanonicalSwapExecutor420.sol \
  src/swap/CanonicalConstantProductPool420.sol
cd ..

python3 scripts/generate-swap-audit-6-predeploy.py --write --print
python3 scripts/generate-swap-audit-6-predeploy.py --check
python3 scripts/verify-swap-audit-6-predeploy.py
```

The generator consumes compiler-emitted deployed bytecode, immutable-reference metadata and storage layout. It does not infer immutable offsets from Solidity source text.

## GenesisDEXFactory

The frozen factory is registration-only. Its Genesis predeploy begins with:

- `poolImplementation == address(0)`;
- no registered pools;
- empty mutable storage.

This is deliberate. No concrete canonical pool deployment address is frozen at this phase, and `CanonicalConstantProductPool420` embeds market-specific immutable values.

Before any canonical pool can be registered:

1. deploy and qualify a concrete canonical pool;
2. verify its token pair, executor, fee and runtime provenance;
3. governance calls `setPoolImplementation` with a code-bearing qualified reference;
4. only then may governance call `registerPool`.

The contract rejects registration while the implementation reference is unset.

## PublicBatchAuction

Genesis mutable state begins empty:

- no auctions;
- no quote bids;
- no claims;
- `reserved420 == 0`;
- reentrancy state clear.

Native public-distribution inventory is funded later from the qualified distribution path. Predeploy materialization does not mint or pre-credit auction inventory.

## TWAPOracle

Genesis mutable state begins empty:

- no market configuration;
- no baseline;
- no published observation;
- no source hash/window state.

Governance configures market policy after deployment. Checkpoints remain canonical-pool-derived.

## ApprovedQuoteAssetRegistry

Genesis mutable state begins empty:

- no approved quote assets;
- no canonical currency mapping.

Canonical quote activation is a later governance/configuration action and must be backed by the canonical asset/bridge path.

## Generated evidence

SWAP-AUDIT-6 retains:

- compiler artifacts under `contracts/artifacts/`;
- one predeploy-state record per frozen Swap predeploy;
- predeploy-plan bindings;
- deployment-manifest bindings;
- source blob provenance;
- compiler profile provenance;
- immutable-reference metadata;
- storage layout and explicit empty-storage root.

When the global `genesisConfigHash` remains unresolved, records must remain in the explicit blocked state and must not contain a final runtime code hash.

Once global Genesis authority freezes that bytes32 commitment, rerun the same generator. It will materialize the compiler-reported immutable references and produce the final runtime code hashes without changing frozen addresses or Swap semantics.

## Qualification boundary

SWAP-AUDIT-6 is repository/offline deterministic-predeploy qualification only.

It does not prove:

- live `eth_getCode` identity;
- ProtocolRegistry entries;
- Pay → Swap trusted-caller binding;
- PublicDistributionVault → auction live funding;
- Wallet/Exchange live execution;
- production-equivalent testnet behavior.

Those belong to SWAP-AUDIT-7 and SWAP-AUDIT-8.
