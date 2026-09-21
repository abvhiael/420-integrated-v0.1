# 420 Wallet — W14.4 Extension Live dApp Qualification

## Purpose

W14.4 qualifies the browser extension as a live dApp wallet on the same testnet runtime established by W14.3.

The phase does not merely confirm that the extension package builds. It verifies that the extension's provider, origin permission boundary, account exposure, approval surface, local signing authority and SmartAccount transaction path remain consistent with the canonical Wallet runtime and live testnet.

## Implementation

The qualifier lives at:

`wallet/extension/scripts/qualify-live-dapp.mjs`

It consumes:

- the official testnet network manifest;
- the W14.1 deployment inventory;
- the generated W14.2 Wallet runtime config;
- a live extension config;
- the packaged extension provider/approval/authority sources.

The resulting evidence schema is:

`420-wallet-extension-live-dapp-qualification-v1`

## Extension config contract

The live extension config uses schema:

`420-wallet-extension-live-config-v1`

It must identify:

- environment `testnet`;
- the exact same RPC URL as the generated Wallet runtime;
- one or more locally available controller accounts;
- SmartAccountFactory420;
- EntryPoint420;
- CapabilityRegistry420;
- recovery authority and salt needed by SmartAccount discovery.

The extension config may not silently drift from the Web Wallet runtime.

## What W14.4 qualifies

The static/provider surface requires:

- EIP-1193 provider injection;
- EIP-6963 announcement support;
- `eth_requestAccounts` approval;
- origin-scoped `eth_accounts`;
- top-frame origin verification;
- `accountsChanged` propagation;
- explicit user review for transaction and signing requests;
- no direct RPC fallback for sensitive signing authority;
- local SmartAccount/passkey transaction authority;
- UserOperation submission and receipt polling.

The live path additionally reuses W14.3 to verify:

- selected testnet identity;
- live RPC chain ID;
- minimum block height;
- deployed Wallet authority bytecode;
- Explorer and Faucet reachability.

W14.4 then independently confirms the extension RPC reports the same chain ID as the generated Wallet runtime.

## Manual evidence workflow

`.github/workflows/wallet-extension-live-dapp.yml` is manual-only.

It accepts paths to:

- the official testnet manifest;
- the generated Wallet runtime config;
- the live extension config;
- a minimum acceptable block height.

It reruns extension release qualification and the full Wallet Web regression suite before producing W14.4 evidence.

## Offline regression coverage

`wallet/web/test/extension-live-dapp-qualification.test.js` covers:

- runtime/extension authority agreement;
- provider injection and approval surface qualification;
- successful live-dApp qualification using deterministic RPC fixtures;
- extension RPC drift;
- EntryPoint authority drift;
- missing account-approval surface;
- live chain-ID disagreement.

## Current state

The W14.4 mechanism is implemented, but it cannot produce real public-testnet evidence until the existing W14.1/W14.3 blockers are cleared and a real live extension configuration exists.

This phase therefore distinguishes between:

1. qualifier implementation complete; and
2. live public-testnet evidence complete.

The second condition remains blocked by the unpublished testnet and unresolved canonical address/EntryPoint deployment conditions.

## Hand-off to W14.5

W14.5 should reconcile the Wallet application catalogue with the actual Genesis application set and verified service-discovery manifest so the Wallet no longer exposes a stale subset of ecosystem applications.
