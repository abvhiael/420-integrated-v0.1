---
title: 420 Wallet developer integration
audience:
  - developer
category: developer-guide
status: development
version: current
---

# 420 Wallet developer integration

Integrations should treat 420 Wallet as a client for canonical account/protocol authority, not as a privileged backend. Applications request the minimum account action or reusable capability required, and current canonical authorization remains the source of truth.

## Integration model

A safe integration normally performs:

1. network/chain identity validation;
2. account discovery/selection;
3. application identity and contract/interface discovery;
4. read-only state retrieval where needed;
5. transaction or capability construction;
6. human-readable review/simulation support;
7. explicit Wallet/account authorization;
8. transaction submission;
9. receipt/finality tracking;
10. re-read of canonical state after execution.

## Required boundaries

- Do not request private keys, seed phrases or passkey private material.
- Do not equate connection with spending or reusable authority.
- Do not trust cached capability/session state when current authorization matters.
- Do not require Wallet-specific canonical state that prevents client portability.
- Do not treat Indexer/UI state as stronger than canonical account/protocol state.
- Bind network, account, target and capability scope explicitly.

## Developer package

- [Contracts](contracts.md)
- [API and provider boundary](api.md)
- [Events and finality](events.md)
- [Errors and retries](errors.md)
- [Integration examples](examples.md)

Generated ABI/event/error tables belong to DOC-10. These pages describe the stable integration semantics developers need before consuming generated references.

## Related documentation

- [Wallet architecture](../architecture.md)
- [Wallet permissions](../permissions.md)
- [Transactions](../../../architecture/chain/transactions.md)
- [Accounts](../../../architecture/chain/accounts.md)
- [RPC/gateway infrastructure](../../../architecture/infrastructure/rpc-gateways-network-ingress.md)
