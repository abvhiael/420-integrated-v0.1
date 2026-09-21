# Genesis address authority reconciliation (main-only)

Base: `main` at `1fea2ae8a68c6f4eb1b7aec9a0ffd1bb4e4f745e`. This is a separate change from AI-RECOVERY. No deployment or governance approval is implied.

## Authority and classification

`contracts/config/system-addresses.json` and its duplicate at `config/system-addresses.json` freeze the Step 6.2 system predeploy owners at 0x0420–0x043c. The entire 0x0420–0x04ff range is reserved for governed system allocations, not an automatically free extension. `0x041f` remains an unverified EntryPoint candidate. Genesis predeploy addresses cannot be assigned to another contract by an application address list, Wallet manifest or optional bridge candidate.

`contracts/config/genesis-canonical-addresses.json` on the base branch contains a second set of conflicting fixed owners for 0x0420–0x043b. Frozen owners control; the canonical record must be reconciled to them. Only an already frozen Step 6.2 owner can be listed as a fixed anchor. Ordinary routers, implementations, templates, Wallet factory/capability authority and other apps require independently deployed, verified addresses and governance-authorized `ProtocolRegistry` registration, not new implicit Genesis predeploy claims.

## Explicit collisions and disposition

- 0x0420 SmartAccountFactory vs frozen RewardController: RewardController retains 0x0420; Wallet factory becomes an unverified registry-resolved candidate.
- 0x0421 CapabilityRegistry vs frozen AttentionTreasury: AttentionTreasury retains 0x0421; Wallet capability authority becomes an unverified candidate.
- 0x0422 ProtocolRegistry vs frozen DevelopmentTreasury: ProtocolRegistry remains frozen at 0x0434.
- 0x0424 Identity420 vs frozen ProtocolReserve: Identity420 remains frozen at 0x0436.
- 0x0425–0x043b second app/router assignments conflict with Step 6.2, including frozen AIProviderRegistry 0x042f, AIModelRegistry 0x0430, AIJobManager 0x0431, AIJobEscrow 0x0432 and AIReputationRegistry 0x0433. They must not overwrite the frozen owners; the app/router entries are registry-resolved unless they refer to the exact same frozen owner.
- 0x0445 second Names420 reservation vs frozen Names420 0x0435: retire the duplicate, retain historical record as nondeployable.
- 0x043c BridgeAssetRegistry candidate vs frozen ConsensusSystemCall420: retire 0x043c bridge proposal; do not move consensus system calls. A replacement bridge candidate requires complete cross-register collision checks and separate approval.
- 0x0443 GatewayRouter420 bridge candidate is not a second fixed authority: retire fixed-address proposal; discover the independently deployed router through ProtocolRegistry.
- 0x0446/0x0447 Wallet factory and capability candidates are unverified proposals, not live or frozen. Do not reuse retired duplicate 0x0448/0x0449 registry/identity proposals.

## Release gate

Inspect Genesis predeploy generation and runtime code hashes before setting any address `DEPLOYED`, `VERIFIED` or `GENESIS_APPROVED`. Registry publication requires an actual deployment receipt, chain/environment identity, runtime codehash evidence and an authorized governance registration. Until then, keep Wallet live-testnet status and paid-AI/privileged browser writes disabled. This document does not itself approve any candidate address or change the existing predeploy manifest.
