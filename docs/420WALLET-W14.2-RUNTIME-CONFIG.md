# 420 Wallet — W14.2 Runtime Configuration Generator

## Purpose

W14.2 replaces manual Wallet network binding with deterministic runtime configuration generation.

The generator lives at:

`wallet/web/scripts/generate-runtime-config.mjs`

It consumes:

- an environment-scoped Developer Hub network manifest;
- the W14.1 Wallet deployment inventory;
- the currently qualified Wallet runtime feature profile.

It emits a `420-wallet-runtime-config-v1` document only when those sources agree.

## Command

From the repository root:

```bash
cd wallet/web
npm run generate:runtime -- \
  --manifest ../../../developer-hub/manifests/testnet.json \
  --inventory ../../deployment-inventory.json \
  --base runtime-config.json \
  --manifestUrl https://420integrated.org/manifests/testnet.json \
  --output runtime-config.generated.json
```

The official public-testnet manifest does not yet exist, so the command above is the target production workflow rather than a command that should succeed today.

## Fail-closed rules

For testnet/mainnet generation the generator requires:

- network-manifest environment to match the Wallet deployment inventory;
- manifest chain ID to match the inventory chain ID;
- the W14.1 inventory to report live-testnet readiness;
- all W14.1 live release gates to be true;
- no remaining canonical-address conflicts;
- EntryPoint, SmartAccountFactory, CapabilityRegistry, ProtocolRegistry, Names and Identity authority records to be valid and neither pending nor conflicted;
- HTTPS public RPC/Explorer/Faucet/manifest endpoints;
- Explorer and Faucet publication on testnet;
- no Faucet publication on mainnet.

The generator never promotes `developer-hub/manifests/local.example.json` into public testnet configuration.

## Generated bindings

A successful generation binds:

- network name;
- chain ID converted from canonical decimal manifest form to Wallet hexadecimal JSON-RPC form;
- primary RPC URL;
- Explorer URL;
- SmartAccountFactory address;
- EntryPoint address;
- CapabilityRegistry address;
- ProtocolRegistry address;
- Names420 address;
- Identity420 address;
- Faucet URL for testnet;
- verified/signed ecosystem-manifest URL.

Qualified Wallet feature flags are preserved from the base runtime profile rather than recomputed from deployment metadata.

## Current expected state

W14.2 is implemented, but live generation remains blocked by W14.1 conditions:

1. no official public-testnet manifest is checked in;
2. Wallet anchor addresses remain conflicted with the older frozen system-address allocation;
3. EntryPoint420 production bytecode binding remains pending.

The generator is supposed to reject this state.

## Qualification

`wallet/web/test/runtime-config-generator.test.js` covers:

- deterministic successful generation from fully qualified inputs;
- rejection of the repository's current unresolved W14.1 inventory;
- chain-ID drift;
- insecure public RPC endpoints;
- conflicted Wallet authority state;
- missing testnet Faucet publication.

Wallet Web static qualification also requires the W14.2 generator and its tests to remain present.

## Hand-off to W14.3

W14.3 should perform live-testnet Wallet qualification after network/address reconciliation is complete. It should use the W14.2 generator output rather than hand-edited runtime configuration.
