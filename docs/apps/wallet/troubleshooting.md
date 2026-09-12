---
title: 420 Wallet troubleshooting
audience:
  - user
category: application
status: development
version: current
---

# 420 Wallet troubleshooting

The canonical Wallet troubleshooting guide is maintained in DOC-6:

- [420 Wallet troubleshooting](../../users/wallet/troubleshooting.md)

Use it for account discovery, network/RPC problems, pending or failed transactions, simulation problems, passkeys, sessions/capabilities, recovery, stale activity and safe support diagnostics.

## Application-level diagnostic order

When the Wallet appears wrong, diagnose in authority order:

1. confirm the intended network/chain identity;
2. confirm the canonical Smart Account/controller relationship;
3. inspect canonical account/capability/recovery state;
4. inspect transaction receipt and finality state;
5. compare another qualified RPC/Explorer/Indexer view if presentation appears stale;
6. restart/reload the replaceable client only after preserving transaction hashes/error details needed for diagnosis.

A stale UI or Indexer projection should be repaired or rebuilt; it must not be treated as authority to overwrite canonical account state.

## Safe support information

Safe information usually includes public account addresses, transaction hashes, network name/chain ID, Wallet/client version, browser/OS version and error identifiers. Never send private keys, seed phrases, passkey private material, signing secrets or recovery secrets to support.
