# 420 Developer Hub — DEVHUB-8 Testnet Faucet & Developer Test Accounts

## Status

DEVHUB-8 adds a narrow Developer Hub access layer for testnet funds and developer-controlled test accounts. It does not implement a second faucet, mint path, account wallet, keystore, or monetary-policy surface.

The canonical faucet policy remains the existing testnet service configuration in `testnet/services/faucet-policy.json` and `testnet/public-services/faucet/operations.json`. Developer Hub discovers a finalized faucet endpoint through the DEVHUB-1 network manifest and submits a validated developer address to that service.

## Existing faucet policy

The repository already defines the testnet faucet as testnet-only and outside protocol monetary policy. The current policy specifies 42 testnet $420 per successful request, a 24-hour per-address cooldown, an IP request limit, CAPTCHA or equivalent abuse controls, a separate faucet hot wallet, an operator emergency pause path, and no mainnet keys. Those controls remain owned and enforced by the faucet service rather than by Developer Hub.

The public testnet service metadata currently contains placeholder endpoint values. DEVHUB-8 does not substitute, infer, or hard-code a live faucet URL. Faucet use becomes available only when a selected canonical testnet manifest exposes a finalized `services.faucet` endpoint.

## Developer test accounts

A Developer Hub test account is only an address descriptor:

- validated 20-byte EVM address;
- optional developer label;
- `custody: external-wallet`;
- `secretMaterialManaged: false`.

DEVHUB-8 never generates, imports, stores, prints, requests, or derives a raw private key, mnemonic, seed phrase, session key, or smart-account authorization. Developers control the address through their chosen external wallet or the qualified 420 Wallet path.

## Faucet client

`createFaucetClient420()` requires:

1. a DEVHUB-1 discovered network with `environment === "testnet"`;
2. `canRequestFaucet === true`;
3. a manifest-declared `services.faucet` endpoint;
4. an HTTP or HTTPS faucet endpoint;
5. an injected transport owned by the caller.

Local, devnet, and mainnet environments fail closed. The Hub does not allow an arbitrary faucet URL override.

A successful service submission returns request metadata with `canonicalBalanceProof: false`. Faucet service output is operational acknowledgement only. Applications must read canonical account balance/state from the chain through the normal RPC path.

## CLI

DEVHUB-8 adds:

- `420 test-account ADDRESS [LABEL]` — validate and display an external-custody developer account descriptor;
- `420 faucet request ADDRESS --manifest PATH` — submit an address to the canonical faucet endpoint discovered from the selected testnet manifest.

The default local Developer Hub manifest cannot execute a remote faucet request. A finalized testnet manifest is required.

## Invariants

- **DEVHUB-INV-046** — remote faucet submission requires a discovered network whose environment is exactly `testnet`; local, devnet, and mainnet fail closed.
- **DEVHUB-INV-047** — the faucet endpoint comes only from the selected canonical network manifest `services.faucet`; Developer Hub never accepts or invents an authority-bypassing faucet URL.
- **DEVHUB-INV-048** — faucet amounts, cooldowns, IP limits, abuse controls, operator caps, funding source, and emergency pause remain faucet-service policy and are not reimplemented or overridden by Developer Hub.
- **DEVHUB-INV-049** — a faucet response is never canonical proof of balance or settlement; chain/RPC state remains authoritative.
- **DEVHUB-INV-050** — developer test-account workflows handle public addresses and labels only and never generate, solicit, import, store, or expose secret signing material.
- **DEVHUB-INV-051** — mainnet cannot expose or use the Developer Hub faucet workflow.
- **DEVHUB-INV-052** — placeholder/unpublished faucet metadata must never be promoted or silently treated as a live endpoint.
- **DEVHUB-INV-053** — remote faucet endpoints must use HTTP(S); filesystem and other URI schemes fail closed.

## Exit criteria

DEVHUB-8 is complete when:

1. developer test-account descriptors are address-only and externally custodied;
2. testnet faucet access consumes DEVHUB-1 network discovery;
3. non-testnet environments fail closed before transport execution;
4. arbitrary faucet endpoint overrides are unavailable;
5. faucet acknowledgements are explicitly non-authoritative;
6. CLI commands expose the workflow without adding secret-key custody;
7. hostile address, endpoint, environment, and capability cases are covered by Developer Hub qualification.

## Next

DEVHUB-9 adds deployment workflows and the initial deployment UI/control surface while preserving canonical signer, verification, and registry boundaries.
