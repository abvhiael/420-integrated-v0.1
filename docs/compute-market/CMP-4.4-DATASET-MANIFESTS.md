# CMP-4.4 — Dataset manifests

Status: **COMPLETE — Level 1 exact-head qualified on `8e4199c7d1e8b883a3518167a4093dae4899598a`.**

Canonical roadmap step: **CMP-4.4 — Dataset manifests**.

CMP-4.4 gives scientific jobs a canonical, revisioned description of the dataset semantics behind the already-existing CMP-4.1 `datasetInputCommitment` without putting raw datasets, unrestricted locations, credentials or access grants on chain.

## 1. Canonical responsibility

`ComputeDatasetManifestRegistry420` owns only:

- canonical dataset-manifest identity;
- exact research-project binding;
- immutable content commitment used as the scientific job input commitment;
- schema commitment;
- access-policy commitment;
- provenance commitment;
- partition/layout commitment;
- bounded total byte length;
- append-only manifest revision history;
- local active/inactive admission state.

It does **not** store raw dataset bytes, URLs, bearer tokens, encryption keys, participant records, credentials, licenses or secret metadata.

It grants no dataset-read capability, project ownership, job lifecycle, worker selection, verifier correctness, funding, custody, settlement, reward, slashing or governance authority.

## 2. Dataset identity

A dataset ID is allocated only by the registry:

`datasetId = keccak256(abi.encode(DATASET_DOMAIN, block.chainid, address(registry), projectId, controller, nonce))`

where:

`DATASET_DOMAIN = keccak256("420/COMPUTE/DATASET_MANIFEST/V1")`.

The nonce is monotonic. Failed registration does not consume it. Caller-supplied dataset IDs are not accepted.

The initial controller must be the current CMP-4.2 project owner. CMP-4.4 does not invent a separate dataset-owner transfer system.

## 3. Manifest fields and commitment

Every manifest revision contains:

- controller;
- project ID;
- exact project revision and project commitment;
- dataset content commitment;
- schema commitment;
- access-policy commitment;
- provenance commitment;
- partition/layout commitment;
- total byte length;
- predecessor commitment;
- manifest revision;
- active state.

The exact manifest-revision commitment is domain-separated and binds chain ID, manifest registry, project registry, dataset ID and every field above.

Raw retrieval locators remain off-chain and may rotate without changing immutable content identity. Hashes are not treated as confidentiality by themselves.

## 4. CMP-4.1 integration

CMP-4.1 keeps its existing invariant:

`datasetInputCommitment == accepted canonical job/request input commitment`.

For a scientific dataset-backed unit, CMP-4.4 requires that exact input commitment to equal the current manifest's `contentCommitment`.

Before admitting **new** scientific work, the builder validates:

`isCurrentUsable(datasetId, manifestRevision, exactManifestCommitment, datasetInputCommitment)`.

That check succeeds only when:

- the manifest exists and is active;
- the supplied manifest revision is exactly current;
- the supplied manifest commitment is exact and nonzero;
- `datasetInputCommitment` exactly equals the manifest content commitment;
- the manifest still binds the exact current CMP-4.2 project revision accepted for new work.

A project revision, project pause/retirement, dataset revision, or dataset deactivation therefore fails closed for new work. Historical scientific units keep their already-frozen commitments and are not rewritten.

## 5. Access and privacy boundary

A valid manifest proves only that the submitted scientific input is bound to an exact manifest and content commitment. It does **not** grant anyone permission to retrieve or decrypt the bytes.

Actual access remains independently authorized off-chain under the committed access policy and existing CMP privacy/security rules:

- encrypted authenticated transport/storage where required;
- least-privilege object/purpose/time scope;
- explicit revocation/expiry;
- no raw dataset, credential, secret or unrestricted locator in canonical state;
- no assumption that a content hash hides low-entropy private data.

CMP-4.8 later owns publication/retention policy. CMP-4.4 only commits the access-policy semantics required for reproducibility/admission.

## 6. Mutation and lifecycle rules

- only the current project owner/controller may register or mutate a manifest;
- all mutations require the exact current manifest revision;
- manifest revision history is append-only and predecessor-linked;
- content/schema/access/provenance/partition/size changes require a new manifest revision;
- project revision drift requires an explicit manifest refresh before new-work admission;
- local deactivate is always allowed by the controller;
- reactivation requires the bound project revision still be current and accepting new work;
- no-op revisions and no-op activation changes fail.

CMP-4.4 does not delete historical commitments when a dataset or project becomes unavailable.

## 7. Security and adversarial behavior

Required fail-closed cases include:

- zero content/schema/access/provenance/partition commitments;
- zero byte length;
- invalid or stale project commitment;
- registration by a non-project owner;
- outsider mutation;
- stale manifest revision;
- cross-dataset manifest commitment replay;
- wrong `datasetInputCommitment`;
- project revision drift;
- project new-work pause or retirement;
- local dataset deactivation;
- no-op mutation;
- attempting to interpret manifest validity as access, correctness or payment authority.

## 8. Qualification boundary

CMP-4.4 is an ordinary **Level 1** step.

Required exact-head qualification:

- affected Compute contracts compile;
- dedicated `ComputeDatasetManifestRegistry420.t.sol` tests pass;
- retained CMP-4.1, CMP-4.2 and CMP-4.3 verifiers remain compatible;
- CMP-4.4 mechanical verifier passes;
- the app-specific Compute Market qualification covers the exact implementation SHA.

This is the first point where project, scientific-input and dataset-manifest semantics converge, but no broader cross-service dependency is introduced. Level 2 is therefore still deferred. Level 3 remains CMP-4.10.

## 9. Intentionally deferred

- result provenance — CMP-4.6;
- scientific metadata and lineage — CMP-4.7;
- publication / retention policy — CMP-4.8;
- research dashboard — CMP-4.9;
- comprehensive scientific-framework closeout — CMP-4.10;
- SDK/API/indexer expansion — CMP-7;
- user-facing Compute application — CMP-8;
- live scientific testnet demonstration — CMP-9.13.

## 10. Next canonical step

**CMP-4.5 — Reproducible execution environments**


## Qualification evidence

Retained exact-head qualification evidence: [CMP-4.4 qualification](CMP-4.4-QUALIFICATION-EVIDENCE.md). Compute Market Qualification **#400** / run `37405254531` passed on exact SHA `8e4199c7d1e8b883a3518167a4093dae4899598a`, including exact-head verification, Compute contract build, the retained `Compute*.t.sol` suite, verification-script compilation, and the CMP-4.4 verifier.
