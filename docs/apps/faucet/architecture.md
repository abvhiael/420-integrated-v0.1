---
title: 420 Faucet architecture
audience: [developer, operator]
category: application
status: development
version: current
---
# Architecture

420 Faucet is a replaceable public testnet service backed by a dedicated testnet Faucet allocation or operator-funded test account.

The service boundary is intentionally narrow:

- network discovery marks whether Faucet capability exists;
- a client submits a validated testnet account address;
- the Faucet service applies policy/rate/abuse checks;
- a separate Faucet hot wallet sends testnet `$420`;
- canonical execution-chain state determines whether the transfer actually occurred.

The service must use **no mainnet keys**. Operator emergency pause and hot-wallet replacement may affect availability without changing protocol monetary policy.

Developer Hub validates that the selected network environment is `testnet`, that Faucet capability is enabled and that the discovered endpoint uses HTTP(S).