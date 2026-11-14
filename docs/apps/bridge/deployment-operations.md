# 420Bridge deployment, initialization and recovery operations

**Authority:** BRIDGE-AUDIT-6 repository deployment specification  
**Canonical manifest:** `contracts/config/bridge/deployment-v1.json`  
**Live-chain deployment evidence:** not claimed here; BRIDGE-AUDIT-9

## Deployment boundary

420Bridge has one frozen Genesis predeploy, `VerifiedGateway420@0x0000000000000000000000000000000000000438`. All other Bridge contracts are ordinary independently deployed, ProtocolRegistry-resolved components. Historical candidate/reservation addresses are not deployment evidence and must not be treated as authority.

The canonical constructor identity for GenesisResident Bridge contracts is:

`(GovernanceTimelock@0x0429, ProtocolRegistry@0x0434, genesisConfigHash)`

The frozen global `genesisConfigHash` is `0x01aea63faef55d711e5f93e800b04702177874f4015375b659038ce991d20921`.

`VerifiedGateway420` adds a fourth verifier argument. Genesis materialization uses `address(0)`, which is an explicit fail-closed disabled state. Deposit/withdraw verification must revert until governance installs a nonzero code-bearing verifier.

## Ordered deployment

1. Materialize `VerifiedGateway420` at frozen `0x0438`.
2. Deploy `BridgeChainRegistry420`.
3. Deploy `BridgeAssetRegistry`.
4. Deploy `BridgeRouteRegistry`.
5. Deploy `BridgeRiskManager`.
6. Deploy `BridgeTransferRegistry`.
7. Deploy `BridgeAccountingRegistry`.
8. Deploy `GatewayRouter420`.
9. Deploy `CADCBridgeIntegration`.
10. Verify runtime bytecode and record each runtime code hash.
11. Register the frozen gateway plus all registry-resolved components through `ProtocolRegistry.registerComponent` as version 1.0.0 / ACTIVE.
12. Verify Registry resolution returns the exact deployed address and runtime code hash for every component before any route is enabled.

Deployment receipts determine nonfixed addresses. Do not substitute `0x0440`, `0x0441`, `0x0442`, `0x0444`, or any other historical candidate as if it were already deployed. `0x043c` is frozen for `ConsensusSystemCall420`; `GatewayRouter420@0x0443` is retired and forbidden.

## Initialization

Initialize only through GovernanceTimelock.

- Chains: load identities from `chain-identities-v1.json`. Local 420 stays inactive until the official network fingerprint is frozen.
- Assets: activate only canonical usable asset identities; otherwise keep APPROVED_INACTIVE.
- Adapters: `GatewayRouter420.setAdapter` only after `adapterId()` matches exactly and the production verifier dependencies are qualified.
- Routes: bind exact source/destination chain identity, canonical asset, adapter and verifier-config hash. Keep inactive until both chain identities are active.
- Risk: install both route and asset limits from `risk-limits.json`.
- Trust: trust only the deployed `GatewayRouter420` in `BridgeRiskManager` and `BridgeTransferRegistry`. Additional transfer lifecycle operators require an explicit governance decision.
- Accounting: establish qualified reconciliation evidence before movement. UNKNOWN or unhealthy reconciliation blocks new movement.
- CADC: configure only issuer-approved code-bearing CADC, Endpoint and OFT contracts and leave inactive until its security configuration is qualified.
- Frozen gateway: governance installs a code-bearing verifier before approving gateway assets or movement.
- Route directions are enabled last.

## Publication verification

For every Bridge component verify:

- implementation address has code;
- `componentId()` equals the manifest preimage hash;
- `protocolVersion()` is compatible with 1.0.0;
- Registry lifecycle is ACTIVE;
- Registry runtime code hash equals `EXTCODEHASH`;
- no retired/candidate address is substituted for a deployment output.

Registry publication creates discovery identity only. It does not grant custody, route eligibility, accounting health, operator status or adapter trust.

## Smoke checks

Before enabling a route:

1. read every Registry component and runtime hash;
2. confirm frozen gateway address is exactly `0x0438`;
3. confirm gateway verifier is nonzero/code-bearing only when deliberately activated;
4. confirm chain identities and route bindings are current;
5. confirm route and asset limits are nonzero only for intended routes/assets;
6. confirm router trust is exact;
7. confirm adapter ID/address match;
8. confirm accounting health is HEALTHY;
9. simulate inbound/outbound against the intended route;
10. verify paused/unhealthy/stale/replay paths fail closed.

## Rollback and recovery

Before activation, discard any candidate deployment whose constructor binding, runtime hash, Registry entry or initialization differs from the manifest. Do not patch around a bad deployment.

If a wrong component revision was published, governance corrects or deprecates it before activation. If adapter/verifier configuration is wrong, keep routes disabled and replace it through governance. If accounting is unhealthy, movement remains blocked until newer distinct evidence restores health. Source reorgs use the canonical lifecycle retry/reorg path; never manufacture a second payout identity.

After live testnet launch, preserve deployment receipts, addresses, runtime hashes, Registry publication transactions, route/adapter/verifier configuration transactions and smoke/recovery results under BRIDGE-AUDIT-9 evidence.
