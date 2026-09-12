---
title: Testnet and Faucet
audience:
  - developer
category: developer
status: development
version: current
---

# Testnet and Faucet

Use testnet only through an official testnet network manifest. The repository currently contains a local example manifest but does not yet check in an official public testnet manifest, so this guide deliberately does not invent a testnet hostname, chain ID, RPC URL or Faucet URL.

When an official testnet deployment manifest is published, pass that exact manifest to the Developer Hub/CLI instead of editing the local example in place.

## 1. Confirm the environment

```bash
420 network --manifest <official-testnet-manifest>
```

Require all of the following before requesting funds:

- `environment` is exactly `testnet`;
- the selected manifest validates successfully;
- the selected RPC reports the expected network identity;
- Faucet capability is advertised for that testnet;
- the destination is an EVM address you control.

The Faucet client intentionally rejects local/devnet/mainnet environments for remote Faucet requests.

## 2. Register a developer test account locally

The Developer Hub test-account workflow records public account metadata only. It does not import or hold signing material.

```bash
420 test-account 0xYourAddress dev-account
```

A developer test account is expected to use external Wallet custody. Private keys, mnemonics and seed phrases stay outside Developer Hub and outside the Faucet request path.

## 3. Request testnet `$420`

```bash
420 faucet request 0xYourAddress \
  --manifest <official-testnet-manifest> \
  --catalogue <matching-testnet-catalogue>
```

The canonical Faucet policy documented for Genesis/testnet use is:

- 42 testnet `$420` per successful request;
- 24-hour cooldown per destination address;
- 5 requests per hour per IP;
- 42,000 testnet `$420` daily operator cap;
- CAPTCHA or equivalent abuse control where required;
- separate Faucet hot-wallet operations with no mainnet keys.

These are operational testnet controls, not native monetary policy.

## 4. Treat the Faucet response as delivery evidence, not balance truth

A successful service response is not canonical balance proof. After the request:

1. capture any returned transaction/request identifier;
2. query the selected testnet RPC for the address balance or transaction receipt;
3. optionally corroborate through the testnet Explorer;
4. apply the finality policy appropriate to the workflow.

The Faucet integration explicitly marks its service response as non-canonical balance evidence.

## No monetary-value rule

Testnet `$420` has no monetary value, redemption right, mainnet entitlement or claim on mainnet supply. Never design application logic that treats a Faucet allocation as production value.

## Mainnet boundary

A mainnet manifest must not advertise Faucet capability. If a configuration claims `environment: mainnet` and also exposes a Faucet, treat the configuration as invalid and stop.

## Common failures

- **Environment is not testnet** — do not send the request; select the correct official testnet manifest.
- **Faucet capability missing** — the current network does not advertise an eligible Faucet.
- **Invalid address** — correct the EVM destination; do not send secret material instead.
- **Cooldown/rate-limit response** — respect the server policy; do not rotate accounts/IPs to evade abuse controls.
- **Service says success but balance is unchanged** — confirm transaction state through canonical RPC before retrying.
- **Manifest/catalogue mismatch** — correct the environment pair; never bypass the chain-identity check.

## Related guides

- [Networks and manifests](networks-and-manifests.md)
- [RPC and WebSocket access](rpc-and-websocket.md)
- [Endpoint health and failover](endpoint-health-and-failover.md)
- [420 Faucet manual](../apps/faucet/index.md)
