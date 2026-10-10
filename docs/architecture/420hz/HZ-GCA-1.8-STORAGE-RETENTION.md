# HZ-GCA-1.8 — Storage & retention rules

Status: **IMPLEMENTED — Level 1 storage/retention definition**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Machine-readable policy:

`hz/config/gca-storage-retention-v1.json`

This step freezes 420Hz storage classes, retention periods, deletion semantics, backup expiry, quota behavior, archival/export rules and anti-resurrection guarantees without overclaiming deletion authority over canonical external systems.

## Storage classes

420Hz distinguishes:

- **EPHEMERAL_PROVIDER_PRIVATE** — encrypted private AI execution payloads at the qualified provider runtime;
- **HZ_PRIVATE_PRIMARY** — active private project/application data controlled by 420Hz;
- **HZ_PRIVATE_ARCHIVE** — encrypted time-bounded archival/grace data;
- **PUBLIC_MEDIA** — selected published media under canonical storage/publication control;
- **PUBLIC_COMMITMENT_HISTORY** — immutable/public commitments, IDs and historical result references;
- **SECURITY_AUDIT_METADATA** — redacted operational/security metadata only.

These classes do not create protocol authority.

## Provider private-payload maximum

The qualified 420AI provider runtime already enforces `maxRetentionMs=24*60*60*1000` by default and rejects expiry beyond that bound.

420Hz therefore freezes the following rule:

> **provider execution payloads may never be retained longer than 24 hours by the qualified provider-runtime private-payload store.**

420Hz may request less than 24 hours.

It may not request more.

Expired provider payload access must fail closed and delete/deny the payload.

Terminal cleanup should delete private execution inputs as soon as they are no longer required by the accepted verification/dispute policy rather than treating 24 hours as a target minimum.

## Retention schedule

### Failed or cancelled generation inputs/results

Private prompts, reference audio, failed/cancelled outputs and stems:

- maximum **7 days** after terminal FAILED/CANCELLED;
- only explicit save/export or a scoped accepted evidence hold may extend that ordinary cleanup path;
- primary private bytes are deleted within 24 hours after policy expiry;
- replicas within 7 days;
- ordinary backups within 30 days.

Failed/cancelled data must not silently become permanent project storage.

### Unsaved generated takes and stems

Unsaved private generated takes/stems:

- maximum **30 days** after generation;
- may move to active-project retention only through an explicit save/pin action;
- deletion follows the primary/replica/backup limits above.

### Active saved private projects

Active saved project data:

- maximum **365 days after last authenticated project activity**;
- authenticated project activity may refresh the inactivity window;
- where Notifications capability is available, the user should be warned before inactivity expiry;
- no inactivity transition may make data public.

After inactivity expiry, private project content moves to the bounded archive/deletion path.

### Archived private projects

Archive is a deletion-grace tier, not indefinite storage:

- maximum **30 days** after archive/expiry transition;
- then private bytes are deleted on the bounded deletion schedule.

### Export packages

Generated export packages:

- maximum **24 hours** after package creation;
- authenticated, purpose-scoped access only;
- no backup required;
- explicit early deletion after successful download is permitted.

### Private consent evidence copied into 420Hz

Raw private consent evidence should be minimized in favor of qualified external references.

Where copied into 420Hz:

- maximum **30 days** after the gated action completes;
- may be retained longer only under a live, case-scoped dispute/evidence hold;
- normal private deletion SLA applies afterward.

### Dispute/evidence hold

Private evidence legitimately required for an accepted dispute/challenge:

- retained only through the canonical challenge/appeal window;
- plus a bounded **30-day post-finality grace**;
- the hold is case-scoped and cannot retain unrelated project payloads.

A generic dispute flag is not blanket permission for indefinite storage.

### Security/audit metadata

Redacted access/security/deletion metadata:

- maximum **90 days**;
- may extend only for a scoped active incident/dispute;
- must never contain raw protected payloads, credentials or private media.

### Deleted private community state

Deleted/tombstoned private favorites, playlists and preferences:

- hidden immediately;
- primary data within 24 hours where feasible;
- replicas within 7 days;
- ordinary backups within 30 days;
- public derived projections must stop presenting the deleted state immediately.

### Published media

Published media follows the owning canonical publication/storage policy.

420Hz must stop serving media immediately when canonical availability says it is unavailable, but must not falsely claim physical deletion authority over external storage replicas it does not own.

### Public immutable history

Published provenance/disclosure commitments, native Creative IDs, finalized award history and canonical transaction/event history are retained as historical public commitments.

Private-data deletion must **not** be described as erasing immutable canonical history.

## Deletion semantics

An accepted application-controlled deletion must immediately:

- revoke normal read/serve access;
- create/record the application tombstone/deletion marker;
- revoke controlled provider/storage access grants;
- stop Search/Indexer/Notifications presentation for deleted private/unlisted state.

