# 420Media Phase 1 — contract hardening and deployment graph

Roadmap step: **MEDIA-AUDIT-2 — Contract hardening and deployment graph**

## Authority model reconciliation

420Media remains a **replaceable application/service**, not a frozen Genesis resident. Its Phase 1 contracts therefore continue to inherit the repository's minimal `SystemAccess` governance boundary rather than `GenesisResidentAccess420`.

That distinction is intentional:

- `SystemAccess` binds governance to the configured timelock and exposes no owner backdoor.
- `GenesisResidentAccess420` is reserved for frozen resident components that must prove ProtocolRegistry registration, runtime code hash, version support, system safety, chain context and canonical settlement health on every protected operation.
- Current canonical configuration does not list 420Media as a frozen Genesis application.
- MEDIA-AUDIT-13 owns the later explicit catalog/promotion decision. This step does not invent resident status or frozen addresses.

## ProtocolRegistry reconciliation

No Phase 1 Media address is hard-coded or inferred from documentation.

When a future release publishes Media components, deployment tooling must record the exact deployed addresses/runtime hashes and, where canonical architecture requires it, publish those records through the active Registry/service-discovery path. This step defines deployment order only; it does not claim a live Registry publication.

## Pay reconciliation

`MediaSettlement420` remains a non-custodial authorization/state coordinator. The `vaultAdapter` and `payoutAdapter` roles are explicit external authorities and Media never moves value itself.

MEDIA-AUDIT-2 does **not** replace those roles with a guessed Pay contract. The current Pay architecture exposes canonical routers/adapters under its own authority and health model; MEDIA-AUDIT-7 owns the explicit canonical Pay binding, idempotency and failure qualification.

The Phase 1 invariant retained here is that settlement state changes are atomic with adapter/job-market callbacks: if a downstream callback reverts, the Media state mutation reverts too.

## Compute reconciliation

`computeProviderRef` remains an opaque compatibility reference. The current Compute Market has an authoritative provider registry and component graph, but Phase 1 Media does not gain Compute authority merely by storing a reference.

MEDIA-AUDIT-7 owns the later canonical Compute Market integration. Until then:

- a non-zero `computeProviderRef` is not proof that a provider exists or is active;
- Media operator authorization remains controlled by `MediaOperatorRegistry420`;
- no Compute settlement, matching, verification or slashing authority is implied.

## Hardened binding rules

Single-assignment internal contract dependencies now reject code-less addresses before state is committed:

- `MediaOperatorRegistry420.capabilityRegistry`;
- `MediaJobMarket420.operatorRegistry`;
- `MediaJobMarket420.slaRegistry`;
- `MediaJobMarket420.settlement`;
- `MediaSettlement420.jobMarket`.

The vault/payout adapter boundary remains address-authorized in Phase 1 because the existing protocol and Anvil harness intentionally model those as external callers. Contract-backed canonical Pay adapters are an integration requirement of MEDIA-AUDIT-7 rather than a hidden semantic change in this step.

## Canonical deployment order

No fixed addresses are assigned by this document.

1. Establish the governance timelock address from the target release environment.
2. Deploy `MediaCapabilityRegistry420(timelock)`.
3. Deploy `MediaOperatorRegistry420(timelock)`.
4. Deploy `MediaSLA420(timelock)`.
5. Deploy `MediaStreamRegistry420(timelock)`.
6. Deploy `MediaSettlement420(timelock)`.
7. Deploy `MediaJobMarket420(timelock)`.
8. Bind `MediaOperatorRegistry420 -> MediaCapabilityRegistry420`.
9. Bind `MediaJobMarket420 -> MediaOperatorRegistry420, MediaSLA420, MediaSettlement420`.
10. Bind `MediaSettlement420 -> MediaJobMarket420`.
11. Bind the approved vault adapter.
12. Bind the approved payout adapter.
13. Register/activate Media capabilities and SLA reporters/policies.
14. Record exact deployed addresses, runtime hashes, chain identity, deployment transaction lineage and any Registry/service publication required by the release stage.

Bindings are deliberately single-assignment. A deployment must validate every address before binding; a mistaken permanent binding requires redeployment rather than an administrative rewrite.

## Dependency graph

```text
governance timelock
  |-- MediaCapabilityRegistry420
  |      ^
  |      |
  |-- MediaOperatorRegistry420
  |             ^
  |             |
  |-- MediaSLA420
  |             |
  |-- MediaSettlement420 <---- vault adapter
  |        ^    |         <---- payout adapter
  |        |    |
  |        +----+---- MediaJobMarket420
  |
  +-- MediaStreamRegistry420

MediaOperatorRegistry420.computeProviderRef
  -> opaque reference only in Phase 1
  -> canonical Compute binding deferred to MEDIA-AUDIT-7
```

## Adversarial and property qualification

The retained Phase 1 hardening suite must prove at minimum:

- code-less permanent internal dependencies are rejected;
- existing single-assignment protections remain intact;
- unauthorized vault/payout/job-market callers remain rejected by existing protocol tests;
- funding cannot redirect payer/operator/beneficiary terms;
- callback failure during funding rolls back the settlement record;
- callback failure during release rolls back the CLOSED transition;
- fuzzed valid funding amounts are stored exactly and remain within the canonical max-spend bound;
- existing SLA pass/fail, expiry, capability fail-closed, controller isolation and reporter authorization regressions remain green.

## Exit criteria

MEDIA-AUDIT-2 is complete only when the hardened contracts, adversarial/property tests, this deployment graph and the exact-head 420Media Level 1 workflow all pass on one implementation SHA. Broad Level 2 and repository-wide Level 3 qualification remain intentionally deferred under the phase qualification model.
