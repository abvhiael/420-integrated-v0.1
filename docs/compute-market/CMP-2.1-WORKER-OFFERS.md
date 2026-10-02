# CMP-2.1 — Worker offers

Status: **COMPLETE — Level 1 exact-head qualified on `1463c5ef83e522f20c4cff8f015d4cf389fc64ab`.**

Durable qualification evidence: [CMP-2.1-QUALIFICATION-EVIDENCE.md](CMP-2.1-QUALIFICATION-EVIDENCE.md).

## Canonical definition

> Advertise hardware/software capacity, availability, jurisdiction and price.

CMP-2.1 begins the actual market layer after CMP-1 core-contract closeout.

The repository already had `ComputeOfferRegistry420` from CMP-1.2.2, but that component was deliberately limited to an immutable fixed native-$420 admission quote. CMP-2.1 extends that qualified foundation rather than replacing it.

## Canonical worker-offer record

A worker-market offer remains bound to one canonical provider, node and concrete resource.

The offer snapshots:

- provider and resource revisions;
- canonical node operator and provider settlement account;
- compute class;
- hardware profile commitment;
- runtime/software profile commitment;
- capability commitment;
- advertised capacity units;
- jurisdiction commitment;
- availability start and expiry;
- pricing policy and version;
- fixed native-$420 price;
- monotonic offer revision;
- predecessor commitment.

The registry does not certify hardware merely because it was advertised. Existing resource/worker attestation, trust and stake qualification remain independent authorities.

## Availability and stale-state behavior

An offer is effective only when:

- it exists and is active;
- the current time is inside its advertised availability window;
- its resource remains available;
- provider/node/resource ancestry still matches;
- the exact resource revision and hardware/runtime/capability/capacity snapshot still match;
- provider revision, settlement account and operator still match.

A material provider or resource revision therefore makes the old offer ineffective for new market use.

An authorized `updateOffer` may refresh the same offer identity to the new canonical resource/provider revisions while preserving the prior revision in immutable history.

## Authorization

The canonical provider/node operator retains direct authority.

CMP-2.1 additionally supports object-scoped delegates through `ComputeAuthorization420.scopeResource(providerId,nodeId,resourceId)` with distinct actions:

- `ACTION_PUBLISH_OFFER`;
- `ACTION_UPDATE_OFFER`;
- `ACTION_CANCEL_OFFER`.

Publish/update checks may bind a per-call amount limit to the advertised fixed price.

Wrong-resource grants, under-sized price grants and unrelated callers fail closed.

Cancellation remains possible for the recorded operator even after a provider/resource becomes unavailable, so stale offers can be withdrawn safely. Cancellation creates a terminal historical revision and does not rewrite the previous revision.

## Backward compatibility

The existing five-argument `publish(...)` entry point remains available for the previously qualified CMP-1.2 fixed-price acceptance path.

That path remains direct-operator only and records the explicit legacy jurisdiction marker:

`420/COMPUTE/JURISDICTION/UNSPECIFIED/V1`

New CMP-2.1 market callers use `publishWorkerOffer(...)`.

CMP-2.1 does not create requests, perform matching, reserve capacity, settle funds or grant scheduler authority.

## SDK surface

`@420/sdk` now exposes a typed `ComputeWorkerOffer420` record and `validateComputeWorkerOffer420`.

Client validation rejects:

- malformed canonical identifiers;
- missing/zero profile, jurisdiction or pricing commitments;
- stale revisions;
- inactive offers;
- zero capacity;
- zero/unversioned price;
- invalid availability windows.

## Qualification

This is an ordinary **Level 1** roadmap step.

Required qualification is limited to:

- affected Compute compilation;
- focused CMP-2.1 Foundry tests;
- retained accepted-price/entitlement regressions;
- affected `@420/sdk` build/tests;
- CMP-2.1 mechanical verifier;
- directly applicable app-scoped CI.

No new Level 2 milestone is required yet. Requests and matching have not converged with offers.

Repository-wide Level 3 remains deferred to **CMP-2.8 — Phase closeout**.

## Exit criteria

CMP-2.1 is COMPLETE only when:

1. worker offers advertise canonical hardware/software/capability/capacity;
2. availability, jurisdiction and price are explicit;
3. publish/update/cancel authority is exact-resource scoped and fail-closed;
4. revision history is immutable and reconstructable;
5. stale provider/resource state invalidates future offer effectiveness;
6. cancellation is terminal;
7. legacy fixed-price admission remains compatible;
8. SDK validation mirrors the public offer schema;
9. required Level 1 exact-head qualification is green;
10. durable evidence records that implementation SHA.

Next canonical step:

**CMP-2.2 — Compute requests**
