---
title: 420 Faucet user guide
audience: [user]
category: application
status: development
version: current
---
# User guide

420 Faucet exists only to fund test accounts for gas, contract calls and application testing.

## Requesting funds

Submit one valid 20-byte EVM address on an enabled testnet. The service may reject the request if the address cooldown is active, the IP rate limit is exhausted, abuse controls fail, the daily operator cap is reached, the hot wallet is depleted or the Faucet is paused.

## After a request

A service acknowledgement is not canonical balance proof. Confirm the transfer on the selected testnet through Wallet, Explorer or RPC and apply the normal transaction/finality rules.

## What Faucet funds are for

Use testnet `$420` only for testing. Do not buy, sell or represent testnet assets as having monetary value. Testnet balances can be reset, replaced or invalidated by testnet operations.