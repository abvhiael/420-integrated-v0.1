# 420 Wallet — W14.1 Canonical Deployment Inventory

## Status

W14.1 establishes the single machine-readable Wallet deployment inventory at `wallet/deployment-inventory.json` and adds fail-closed qualification in `scripts/verify-wallet-w14-1.py`.

This phase does **not** declare the public testnet ready. It records the current canonical inputs and makes unresolved network/address conditions explicit blockers instead of allowing clients to infer or invent deployment values.

## Sources of truth

The Wallet inventory binds to:

- `contracts/config/420wallet-genesis.json` — Wallet architecture/profile.
- `contracts/config/genesis-canonical-addresses.json` — later Genesis canonical anchor freeze.
- `config/system-addresses.json` — earlier frozen system-address allocation that must be reconciled where it overlaps the later anchor freeze.
- `developer-hub/manifests/testnet.json` — required future official public-testnet manifest. This file is intentionally absent until the public testnet is actually published.

The local developer manifest at `developer-hub/manifests/local.example.json` is explicitly non-authoritative for testnet and MUST NOT be promoted into public Wallet configuration.

## Network identity

The architecture expects chain ID `420`, but chain ID alone is not sufficient proof of network identity.

W14.1 therefore leaves the following unset until an official testnet manifest exists:

- public HTTP RPC;
- public WebSocket RPC;
- Explorer URL;
- Faucet URL;
- ecosystem/service manifest URL.

Wallet runtime generation remains blocked until those values have one canonical environment-scoped source.

## Wallet authority anchors recorded

The later Genesis canonical-address registry currently records:

| Authority | Address | W14.1 state |
| --- | --- | --- |
| EntryPoint420 | `0x000000000000000000000000000000000000041f` | reserved; production implementation binding pending |
| SmartAccountFactory420 | `0x0000000000000000000000000000000000000420` | frozen but conflicted |
| CapabilityRegistry420 | `0x0000000000000000000000000000000000000421` | frozen but conflicted |
| ProtocolRegistry | `0x0000000000000000000000000000000000000422` | frozen but conflicted |
| Names420 | `0x0000000000000000000000000000000000000423` | frozen but conflicted |
| Identity420 | `0x0000000000000000000000000000000000000424` | frozen but conflicted |

These values are inventory records, not permission to deploy Wallet against them while the collision described below remains unresolved.

## Canonical-address collision discovered

W14.1 found a repository-level conflict that predates this phase.

The later `contracts/config/genesis-canonical-addresses.json` freeze assigns:

- `0x0420` → SmartAccountFactory420
- `0x0421` → CapabilityRegistry420
- `0x0422` → ProtocolRegistry
- `0x0423` → Names420
- `0x0424` → Identity420

The earlier frozen `config/system-addresses.json` assigns those same addresses to:

- `0x0420` → RewardController
- `0x0421` → AttentionTreasury
- `0x0422` → DevelopmentTreasury
- `0x0423` → ValidatorRegistry
- `0x0424` → ProtocolReserve

That earlier file also places ProtocolRegistry, Names420 and Identity420 at `0x0434`, `0x0435` and `0x0436`, respectively.

This is a real canonical-source conflict. W14.1 does not guess which historical allocation should win. The Wallet inventory records the later canonical-anchor file as its intended address source while marking every overlapping Wallet anchor `FROZEN_BUT_CONFLICTED` and requiring reconciliation before live testnet configuration can be generated.

## Qualification behavior

`scripts/verify-wallet-w14-1.py` fails if:

- the deployment inventory disappears or changes schema;
- a Wallet anchor drifts from the canonical-address registry;
- the EntryPoint reservation drifts;
- an existing address collision is hidden or mislabeled;
- an unresolved W14.1 release gate is marked complete without a later reconciliation change;
- a public endpoint is invented before an official testnet manifest exists;
- `contracts/config/420wallet-genesis.json` stops referencing the deployment inventory.

The verifier passes W14.1 when the inventory accurately represents the current blocked state. Its successful output therefore includes `readyForLiveTestnet: false`.

That is deliberate: phase completion means the deployment truth is inventoried and enforced, not that unresolved external/canonical blockers have vanished.

## CI integration

`.github/workflows/wallet-web.yml` now runs the W14.1 verifier when any of the following change:

- Wallet web source;
- Wallet deployment inventory;
- Wallet Genesis profile;
- canonical Genesis addresses;
- system addresses;
- Developer Hub manifests;
- the W14.1 verifier itself.

This prevents a future address/network change from bypassing Wallet qualification.

## W14.1 completion criteria

W14.1 is repository-complete when:

1. the deployment inventory exists;
2. the Wallet Genesis profile points to it;
3. known canonical-address conflicts are recorded;
4. missing public-testnet discovery data is explicit rather than guessed;
5. CI enforces the inventory;
6. Wallet Core regression remains green on the resulting branch.

## Hand-off to W14.2

W14.2 should build the runtime-configuration generator, but it must preserve W14.1's fail-closed behavior.

The generator should refuse to emit a public testnet Wallet runtime until:

- the canonical-address collision is reconciled;
- EntryPoint420 production bytecode is bound;
- an official testnet manifest exists;
- RPC chain identity is qualified;
- canonical Wallet authority contracts contain expected code;
- Explorer/Faucet/service discovery is published.

Only then should `wallet/web/runtime-config.json` be generated as a live testnet configuration.
