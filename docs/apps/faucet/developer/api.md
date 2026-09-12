---
title: 420 Faucet API
audience: [developer]
category: application
status: development
version: current
---
# API boundary

The Developer Hub reference client submits an object containing the destination `address` to the discovered Faucet HTTP(S) endpoint.

Preconditions:

- discovered network environment is `testnet`;
- `canRequestFaucet` is true;
- a Faucet service endpoint is discoverable;
- address matches `0x[0-9a-fA-F]{40}`.

A client may report that a request was submitted, but it must not label the response as canonical balance proof. Confirm the resulting transaction/balance through testnet chain state.

Do not hard-code a mainnet Faucet URL; production discovery must fail closed when Faucet capability is absent.