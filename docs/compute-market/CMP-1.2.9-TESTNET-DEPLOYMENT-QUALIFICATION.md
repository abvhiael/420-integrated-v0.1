# CMP-1.2.9 — Testnet deployment and live-chain qualification

Status: **REPOSITORY DEPLOYMENT PACKAGE COMPLETE; LIVE QUALIFICATION BLOCKED**.

This gate is intentionally not marked COMPLETE. CMP-1.2.9 requires actual network deployment evidence, not repository-local Foundry fixtures.

## Repository-controlled work completed

The branch now contains the deployment/discovery material required to perform the live gate without inventing a second custody or execution surface:

- `contracts/src/compute/ICompute420.sol` — read-only ComputeMarket discovery interface.
- `contracts/src/compute/ComputeRouter420.sol` — immutable, non-custodial discovery anchor for the qualified component graph. It cannot proxy arbitrary calls, move funds, mutate jobs, grant authority, select verifiers or resolve disputes.
- `contracts/test/ComputeRouter420.t.sol` — proves component-address immutability, deterministic component graph hash, no arbitrary execution surface, rejection of zero/EOA components, canonical `COMPUTE_MARKET` service identity and Genesis-grade `ProtocolRegistry.publishRegisteredService` publication with runtime `extcodehash`.
- `contracts/config/compute-market/cmp-1.2.9-testnet-deployment-evidence.json` — fail-closed live evidence manifest covering network identity, every deployed component, transaction/block/runtime hashes, grant inventory, router graph, Registry publication and live native-$420 economic transcripts.
- `scripts/verify-cmp-1-2-9-deployment.py` — validates the canonical service ID, ProtocolRegistry address/publication path, source graph and all live evidence. Default mode fails until live qualification is real; `--repository-ready` verifies only repository-controlled readiness.

The qualified economic implementation through CMP-1.2.8 remains the fixed-price, single-assignment native-$420 path. The discovery router adds no economic authority.

## Canonical discovery

Service ID:

`keccak256("420/service/compute-market/v1")`

Authority source:

`contracts/src/libraries/ServiceIds420.sol`

Canonical ProtocolRegistry source:

`contracts/src/apps/ProtocolRegistry.sol`

Frozen ProtocolRegistry address expected by the current canonical address authority:

`0x0000000000000000000000000000000000000434`

The live Registry publication must point to the deployed `ComputeRouter420`, whose committed `componentGraphHash` binds the actual underlying CMP graph. Registry publication is discovery only and grants no custody or execution authority.

## Current hard blocker

Repository network authority currently states the public testnet is not live:

- `config/protocol.json`: `step5.substep_5_4.public_testnet_live = false`.
- `STEP5.4-SUMMARY.json`: `public_testnet_live = false`, `real_public_endpoints_configured = false`.
- `testnet/public/publication-checklist.json`: `public_testnet_live = false`.

Therefore no truthful live CMP deployment can currently provide canonical public-testnet:

- chain/RPC identity and finalized block evidence;
- deployment addresses and transaction hashes;
- deployment blocks and verified runtime code hashes;
- live dedicated CMP Vault registration and ACTIVE state;
- sealed `CMPVaultAuthorization420` bindings;
- exact shared capability-grant IDs/scopes/limits/active status;
- deployed router component graph hash;
- governance-authorized `ProtocolRegistry` publication transaction/version;
- real payer funding transaction;
- real provider payout transaction;
- real residual payer refund;
- real failed-job refund;
- real cancelled-job refund;
- real dispute-resolution refund.

Synthetic/local values must not be written into the live evidence manifest.

## Live execution gate

When a canonical testnet is live:

1. deploy/bind the qualified CMP graph and dedicated Vault topology against the exact network/chain;
2. independently record every deployment address, transaction hash, block and runtime code hash;
3. verify all immutable bindings and the router graph against the manifest;
4. inventory the exact capability grants and prove hostile grant expansion remains denied;
5. publish the router under canonical `COMPUTE_MARKET` through governance-authorized `ProtocolRegistry.publishRegisteredService`;
6. execute native-$420 success, failed-verification refund, pre-execution cancellation refund and dispute payer-win refund paths on-chain;
7. reconcile events with actual Vault/account balances and terminal job/obligation state;
8. populate the evidence manifest solely from canonical chain evidence;
9. run:

`python3 scripts/verify-cmp-1-2-9-deployment.py`

The command must exit zero in default/live mode. `--repository-ready` is insufficient for CMP-1.2.9 COMPLETE.

## Disposition

**Repository deployment readiness: complete, subject to exact-head CI.**

**Live testnet qualification: BLOCKED by network availability.**

CMP-1.2.9 must remain BLOCKED until the public/authorized testnet exists and the live evidence verifier passes. Consequently CMP-1.2.10 final phase closeout cannot truthfully mark CMP-1.2 complete yet.
