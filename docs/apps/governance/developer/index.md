# 420 Governance developer integration

Use **420 Governance** for the public application and **420 Civic** for implementation contracts.

## Discovery

Start from ProtocolRegistry at `0x0000000000000000000000000000000000000434`.

Canonical service ID preimage: `420/service/governance/v1`.

Do not hard-code Registry-resolved Civic module addresses. Verify deployed code, `systemName()`, `protocolVersion()` and module bindings before using a resolved graph.

## Authority assumptions

The Civic runtime graph is explicit and does not use Registry, Stake, Identity, Oracle, Search, Explorer, Notifications or Wallet as proposal/voting/execution authority.

Derived Indexer data is useful for enumeration and history but must be reconciled to chain state before authoritative actions.

## References

- [Contracts](contracts.md)
- [API and reads](api.md)
- [Events and finality](events.md)
- [Errors and retries](errors.md)
- [Examples](examples.md)
- [Cross-protocol boundaries](../integration.md)
