# ID-AUDIT-6 — Indexer/Search/Explorer compatibility

**Status:** IMPLEMENTED — Level 1 + Level 2 qualification pending exact-head CI  
**Repository:** `abvhiael/420-integrated-v0.1`  
**Working PR:** #438  
**Canonical roadmap:** `docs/audit/420IDENTITY-AUDIT-REMEDIATION-ROADMAP.md`

## Original step

ID-AUDIT-6 requires proof that every Identity event and object key consumed by
derived services matches the final contract ABI and lifecycle.

Required test coverage:

- profile creation/update/controller transfer;
- primary-name changes;
- issuer mutation;
- issuance/revocation/rejection;
- reorg/replay/rebuild behavior;
- inactive profile suppression in public Search;
- privacy boundary for metadata commitments.

**Exit criterion:** exact-head derived-service qualification evidence.

## Gap analysis

The final ID-AUDIT-4 artifact already exposed all nine canonical Identity events
and 420Indexer could derive ABI event descriptors from it.

However, the production protocol-object SQL projection and the shared TypeScript
object-key helper were incomplete for Identity:

- `profileId` was recognized;
- `issuerId` was not recognized;
- `credentialId` was not recognized;
- credential events therefore could not receive the canonical credential object key;
- issuer mutation could not receive the canonical issuer object key;
- the SQL lifecycle projection had no explicit Identity event semantics.

Search already had a profile-history reducer, inactive-profile suppression and a
metadata-commitment-only presentation boundary. Those behaviors required stronger
controller-transfer/reactivation/rebuild/privacy tests.

Explorer's architecture intentionally does not own an Identity decoder/database.
It consumes shared Indexer/raw-log projections and keeps Identity as optional
display enrichment. Compatibility therefore means preserving Identity raw event
provenance and commitments without inventing canonical Identity authority or
dereferencing protected metadata.

## Implementation

### 420Indexer

Updated:

- `420-indexer/src/lifecycle-reducer.ts`
- `420-indexer/sql/005-genesis-state-views.sql`

Added:

- `420-indexer/test/identity420-compatibility.test.ts`

Canonical protocol object keys are now:

- profile events → `profileId:<bytes32>`;
- credential events → `credentialId:<bytes32>`;
- issuer mutation → `issuerId:<bytes32>`.

Credential identity is deliberately prioritized ahead of `issuerId` on events
such as `CredentialIssued` and `CredentialRevoked`.

The production SQL projection now assigns explicit Identity event lifecycle labels:

- `ProfileCreated` → `ACTIVE`;
- `ProfileUpdated` → `ACTIVE` or `INACTIVE` from the event flag;
- `PrimaryNameSet` → `PRIMARY_NAME_UPDATED`;
- `ProfileControllerTransferStarted` → `PENDING_CONTROLLER_TRANSFER`;
- `ProfileControllerTransferred` → `CONTROLLER_TRANSFERRED`;
- `IssuerSet` → `ACTIVE` / `INACTIVE` / `ISSUER_UPDATED`;
- `CredentialIssued` → `ACTIVE`;
- `CredentialRevoked` → `REVOKED`;
- `CredentialRejected` → `REJECTED`.

These are non-authoritative projection labels. Canonical validity remains in
`Identity420`.

The focused Indexer test proves:

- exact nine-event descriptor set from the retained final artifact;
- topic/signature/address/protocol parity;
- profile/issuer/credential key selection;
- commitment hashes remain hashes rather than payloads;
- replay idempotence and fork-sensitive supersession through the retained
  canonicality tracker;
- production SQL contains the required key/lifecycle projection.

### 420Search

Added:

- `search/discovery/id_audit_6_identity_test.go`

The retained Search implementation continues to reconstruct public profile state
from canonical Identity event history rather than treating the latest projection
row as full canonical state.

Qualification covers:

- profile creation;
- controller-transfer completion;
- primary-name changes;
- deactivate/reactivate behavior;
- deterministic rebuild from canonical event history;
- cross-object replay rejection;
- inactive-profile suppression;
- metadata commitments displayed only as commitments;
- injected `metadataPayload` fields never appear in public Search output.

### 420Explorer

Added:

- `explorer/service/id_audit_6_identity_test.go`

Explorer remains intentionally non-authoritative and does not gain an independent
Identity state database or ABI-decoder authority.

Qualification proves:

- Identity logs at frozen `0x0436` preserve block/transaction/log provenance;
- raw topics/data and decoder provenance survive Explorer presentation;
- public commitment bytes remain raw public chain data;
- malformed/non-hex payload-like data fails closed instead of being interpreted
  as private Identity metadata.

## Mechanical verifier

Added:

`scripts/verify-id-audit-6-derived-services.py`

It verifies mechanically:

1. final artifact contract/address identity;
2. exact nine-event ABI set and field order;
3. Indexer profile/credential/issuer object-key coverage;
4. credential-before-issuer key precedence;
5. explicit SQL Identity lifecycle mapping;
6. focused reorg/replay/privacy coverage exists;
7. Search production reducer covers canonical public profile events;
8. Search production code does not consume `metadataPayload` or `claimPayload`;
9. Search Genesis profile excludes private Identity data and forbids commitment
   visibility from authorizing payload recovery;
10. Explorer remains non-canonical and Identity is display enrichment only;
11. Explorer raw-event authority/privacy tests remain present.

## Qualification model

ID-AUDIT-6 is a **Level 1 step-specific qualification** and also a sensible
**Level 2 Identity integration milestone** because this is the first canonical
roadmap point where the final contract ABI/artifact converges with all three
derived-service layers.

### Level 1 focused checks

- mechanical compatibility verifier;
- focused final-artifact/descriptor tests;
- focused object-key/lifecycle tests;
- event canonicality/reorg tests;
- protocol-object/query tests;
- focused Search Identity tests;
- focused Explorer Identity tests.

### Level 2 retained app-integration checks

- complete `420-indexer` package test suite;
- complete `search/...` Go test suite;
- complete `explorer/...` Go test suite;
- `go vet ./search/...`;
- `go vet ./explorer/...`.

This milestone does not substitute for live deployment evidence.

## Level 3 disposition

Full current-main reconciliation, repository-wide Solidity/Genesis inventories,
global docs/security qualification and final cross-app release qualification remain
intentionally deferred to **ID-AUDIT-10 — phase closeout, reconciliation and retained evidence**.

Live deployed Indexer/Search/Explorer behavior remains ID-AUDIT-9 scope.

## Exact-head qualification evidence

Pending.

## Completion state

**PENDING LEVEL 1 + LEVEL 2 EXACT-HEAD QUALIFICATION**

Next canonical step after successful closeout:

**ID-AUDIT-7 — Wallet/user-facing Identity workflow**
