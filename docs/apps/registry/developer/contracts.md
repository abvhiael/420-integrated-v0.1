# Registry contracts

Primary contracts/interfaces are `ProtocolRegistry`, frozen `IProtocolRegistry420`, `Types420`, and `ServiceIds420`.

## Service catalogue API

The Registry stores current and historical service records plus registration-profile commitments.

- `approveServiceId`: governance-only extension approval; canonical Genesis service IDs are immutable and cannot pass through the extension-approval path.
- `publishService` / `setService`: legacy governance-only service publication.
- `publishRegisteredService`: strict code-bearing publication with manifest/interface commitments.
- `getService`, `getServiceVersion`, `getRegistrationProfile`: service reads/history.
- `currentVersion`: sequential service publication revision.
- `isServiceActive`: explicit service-catalogue activity.
- `resolveActive`: fail-closed active service resolution.

Service revisions are not semantic versions.

## Frozen Genesis component API

`ProtocolRegistry` directly satisfies `IProtocolRegistry420` v1.0.

Governance mutations:

- `registerComponent(componentId, implementation, version, lifecycle)` verifies deployed code, derives the runtime code hash, records a new provenance revision, and emits `ComponentRegistered`.
- `setComponentLifecycle(componentId, lifecycle)` updates the current component revision and emits `ComponentLifecycleChanged`.

Frozen reads:

- `component(componentId)`
- `isActive(componentId)`
- `resolve(componentId)`
- `runtimeCodeHash(componentId)`
- `supportsVersion(componentId, requestedVersion)`

Additional provenance reads:

- `currentComponentRevision(componentId)`
- `getComponentRevision(componentId, revision)`

Component IDs and service IDs are independent namespaces. No implicit conversion is supported.

`supportsVersion` succeeds only for ACTIVE components with the same major version, a registered minor greater than or equal to the requested minor, and—when minors are equal—a registered patch greater than or equal to the requested patch.

Generated ABI/NatSpec reference belongs in DOC-10/REG-AUDIT-6. This manual describes the canonical integration semantics; generated reference metadata is intentionally not rewritten ahead of the later address/artifact reconciliation steps.
