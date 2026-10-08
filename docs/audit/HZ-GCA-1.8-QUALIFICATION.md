# HZ-GCA-1.8 — Storage & retention qualification evidence

Status: **COMPLETE — Level 1**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Work package: **HZ-GCA-1.8 — Define storage & retention rules**

## Qualification identity

- Repository: `abvhiael/420-integrated-v0.1`
- PR: **#565 — Add 420Hz Generate, Community & Awards roadmap phase**
- Audit/implementation branch: `feature/420hz-generate-community-awards-roadmap`
- Current `main` / base SHA: `537525ebc636eabc76ff261f5b5ff5d236869b32`
- Qualified implementation SHA: `4d3e0f0a348896069cf924f7b230c5db32eadb5b`
- Qualification level: **Level 1 — per-roadmap-step fast qualification**
- Level 2 milestone: **NOT REQUIRED for HZ-GCA-1.8**
- Level 3: **DEFERRED to HZ-GCA-17 phase closeout**

## Canonical definition

HZ-GCA-1.8 freezes storage tiers, exact ordinary retention windows, deletion/tombstone semantics, backup expiry, quota behavior, archival/export rules, dispute/evidence holds, external-storage authority limits and anti-resurrection behavior.

It preserves HZ-GCA-1.7 privacy boundaries and uses the already qualified 420AI provider-runtime 24-hour maximum private-payload retention rather than inventing a longer provider lifetime.

## Implementation completed

Added:

- `hz/config/gca-storage-retention-v1.json`
- `docs/architecture/420hz/HZ-GCA-1.8-STORAGE-RETENTION.md`
- `scripts/verify-420hz-gca-1-8.py`

Updated:

- `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`
- `.github/workflows/420hz-gca.yml`

## Requirements satisfied

### Storage classes

Frozen classes:

- EPHEMERAL_PROVIDER_PRIVATE
- HZ_PRIVATE_PRIMARY
- HZ_PRIVATE_ARCHIVE
- PUBLIC_MEDIA
- PUBLIC_COMMITMENT_HISTORY
- SECURITY_AUDIT_METADATA

Private/operational classes remain encrypted and off-chain.

### Provider-runtime maximum

The qualified `EncryptedPayloadStore420` defaults to a maximum 24-hour retention window and rejects a requested expiry beyond `maxRetentionMs`.

420Hz therefore may request shorter provider payload retention but must never configure provider private payload retention above 24 hours.

### Retention schedule

- provider private execution payloads: **≤24h**
- failed/cancelled private generation data: **7d**
- unsaved generated takes/stems: **30d**
- active saved private projects: **365d after last authenticated activity**
- archive grace: **30d**
- generated export package: **24h**
- private copied consent evidence: **30d after gated action**, unless a scoped evidence hold applies
- dispute evidence hold: **canonical challenge/appeal window + 30d**
- redacted security/audit metadata: **90d**
- deleted private community state: **30d maximum tombstone cleanup window**
- public immutable commitment/history: retained as historical canonical/product history

### Deletion SLAs

Application-controlled deletion immediately revokes normal serving/access and records tombstone state.

Physical deletion bounds:

- primary private bytes: **≤24h**
- replicas/private caches: **≤7d**
- ordinary backups: **≤30d**
- provider private payloads: **≤24h absolute**
- export packages: **≤24h**

### Anti-resurrection

Deletion/tombstone state wins over:

- stale caches;
- replicas;
- retry/replay;
- backup restore;
- Indexer/Search rebuild;
- provider runtime recovery.

Restores must reapply deletion/tombstone state before objects are readable.

### Quotas

Quota behavior is frozen without inventing protocol byte constants.

Quota exhaustion:

- fails closed or requires explicit cleanup/plan change;
- does not silently discard unrelated saved/pinned work;
- prioritizes expired/failed/cancelled cleanup;
- never silently deletes canonical published media/history.

### External storage authority

420Hz owns only its application-controlled private project/archive/export stores and deletion ledger.

Canonical/external storage systems retain authority over their own agreements, proofs and physical object lifecycle. A StorageObjectRef does not imply universal physical deletion authority.

### Public-history exception

Deleting private application bytes does not erase immutable canonical commitments, Creative IDs, finalized award history or transaction/event history.

