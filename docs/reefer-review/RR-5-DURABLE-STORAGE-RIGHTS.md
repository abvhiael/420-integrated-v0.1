# RR-5 — Durable Storage & Rights

## Canonical definition

**RR-5 — Durable Storage & Rights**

> Persistent publication store, qualified 420 Storage, encryption/integrity, durable idempotency and live 420 Rights provenance.

RR-5 preserves ReeferReview as a replaceable application. It does not create a second Storage or Rights authority. The repository-side integration contracts are qualified here; production-equivalent deployed provider/address/Registry evidence remains in the existing live/testnet/deployment gates.

RR-5 is a material shared-dependency milestone and therefore requires targeted Level 1 plus retained app Level 2 on one exact implementation SHA. Level 3 remains RR-10.

## Requirements

### RR-5.A — Durable publication metadata
Persist Publications, revisions and moderation history across process restart in a schema-versioned durable store.

Required safety properties: interprocess locking, 0600 state, temporary-file write, file sync, atomic rename, directory sync, corruption rejection and future-schema fail closed.

### RR-5.B — Durable idempotency
Author + idempotency-key bindings and request fingerprints survive restart. Exact replay returns the same publication identity; conflicting replay fails with CONFLICT.

### RR-5.C — Qualified 420 Storage boundary
Article bodies remain off metadata storage and use an owner-scoped adapter over canonical `sdk/storage420.ObjectRef`. The RR-5 composition must reject a provider that does not attest qualified 420 Storage, encryption at rest, external key custody, owner-scoped access and SHA-256 integrity.

### RR-5.D — Integrity on write and read
Before upload, the supplied article digest must equal SHA-256(body). The returned Storage object must bind non-empty object/manifest/commitment identity, exact size and exact SHA-256 shard root. Retrieval repeats size/root verification and the service verifies the article body digest.

### RR-5.E — Authorization before private retrieval
Restricted publication authorization must be decided from durable metadata/session authority before private body bytes are requested from Storage.

### RR-5.F — 420 Rights provenance
Publishing and every edit of a published article through the durable RR-5 composition require structured provenance from a `RightsProvenanceProvider` for canonical service `420/service/rights/v1`.

Evidence must bind subject/right/claim, holder wallet, evidence/provenance hashes, exact body digest, chain/network, Registry/Router references, evidence block/hash and verification time. Where an RR-4 session exists, holder wallet and chain/network must match that verified session.

### RR-5.G — Durable recovery/adversarial coverage
Qualification must cover restart, idempotent replay/conflict, corrupt state, future schema, unqualified Storage, object-root substitution, read tampering, unauthorized private read without blob fetch, missing Rights provenance provider and Rights digest/wallet/chain/network substitution.

### RR-5.H — Honest live-deployment boundary
RR-5 must not invent live Storage/Rights addresses, provider endpoints, encryption keys, Registry records or testnet evidence. Repository qualification proves the consuming application boundary and fail-closed contracts, not that public testnet/production dependencies are deployed.

## Exit criteria

RR-5 is COMPLETE only when RR-5.A through RR-5.H are implemented; exact-head RR-5 Level 1 passes; because this is the Storage/Rights shared-dependency milestone the retained ReeferReview Level 2 integration suite also passes on the same exact implementation SHA; durable qualification evidence is committed; and no RR-6+ or Level-3/live readiness is falsely claimed.

## Next canonical roadmap step

**RR-6 — Ecosystem Integrations**
