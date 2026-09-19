# AI-RECOVERY-2 — Genesis address authority reconciliation

Status: **IMPLEMENTED ON RECOVERY BRANCH — QUALIFICATION REQUIRED**

## Decision

The frozen Step 6.2 predeploy map in `contracts/config/system-addresses.json` is the sole physical Genesis address authority for the reserved `0x0420-0x043c` range.

The later `contracts/config/genesis-canonical-addresses.json` file is a discovery/authority catalogue. It may identify already-frozen Step 6.2 predeploys, but it may not allocate a second contract to an address already occupied by the Step 6.2 map.

Newer routers, factories, adapters and implementation contracts that were not assigned a Step 6.2 predeploy are discovered through `ProtocolRegistry` or another explicitly bound canonical object. They do not receive an implicit address merely because a newer architecture document names them as canonical.

## Preserved frozen AI identities

The following Native AI Genesis identities remain unchanged:

| Address | Contract |
| --- | --- |
| `0x...042f` | `AIProviderRegistry` |
| `0x...0430` | `AIModelRegistry` |
| `0x...0431` | `AIJobManager` |
| `0x...0432` | `AIJobEscrow` |
| `0x...0433` | `AIReputationRegistry` |

The mature `AIRouter420`, `AIComputeAdapter420`, ComputeMarket contracts and other newer AI/Compute modules remain registry-resolved implementations.

## Why the previous map was invalid

The later canonical-address file assigned `0x0420-0x043b` to a second, incompatible contract set. Examples included:

- `0x0420` as `SmartAccountFactory420`, conflicting with frozen `RewardController`;
- `0x0421` as `CapabilityRegistry420`, conflicting with frozen `AttentionTreasury`;
- `0x0430` as `AIRouter420`, conflicting with frozen `AIModelRegistry`;
- `0x0431` as `ResourceRouter420`, conflicting with frozen `AIJobManager`;
- `0x0432` as `ComputeRouter420`, conflicting with frozen `AIJobEscrow`;
- `0x0433` as `TreasuryRouter420`, conflicting with frozen `AIReputationRegistry`;
- `0x0434` as `VaultRouter420`, conflicting with frozen `ProtocolRegistry`.

The prior verifier checked duplicate addresses only inside the newer canonical-address file, so cross-manifest conflicts could pass.

## Verification rule added

`scripts/verify-genesis-canonical-addresses.py` now fails unless:

1. `contracts/config/system-addresses.json` is named as the authoritative predeploy map;
2. every frozen anchor in the canonical-address catalogue exactly matches the Step 6.2 assignment;
3. the deployment manifest and predeploy plan exactly match every Step 6.2 assignment;
4. every Native AI Genesis address matches system-addresses, deployment-manifest and predeploy-plan;
5. a registry-resolved implementation has no frozen Step 6.2 address;
6. the EntryPoint reservation remains `0x041f`;
7. the no-address-reuse and registry-resolution policies remain enabled.

This turns the prior documentation convention into a cross-file qualification gate.

## Wallet correction

The Wallet previously treated:

- `0x0420` as `SmartAccountFactory420`;
- `0x0421` as `CapabilityRegistry420`.

Those assumptions were incompatible with the Step 6.2 map.

The checked-in Wallet runtime now leaves `SmartAccountFactory420` unresolved until supplied through a qualified registry/signed-manifest runtime configuration.

Capability operations use the `capabilityRegistry` address returned by the deployed `SmartAccount420` binding and require deployed code rather than comparing it against the collided `0x0421` constant.

This preserves fail-closed behavior without inventing another predeploy address.

## Discovery model after reconciliation

### Frozen predeploys

Physical addresses come only from Step 6.2.

Examples include the Native AI compatibility contracts, ProtocolRegistry, Names, Identity, Governance, VerifiedGateway and Stake.

### Registry-resolved components

Examples include:

- SmartAccountFactory420
- CapabilityRegistry420
- AIRouter420
- AIComputeAdapter420
- ComputeRouter420 and the ComputeMarket suite
- ResourceRouter420
- PaymentRouter420
- SettlementRouter420
- TokenFactory420
- TreasuryRouter420
- VaultRouter420
- RightsRouter420
- LaunchpadRouter420
- GrantRouter420
- AttentionRouter420
- PulseRouter420
- MessengerRouter420
- CommonsRouter420

A registry-resolved component may be deployed normally and registered under its versioned protocol/component identity. It is not entitled to an address in the frozen system range.

## Follow-up

AI-RECOVERY-3 should build the operational 420AI provider/runtime layer after this address reconciliation qualifies:

1. provider daemon and signed runtime manifest;
2. GPU/model capability advertisement;
3. job polling/acceptance;
4. secure payload retrieval;
5. inference execution;
6. result/evidence submission;
7. health/SLA telemetry;
8. API/indexer projection for `ai.420integrated.org`;
9. testnet end-to-end qualification.