The product must not misrepresent private erasure as canonical-chain/history erasure.

## Storage/retention invariants

The manifest freezes **HZGCA-STORE-001 through HZGCA-STORE-018**.

The targeted verifier checks:

- exact storage class set;
- off-chain/encrypted private classes;
- exact retention-policy inventory;
- exact key retention windows;
- repository evidence of the qualified provider-runtime 24-hour default maximum;
- provider max-retention guard;
- no plaintext provider persistence;
- primary/replica/backup deletion SLAs;
- deletion/tombstone anti-resurrection;
- quota no-silent-destruction behavior;
- backup 30-day bound;
- external-storage authority limits;
- immutable-history exception;
- fail-closed failure rules;
- all 18 invariant identifiers;
- source-document existence;
- roadmap Level-1/non-milestone classification.

## Level-1 qualification

Dedicated workflow:

**420Hz GCA Qualification**

Successful exact-head run:

- Run ID: **37727363317**
- Run number: **#86**
- Job: **HZ-GCA Level 1**
- Job ID: **113148484315**
- Exact tested SHA: `4d3e0f0a348896069cf924f7b230c5db32eadb5b`
- Result: **PASS**

Successful checks:

1. exact PR-head checkout/verification;
2. all GCA JSON manifest syntax validation;
3. retained HZ-GCA-1.1 verifier;
4. retained HZ-GCA-1.2 verifier;
5. retained HZ-GCA-1.3 verifier;
6. retained HZ-GCA-1.4 verifier;
7. retained HZ-GCA-1.5 verifier;
8. retained HZ-GCA-1.6 verifier;
9. retained HZ-GCA-1.7 verifier;
10. HZ-GCA-1.8 storage/retention verifier.

No required Level-1 check was skipped, cancelled, stale or substituted.

The concurrently triggered **420Hz Web Qualification run #64** also passed against the same exact implementation SHA. It is collateral evidence and is not used as a substitute for the required GCA Level-1 qualification.

## CI diagnosis

The HZ-GCA Level-1 job spent time queued because of runner availability, then executed normally and passed.

Classification: **runner/queue delay only**, not an implementation, verifier, workflow or protocol failure.

No deterministic failing run was blindly rerun.

## Security / adversarial result

Applicable security qualification focuses on privacy-retention bypass, deletion resurrection, provider over-retention, quota-driven data loss and false deletion authority.

Result: **PASS**

The verifier rejects policies that:

- allow provider private payload retention above 24 hours;
- omit failed/cancelled/unsaved cleanup bounds;
- allow ordinary private backups above 30 days without an explicit scoped hold;
- permit stale backup/Indexer/Search restoration to resurrect deleted state;
- silently delete saved/pinned/published content on quota exhaustion;
- claim 420Hz can erase external/canonical history it does not own;
- retain private bytes beyond policy without a scoped documented hold.

## Level 2 status

**Not run / not required.**

HZ-GCA-1.8 is an ordinary architecture/storage-policy work package. It introduces no new executable shared component or milestone boundary requiring broader retained app integration.

The HZ-GCA-1 Level-2 milestone remains **HZ-GCA-1.20**.

## Intentionally deferred Level 3

Deferred to HZ-GCA-17:

- canonical full Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- repository-wide Docs/global reconciliation;
- retained 420Hz app integration suite;
- broad clients/services/Indexer/Search/RPC/frontend/backend qualification;
- full adversarial/invariant/static/security qualification;
- deployment/config verification.

The canonical full Solidity inventory remains owned by Solidity Contracts at Level 3. Genesis/address-authority qualification remains a distinct owner and must not duplicate the full Foundry inventory.

## Limitations

HZ-GCA-1.8 intentionally does not implement:

- physical production storage service deployment;
- production backup/restore jobs;
- storage-provider deletion APIs;
- quota billing/plan implementation;
- live data-export service;
- legal-jurisdiction retention overrides;
- testnet/production storage bindings.

Those are later implementation/testnet/production work.

## Blockers

None for HZ-GCA-1.8.

## Completion state

**HZ-GCA-1.8 — COMPLETE (Level 1).**

Parent **HZ-GCA-1 remains IN PROGRESS**.

Next canonical work package:

**HZ-GCA-1.9 — Define generation economics**
