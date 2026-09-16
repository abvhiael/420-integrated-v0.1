# 420 Resource Network operations

This runbook covers operational handling for the SR-8 Unified Resource Network runtime across Store, Repair, Cache, Gateway and Relay services.

## Authority model

The Resource Network runtime coordinates provider identity, capability discovery, service lifecycle, observability, configuration and explicit trust grants. It does not replace canonical chain state, manifests, placements, accepted proofs, Vault obligations or settlement finality.

Operators must treat runtime status as operational evidence only. If runtime state disagrees with canonical protocol state, fail closed and reconcile against the canonical source.

## Service lifecycle

Service registration is provider/node-bound and capability-scoped. Lifecycle transitions are constrained to the registered/starting/running/degraded/stopped/failed state graph.

Startup is dependency-aware and deterministic. Services are started in topological dependency order with stable lexical tie-breaking. Shutdown runs in reverse startup order. If startup fails part way through, already-started services are stopped in deterministic reverse order and the failed service is marked failed.

Before restart after a failure:

1. identify the failed service and its declared dependencies;
2. verify canonical state and required upstream dependencies independently;
3. correct configuration or credential issues without broadening trust grants;
4. restart through the lifecycle coordinator rather than starting dependent services manually;
5. confirm the resulting runtime snapshot before restoring traffic.

## Discovery and routing

Shared discovery only returns capabilities explicitly registered and bound to services. Running services are discoverable by default; degraded services require explicit opt-in. Registered, starting, stopped and failed services are excluded.

Gateway discovery is intentionally narrower: only cache and store sources are adapted into Gateway routing. Discovery failures must not be interpreted as canonical object absence and must never invent providers.

## Configuration and credentials

Shared configuration is restricted to non-secret values. Credentials and other secrets are service-scoped.

Operational rules:

- never place tokens, private keys, passwords or bearer material in shared scope;
- never copy one service's private values into another service to bypass a trust boundary;
- unknown service configuration must fail closed;
- operator configuration snapshots redact secret values by design;
- replacement updates must remain within the existing scope/service key.

If a credential is suspected to be exposed, rotate it at the owning service boundary and validate that no broader control-domain grant was added during recovery.

## Trust domains

SR-8 defines four independent operational trust domains:

- **storage** — data read/write authority;
- **delivery** — discovery and serving authority;
- **economic** — settlement-read authority;
- **control** — lifecycle and credential-read authority.

Authorities must be granted explicitly per service and must match the declared domain. Cross-domain authority combinations are rejected. Shared runtime membership does not imply any grant.

Credential-read authority belongs only to the control domain and must be explicit.

## Accounting and settlement

Shared accounting is a read-only projection over canonical economic state. It may report pending, reserved, funded, settled or cancelled states for supported economic capabilities, but it cannot create reservations, move balances, release payouts or declare finality.

A settled projection requires an explicit settlement identifier. Any identity mismatch between provider, node, service, capability or reference must fail closed.

## Health and observability

Operator status is derived from registered lifecycle state. Per-service health uses healthy, degraded, pending, stopped and failed categories. Metrics are bounded operational counters and are not protocol state.

Use status and metrics for diagnosis, not authorization. Do not write health output back into canonical chain, manifest, proof or settlement state.

## Failure handling

### Failed service

- isolate traffic to the failed service;
- inspect lifecycle and capability snapshots;
- verify dependencies and configuration;
- preserve service-specific credential isolation;
- restart through the lifecycle coordinator;
- verify discovery only exposes the service again once it is running.

### Degraded service

- keep degraded discovery opt-in explicit;
- avoid silently treating degraded as healthy;
- use service metrics and dependency state to determine whether to drain traffic;
- do not broaden trust grants as a shortcut to recovery.

### Discovery mismatch

- compare runtime registration, capability bindings and lifecycle state;
- confirm provider/node identity;
- reject unbound or foreign capabilities;
- fall back only to explicitly configured sources where the consuming component allows it.

### Accounting mismatch

- stop using the projection for operational decisions requiring finality;
- re-read canonical agreement/proof/settlement state;
- verify provider/node/service/capability/reference identity;
- do not patch local accounting state to force agreement.

### Credential or trust-boundary incident

- revoke or rotate the affected service credential;
- inspect explicit control-domain grants;
- verify no shared-scope secret exists;
- verify neighboring services cannot read the affected credential;
- restore only the minimum explicit grant required.

## Shutdown and maintenance

For planned maintenance, stop services through the lifecycle coordinator so shutdown follows reverse dependency order. Confirm that discovery no longer advertises stopped services and that operator status reflects the maintenance state.

After maintenance, start through the coordinator, verify deterministic lifecycle progression, confirm discovery/capability boundaries, then restore external traffic.

## Closeout evidence

SR-8.1 through SR-8.7 were individually qualified on evolving exact heads. PR #296 must receive one final exact-head qualification after reconciliation with current `main` and these closeout documentation changes before merge.

The final merge must preserve these invariants:

- no ambient authority from shared runtime membership;
- no local replacement for canonical protocol state;
- no shared secrets;
- explicit default-deny trust grants;
- deterministic lifecycle coordination and operator snapshots.
