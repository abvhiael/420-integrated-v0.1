# 420 Wallet — W14.3 Live Testnet Qualification

## Purpose

W14.3 provides the executable qualification layer that proves a generated Wallet runtime configuration is actually bound to the intended live 420 testnet.

It does not fabricate public-testnet readiness. The qualifier is designed to fail until the W14.1/W14.2 prerequisites are genuinely satisfied.

## Qualifier

The implementation lives at:

`wallet/web/scripts/qualify-live-testnet.mjs`

The command is exposed as:

```bash
cd wallet/web
npm run qualify:testnet -- \
  --manifest ../../developer-hub/manifests/testnet.json \
  --inventory ../deployment-inventory.json \
  --runtime runtime-config.generated.json \
  --minimumBlockNumber 1 \
  --output ../../artifacts/wallet/w14.3-live-testnet.json
```

## What W14.3 verifies

Before making any network request, qualification requires:

- a valid Developer Hub manifest with environment exactly `testnet`;
- a W14.1 deployment inventory marked live-testnet ready;
- no remaining canonical-address conflicts;
- runtime chain ID equal to the selected manifest;
- runtime RPC, Explorer and Faucet bindings equal to the selected manifest;
- runtime EntryPoint, SmartAccountFactory, CapabilityRegistry, ProtocolRegistry, Names420 and Identity420 bindings equal to the deployment inventory;
- no authority record still marked pending or conflicted.

The live qualification then proves:

1. the RPC endpoint answers JSON-RPC correctly;
2. `eth_chainId` equals the selected manifest/runtime chain identity;
3. `eth_blockNumber` is at or above the operator-selected minimum height;
4. `eth_getCode` returns deployed bytecode for:
   - EntryPoint420;
   - SmartAccountFactory420;
   - CapabilityRegistry420;
   - ProtocolRegistry;
   - Names420;
   - Identity420;
5. the configured Explorer is reachable over HTTPS;
6. the configured Faucet is reachable over HTTPS.

A successful result is written as `420-wallet-live-testnet-qualification-v1` evidence.

## CI and evidence workflow

`.github/workflows/wallet-live-testnet.yml` is manual-only.

This is intentional. The repository does not currently contain the official public-testnet manifest or generated live Wallet runtime config, so ordinary PR CI must not pretend that live qualification can run.

Once those artifacts exist, the workflow accepts:

- official manifest path;
- generated runtime path;
- minimum acceptable block number.

It reruns W14.1 inventory verification and Wallet Web regression tests before performing live qualification, then uploads the resulting W14.3 evidence artifact.

## Offline regression coverage

`wallet/web/test/live-testnet-qualification.test.js` uses deterministic mocked network responses to qualify the verifier itself.

Coverage includes:

- successful chain, authority-code and service qualification;
- unresolved deployment inventory rejection;
- runtime/manifest chain mismatch;
- live RPC chain mismatch;
- missing canonical authority bytecode;
- insufficient block height;
- unreachable Explorer/Faucet.

## Current repository state

The W14.3 mechanism is implemented, but no claim of successful live-testnet qualification is made today.

The existing W14.1 blockers still apply:

- official public-testnet manifest missing;
- canonical Wallet anchor/system-address collision unresolved;
- EntryPoint420 production binding pending.

Therefore `liveTestnetReady` remains false until those prerequisites are fixed and the real W14.3 workflow passes against the published testnet.

## Hand-off to W14.4

W14.4 should extend the same live environment into browser-extension dApp qualification: provider injection, origin permissions, account approval, signing review, transaction submission and canonical SmartAccount state agreement across Web Wallet and Extension.
