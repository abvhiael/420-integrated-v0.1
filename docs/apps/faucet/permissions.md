---
title: 420 Faucet permissions
audience: [user, developer]
category: application
status: development
version: current
---
# Permissions

A normal Faucet request does not require a Wallet capability or transaction signature because the requester is asking an operator-funded testnet service to send funds to a public address.

The Faucet must never ask for private keys, seed phrases, passkey material or unrestricted Wallet permissions.

Operator controls such as funding the hot wallet, changing service deployment or emergency-pausing the Faucet are infrastructure responsibilities and must remain separate from user Wallet authority.

Receiving testnet `$420` grants no governance, validator, mainnet, identity or protocol privilege.