# 420 Registry architecture

The 420 Registry application reads canonical state from `ProtocolRegistry` and may use 420Indexer/Explorer/Search as convenience projections. Security-sensitive clients should recheck canonical chain state before acting.

`ProtocolRegistry` is the single Registry authority and exposes two intentionally separate canonical views.

## Service catalogue

Genesis service IDs are frozen through `ServiceIds420`; extension IDs require explicit governance approval and descriptor commitments. Service publication uses sequential `uint32` revisions, preserves version history, and stores registration-profile commitments for component type, manifest hash, dependency root and interface hash.

Service IDs use the `420/service/*` namespace. Service activity is read through `isServiceActive(bytes32)`. The service catalogue must not be inferred from Genesis component IDs.

## Frozen Genesis component registry

`ProtocolRegistry` directly implements frozen `IProtocolRegistry420` v1.0 for Genesis-resident dependency resolution. Component IDs use the `420/APP/*` / approved component namespace and store:

- implementation address;
- deployed runtime code hash;
- semantic `Types420.Version`;
- shared `Types420.Lifecycle`;
- append-only Registry component revisions for provenance.

Frozen reads are `component`, `isActive`, `resolve`, `runtimeCodeHash`, and `supportsVersion`.

`isActive` is component lifecycle semantics only. Service activity and component lifecycle are deliberately not aliased.

Semantic compatibility is fail-closed: the component must be ACTIVE, major versions must match, the registered minor must be at least the requested minor, and when the minors are equal the registered patch must be at least the requested patch.

`GenesisResidentAccess420` also compares the committed runtime code hash with the actual deployed code hash before using a dependency. Unknown, inactive, incompatible, or code-hash-mismatched dependencies fail closed.

There is no canonical Registry adapter and no implicit service-ID/component-ID or service-revision/SemVer conversion.

The frontend is replaceable. `ProtocolRegistry` is the canonical authority for this domain.