Physical deletion bounds:

- application-controlled primary private bytes: **≤24 hours**
- private replicas/caches: **≤7 days**
- ordinary backups: **≤30 days**
- provider execution payload: **≤24 hours absolute**
- export packages: **≤24 hours**

## Anti-resurrection

Deletion/tombstone state wins over stale data.

A deleted object must not reappear because of:

- stale cache;
- replica lag;
- retry/replay;
- backup restore;
- Indexer/Search rebuild;
- provider runtime recovery.

Backup restore must replay deletion/tombstone state **before** restored private objects become readable.

Indexer/Search rebuild must not resurrect deleted/private/unlisted records into broader visibility.

Expired provider private payloads must not be recreated from local runtime state.

## Quotas

HZ-GCA-1.8 freezes quota behavior but does not invent protocol byte limits.

Rules:

- usage is accounted per account/project;
- private primary, archived bytes and external published-media references remain distinguishable;
- actual byte/count limits are deployment configuration, not consensus/protocol constants;
- operations that would exceed quota fail closed or require explicit cleanup/plan change;
- quota exhaustion must not silently destroy unrelated saved/pinned work;
- failed/cancelled/expired private data is cleanup priority before active saved content;
- canonical published media/history is never silently deleted solely to satisfy a private-project quota.

## Export

Export may include:

- user-owned 420Hz project metadata;
- eligible private artifacts;
- useful canonical IDs/commitments/references.

Export must exclude:

- provider credentials;
- wallet secrets;
- unrelated users' private data;
- evidence the requester is not authorized to receive.

Creating an export does not make the project public and creates no new rights.

## Backup / recovery

Ordinary private backups expire within **30 days**.

Backups must:

- retain encryption/access controls equivalent to primary private storage;
- replay deletion/tombstone ledger before restoring readability;
- not become a hidden extension of provider private-payload retention;
- not resurrect deleted Search/Indexer/Notification presentation.

Deletion receipts may be retained as redacted security metadata without payload contents.

## External storage authority

420Hz owns deletion semantics only for application-controlled storage.

420ResourceProtocol / 420Store or another canonical storage provider remains authoritative for its:

- agreements;
- proofs;
- object/manifest references;
- provider storage lifecycle.

A `StorageObjectRef` does not prove that 420Hz can physically erase all copies.

Published-media withdrawal/deletion follows the owning canonical system's semantics.

## Failure conditions

The policy fails closed if:

- provider private-payload retention is configured above 24 hours;
- expired provider payload access succeeds;
- quota handling silently deletes saved/pinned/published content;
- restore cannot reconcile deletion/tombstone state before serving;
- deletion cannot revoke application serving/indexing visibility immediately;
- private data remains beyond policy without a documented scoped hold;
- ordinary private backups exceed 30 days without a separately documented binding hold;
- Search/Indexer/Notifications resurrect deleted private state;
- private deletion is represented as erasing immutable public canonical history.

## Invariants

The machine-readable policy freezes **HZGCA-STORE-001 through HZGCA-STORE-018**.

Core guarantees include:

- provider private payload ≤24h;
- failed/cancelled private data ≤7d;
- unsaved generated takes/stems ≤30d;
- active private project inactivity window ≤365d;
- archive grace ≤30d;
- export package ≤24h;
- primary/replica/backup deletion bounds;
- anti-resurrection after restore/rebuild;
- case-scoped dispute retention;
- no quota-driven silent data destruction;
- immutable public history survives private-byte deletion as history only.

## Source reconciliation

This policy was reconciled against:

- HZ-GCA-1.7 privacy rules;
- the qualified 420AI `EncryptedPayloadStore420`, including its 24-hour default maximum;
- 420AI runtime recovery/idempotency semantics;
- Compute Market private workload and dispute-evidence boundaries;
- 420Resource storage authority boundaries;
- Search/Indexer public-projection constraints;
- Notifications private-delivery boundaries.

No new storage contract, address, provider or live deployment is asserted.

## HZ-GCA-1.8 exit criteria

HZ-GCA-1.8 is complete when:

- storage tiers and authority boundaries are explicit;
- provider/private/project/output/archive/export/evidence/audit/public-history retention periods are explicit;
- failed/cancelled/abandoned-project cleanup is explicit;
- deletion/tombstone/replica/backup/anti-resurrection behavior is explicit;
- quota, archive and export behavior is explicit;
- public immutable-history and external-storage exceptions are explicit without overclaiming authority;
- the targeted verifier passes against the exact implementation SHA;
- no ABI, deployment, live provider or testnet state is invented;
- parent HZ-GCA-1 remains open.

Next canonical work package after qualification:

**HZ-GCA-1.9 — Define generation economics**
