# 420Automation AUT-9 — API, authentication and Developer Hub integration

AUT-9 defines the off-chain service boundary through which Developer Hub applications and operators inspect and manage 420Automation jobs. It is not a protocol-permission layer.

## Credential contract

Automation consumes the same redacted service-credential record shape established by Developer Hub DEVHUB-16. Records are bound to chain 420, an environment, the `420automation` audience, issue/expiry times, lifecycle state, revision, application ID and declared scopes. Automation stores only the SHA-256 digest needed to compare presented credential material; it does not persist raw bearer material.

Supported scopes are:

- `automation:read` — service inspection and application-filtered job reads;
- `automation:submit` — validated registration of jobs visible to the application binding;
- `automation:manage` — enable/disable lifecycle mutation for visible jobs;
- `automation:admin` — service-level administrative access across application bindings.

`automation:admin` is still only Automation service authority. It cannot bypass job validation or become protocol, wallet, Identity, Registry, governance, Oracle, bridge, consensus or Engine authority.

## Application binding

Every credential application must have an Automation binding containing bounded owner-ID and protocol-ID sets. Non-admin principals may see or mutate a job only when at least one of those bindings matches the job. Job reads outside the binding return not-found behavior rather than exposing another application's inventory.

This binding is off-chain access control. It does not prove that an application owns the corresponding on-chain protocol or owner identity; target contracts still enforce their own authorization.

## API operations

AUT-9 exposes transport-neutral operations:

- `service.inspect`
- `jobs.list`
- `jobs.get`
- `jobs.register`
- `jobs.set-status`

The service can be mounted behind HTTP, a Developer Hub service adapter, or another qualified transport without changing authorization semantics. Unknown operations, extra request fields, malformed IDs, invalid lifecycle values and unauthenticated requests fail closed.

Job registration always flows through the AUT-1 job registry, including deterministic job ID and immutable execution-envelope validation. Status changes use the existing AUT-1 revisioned lifecycle mutation. AUT-9 therefore adds no second job model and no back door around prior phase invariants.

## RPC boundary

420RPC remains a separate public-read/submission transport. An Automation API credential is not automatically a 420RPC credential and does not inherit RPC scopes. Likewise, an RPC credential does not authorize Automation job registration or management. Worker transaction submission continues to use the AUT-4 execution path and its qualified RPC adapter.

## Developer Hub boundary

Developer Hub may issue/rotate/revoke the off-chain credential lifecycle and present redacted application metadata, but it does not become canonical Automation state. Automation verifies the configured credential record and application binding locally. No API response returns stored digest values or raw credential material.

## AUT-9 invariants

- AUT9-INV-001 — all nonpublic Automation API operations require a valid active unexpired `420automation` credential.
- AUT9-INV-002 — unsupported Automation scopes fail closed.
- AUT9-INV-003 — credentials are bound to chain and environment.
- AUT9-INV-004 — raw credential material is not persisted in Automation registry state.
- AUT9-INV-005 — application bindings constrain non-admin job visibility and mutation.
- AUT9-INV-006 — read scope cannot submit or manage jobs.
- AUT9-INV-007 — submit scope cannot mutate lifecycle without manage scope.
- AUT9-INV-008 — service admin cannot bypass AUT-1 job or envelope validation.
- AUT9-INV-009 — API authentication does not create target-protocol authorization.
- AUT9-INV-010 — Automation credentials do not become 420RPC, wallet, Identity, Registry, governance, bridge, Oracle, consensus or Engine credentials.
