---
title: 420 Faucet developer integration
audience: [developer]
category: application
status: development
version: current
---
# Developer integration

Integrate Faucet as an optional **testnet service**, never as a protocol contract or mainnet dependency.

Clients should discover the active testnet network first, require `environment == testnet`, require Faucet capability to be advertised, resolve the Faucet service endpoint, validate HTTP(S), submit a destination address and then independently confirm the resulting chain balance/transaction.

Developer Hub already follows this model through its testnet Faucet client.

See [API](api.md), [errors](errors.md) and [examples](examples.md).