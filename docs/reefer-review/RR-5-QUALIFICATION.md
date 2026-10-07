# RR-5 — Durable Storage & Rights qualification

## Step

**RR-5 — Durable Storage & Rights**

## Status

**COMPLETE — Level 1 PASS + storage/Rights milestone Level 2 PASS**

RR-5 satisfies the repository-side durable publishing, 420 Storage, integrity, durable-idempotency and structured 420 Rights provenance requirements without claiming that live public-testnet or production Storage/Rights dependencies have been deployed.

## Qualification levels

- **Level 1:** PASS — targeted RR-5 qualification.
- **Level 2:** PASS — required because RR-5 materially introduces shared 420 Storage and 420 Rights integration boundaries.
- **Level 3:** DEFERRED — complete app-phase closeout remains RR-10.

## Exact implementation SHA

`914329517c385a60f382216ce505313b1c6e3342`

Both required qualification workflows passed against this exact implementation SHA.

## Evidence commit

This qualification record and roadmap status update are evidence-only. They change no executable source, tests, workflows, dependencies, configuration, runtime artifacts, interfaces, deployment state, or substantive requirements and therefore do not require recursive substantive qualification.

## Repository state at qualification

- Repository: `abvhiael/420-integrated-v0.1`
- Branch: `reefer-review-rr1-newsfeed-20261007`
- PR: #562
- Base/main SHA: `c8e8b58d818611276f7a9bb2b8d2241004450d97`
- Exact implementation SHA: `914329517c385a60f382216ce505313b1c6e3342`
- Divergence at qualification: ahead 81 / behind 0
- PR state: OPEN / MERGEABLE / UNMERGED

## Canonical requirement

The canonical roadmap definition is:

> Persistent publication store, qualified 420 Storage, encryption/integrity, durable idempotency and live 420 Rights provenance.

Within the current repository audit phase, “live 420 Rights provenance” is implemented as a required structured provider/evidence boundary tied to canonical `420/service/rights/v1`, publication digest, chain/network and Registry/Router evidence. RR-5 does not invent deployment addresses or promote synthetic repository fixtures into public-testnet completion evidence.

## Requirements satisfied

### RR-5.A — Durable publication metadata

Implemented `DurableStore` for:
- Publications;
- publication revisions;
- moderation events;
- idempotency bindings/fingerprints.

The store is schema-versioned and validates publication/current-revision consistency before accepting persisted state.

### RR-5.B — Durable idempotency

Author/idempotency-key/fingerprint records survive restart. Exact replay returns the stable publication ID. Reuse of the same key with a different request fingerprint fails with `ErrConflict`.

### RR-5.C — Qualified 420 Storage boundary

Implemented `Storage420BlobAdapter` over canonical `sdk/storage420.ObjectRef`.

The RR-5 durable composition fails closed unless the provider advertises:
- qualified 420 Storage;
- encryption at rest;
- external key custody;
- owner-scoped access;
- SHA-256 integrity.

The legacy unscoped blob path cannot satisfy this durable composition.

### RR-5.D — Integrity on write/read

Before write, ReeferReview verifies that the supplied digest equals SHA-256(article body).

After provider upload, the returned object must contain non-empty object, manifest and commitment identities, exact payload size and an exact SHA-256 shard root.

Reads revalidate ObjectRef size/root and the service revalidates publication `BodyDigest` against returned plaintext.

### RR-5.E — Authorization before private retrieval

`GetForActor` now loads publication metadata and evaluates session/visibility authorization before calling the private blob provider.

Adversarial qualification proves an unauthorized private read does not increment the provider body-fetch count.

### RR-5.F — 420 Rights provenance

Implemented `RightsProvenanceProvider` and structured `RightsProvenance` persisted on the Publication and current PublicationRevision.

Required evidence includes:
- canonical Rights service ID;
- subject ID;
- right ID;
- claim ID;
- holder wallet;
- evidence hash;
- provenance hash;
- exact article body digest;
- chain ID;
- network;
- Registry reference;
- Router reference;
- evidence block number/hash;
- verification timestamp.

When an RR-4 verified session exists, Rights holder wallet and chain/network must match the verified session.

Published edits obtain new provenance for the new body digest.

### RR-5.G — Recovery/adversarial coverage

Qualified:
- restart durability;
- durable idempotent replay;
- durable conflicting replay rejection;
- state file 0600 permissions;
- corrupt JSON fail closed;
- future schema fail closed;
- unqualified Storage security profile fail closed;
- canonical ObjectRef root substitution rejection;
- provider read tampering rejection;
- unauthorized private read without blob retrieval;
- missing Rights provenance provider rejection;
- Rights body-digest substitution rejection;
- Rights wallet substitution rejection;
- Rights chain substitution rejection;
- Rights network substitution rejection.

### RR-5.H — Honest live-deployment boundary

No live Storage/Rights addresses, provider endpoints, key material, Registry records or public-testnet evidence were fabricated.

`NewDurablePublishingService` is the qualified repository composition. The existing development executable remains development-only and continues to refuse staging/production startup until real live adapters are supplied and qualified.

## Durability mechanics

The metadata store uses:
- local process mutex;
- OS file lock with `syscall.Flock`;
- owner-only directory/file permissions;
- temporary file write;
- temporary file fsync;
- atomic rename;
- resulting state file chmod 0600;
- directory fsync.

Corrupt or structurally inconsistent metadata fails closed on open/read rather than being silently normalized into accepted publication authority.

## Primary implementation files

- `reefer-review/durable_store.go`
- `reefer-review/durable_store_test.go`
- `reefer-review/storage420.go`
- `reefer-review/rights_provenance.go`
- `reefer-review/rr5_service.go`
- `reefer-review/rr5_test.go`
- `reefer-review/model.go`
- `reefer-review/service.go`
- `reefer-review/README.md`
- `docs/audit/REEFER-REVIEW-SECURITY.md`
- `docs/audit/REEFER-REVIEW-AUDIT-REMEDIATION-ROADMAP.md`
- `docs/reefer-review/RR-5-DURABLE-STORAGE-RIGHTS.md`
- `scripts/verify-reefer-review-rr5.py`
- `.github/workflows/reefer-review-rr5.yml`
- `.github/workflows/reefer-review-level2.yml`
- `docs/reefer-review/RR-ROADMAP.md`

## Level 1 evidence

### Reefer Review RR-5

- Workflow run: **37687046770**
- Job: `qualify`
- Exact implementation SHA: `914329517c385a60f382216ce505313b1c6e3342`
- Result: **PASS**

Passed:
- exact-head assertion;
- Go format;
- RR-5 package/integration tests;
- canonical 420 Storage SDK dependency tests;
- ReeferReview race qualification;
- Go vet;
- frontend JavaScript syntax;
- RR-5 verifier;
- retained RR-4 verifier;
- retained RR-3 verifier;
- retained RR-2 verifier;
- retained RR-1 verifier;
- retained canonical Reefer Review audit verifier.

No skipped, cancelled, stale, missing or untriggered check is substituted for required Level 1 evidence.

## Level 2 evidence

### Reefer Review Level 2 Integration

- Workflow run: **37687047515**
- Job: `retained-app-integration`
- Exact implementation SHA: `914329517c385a60f382216ce505313b1c6e3342`
- Result: **PASS**

Passed:
- exact milestone-head assertion;
- retained ReeferReview executable builds;
- full ReeferReview package tests;
- full ReeferReview race suite;
- app-surface Go vet;
- frontend syntax;
- RR-1 verifier;
- RR-2 verifier;
- RR-3 verifier;
- RR-4 verifier;
- RR-5 verifier;
- canonical 420 Storage SDK dependency tests;
- canonical Reefer Review audit verifier;
- shared GEN-SVC validator.

This is app-focused Level 2 coverage. It does not duplicate repository-wide Level 3 inventories.

## CI diagnosis / superseded exact heads

Superseded implementation SHA `784398251b5bd99325e0cb2de7445b7188d151af` produced RR-5 run `37686678862` failure at the Go-format step.

Exact diagnosis from the failed job:
- `reefer-review/durable_store_test.go` map literal alignment;
- `reefer-review/model.go` new Rights provenance field alignment;
- `reefer-review/rr5_test.go` one excess blank line;
- `reefer-review/service.go` variable declaration alignment.

These were formatting-only defects. The assertions/workflow were not weakened. The files were repaired narrowly, creating exact implementation SHA `914329517...`, which then passed every Level 1 and Level 2 step.

Unrelated broad push-time governance workflow failures are not RR-5 evidence and are not substituted for app qualification.

## Repository evidence updated

- `docs/reefer-review/RR-5-DURABLE-STORAGE-RIGHTS.md`
- `docs/reefer-review/RR-5-QUALIFICATION.md`
- `docs/reefer-review/RR-ROADMAP.md`
- `docs/audit/REEFER-REVIEW-SECURITY.md`
- `docs/audit/REEFER-REVIEW-AUDIT-REMEDIATION-ROADMAP.md`
- `reefer-review/README.md`

## Milestone status

**RR-5 Storage/Rights shared-dependency milestone: COMPLETE — Level 1 PASS + Level 2 PASS.**

## Intentionally deferred

### RR-6 — Ecosystem Integrations
Live 420 Search, 420 Notifications and 420Mail adapters plus reconciliation/failure handling.

### RR-7 / RR-8 / RR-9
Newsfeed production-security hardening, scheduled feed operations and production web/deployment/observability/browser qualification.

### RR-10 — Level 3
Reconciliation against then-current `main` and one comprehensive exact-SHA app-phase closeout. The full Solidity inventory remains owned by Solidity Contracts and Genesis/address authority remains separately owned by Genesis without duplicate Foundry execution.

### Existing live/testnet gates
Production-equivalent deployed 420 Storage provider evidence, live Rights Registry/Router addresses and runtime hashes, production key custody/encryption evidence, Registry publication, testnet restart/reorg/RPC behavior, and final Genesis/production declarations remain governed by the existing live/testnet roadmaps.

## Limitations / blockers

RR-5 has **no repository implementation or qualification blocker**.

Remaining live/external limitations:
- no production-equivalent 420 Storage endpoint/provider is configured for ReeferReview;
- no live Rights deployment/Registry/Router address set is configured for ReeferReview;
- encryption/key-custody assertions are a required provider contract at repository scope, but live operational proof remains a deployment gate;
- metadata durability is file-backed and qualified for the repository application boundary, not a horizontally distributed production database;
- production/testnet deployment remains fail closed.

These limitations do not block RR-5 completion in the current app audit phase because the roadmap explicitly retains later live/testnet/deployment gates.

## Completion state

- RR-5 requirements: **SATISFIED**
- Level 1: **PASS**
- Storage/Rights milestone Level 2: **PASS**
- Level 3: **DEFERRED TO RR-10**
- TESTNET READY: **NO**
- GENESIS READY: **NO**
- PRODUCTION READY: **NO**

## Next canonical roadmap step

**RR-6 — Ecosystem Integrations**
