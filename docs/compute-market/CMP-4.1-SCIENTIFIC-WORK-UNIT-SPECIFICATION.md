# CMP-4.1 — Scientific Work Unit specification

Status: **IMPLEMENTED — LEVEL 1 EXACT-HEAD QUALIFICATION PENDING.**

Canonical roadmap purpose: make scientific/research workloads first-class while keeping the Compute Market general-purpose.

CMP-4.1 does **not** create a second job registry, a new work-unit identity, a research-project registry, new custody, a reward pool, a verifier authority, or a live deployment. It specifies the scientific binding layered over the already-canonical Compute job, request, accepted match, CMP-0.3 work-unit identity, signed execution manifest, funding evidence and verification policy.

## 1. Canonical definition

Every scientific work unit MUST bind all nine roadmap items:

1. **research project** — a nonzero immutable `researchProjectCommitment`;
2. **executable/container commitment** — `executableContainerCommitment`, derived from the accepted signed manifest/runtime profile and exact executable/container bytes;
3. **dataset/input commitment** — the canonical accepted `datasetInputCommitment`, equal to the job/request input commitment for this unit;
4. **parameters** — a nonzero `parametersCommitment` over a versioned canonical parameter schema;
5. **resource class** — the accepted `resourceClass` from the request/match constraints;
6. **output schema** — the accepted `outputSchemaCommitment`;
7. **verification strategy** — the frozen `verificationStrategyCommitment`, equal to the accepted verification-policy commitment and, where scientific sampling is used, consistent with the exact pre-execution scientific adapter binding;
8. **deadline** — the accepted effective execution deadline; it may narrow but never extend the canonical job/request deadline;
9. **reward/funding reference** — the real canonical `fundingRef`; it is evidence of authorized backing, not a self-reported reward entitlement.

The scientific binding additionally carries the pre-existing canonical `unitId`, schema version and chain ID so it cannot be transplanted to another unit or chain.

## 2. ScientificWorkUnitV1 commitment

Define:

`SCIENTIFIC_UNIT_DOMAIN_V1 = keccak256(utf8("420Integrated.ComputeMarket.ScientificWorkUnit.v1"))`.

For schema version 1, the ordered static ABI tuple is:

```
(bytes32 domain,
 uint32 schemaVersion,
 uint256 chainId,
 bytes32 unitId,
 bytes32 researchProjectCommitment,
 bytes32 manifestHash,
 bytes32 executableContainerCommitment,
 bytes32 datasetInputCommitment,
 bytes32 parametersCommitment,
 bytes32 resourceClass,
 bytes32 outputSchemaCommitment,
 bytes32 verificationStrategyCommitment,
 uint64 deadline,
 bytes32 fundingRef)
```

The scientific commitment is:

`scientificWorkUnitCommitment = keccak256(abi.encode(the ordered tuple above))`.

Use standard Solidity ABI encoding, not `abi.encodePacked`, JSON serialization, concatenated strings, local timestamps, scheduler IDs or SHA3-256. All bytes32 binding fields are nonzero, `schemaVersion == 1`, `chainId != 0`, and `deadline > 0`.

This commitment is an **overlay commitment**. It does not replace the canonical CMP-0.3 `unitId`; receipts, attempts, worker execution and settlement continue to use the canonical unit/job identities.

## 3. Canonical source-of-truth rules

A scientific-work-unit builder MUST resolve authoritative values rather than trusting caller-supplied duplicates:

| Scientific field | Canonical source / rule |
| --- | --- |
| `unitId` | CMP-0.3 derivation from accepted job/manifest/partition/replica state. |
| `researchProjectCommitment` | Exact `ComputeResearchProjectRegistry420` project-revision commitment. New scientific work validates the current ACTIVE accepting revision with `isCurrentAcceptable` before freezing that exact commitment. |
| `manifestHash` | Canonical accepted job/request manifest commitment. |
| `executableContainerCommitment` | Exact accepted `ComputeExecutionEnvironmentRegistry420` revision commitment for scientific work; its artifact/runtime/dependency/command/platform/sandbox/reproducibility fields correspond to the accepted CMP-0.4 signed manifest, and `isCurrentReproducible` must pass before new work is admitted. |
| `datasetInputCommitment` | Must equal the accepted canonical job/request input commitment. For dataset-backed scientific work, CMP-4.4 additionally requires an exact current `ComputeDatasetManifestRegistry420` manifest whose `contentCommitment` equals this input commitment and whose `isCurrentUsable` admission check succeeds. |
| `parametersCommitment` | Hash of an explicit versioned parameter encoding. Display metadata or mutable JSON URLs are not authoritative parameters. |
| `resourceClass` | Accepted request/match resource class; a scheduler cannot substitute another class. |
| `outputSchemaCommitment` | Accepted job output schema commitment. |
| `verificationStrategyCommitment` | Accepted verification-policy commitment. Scientific/probabilistic jobs additionally preserve the exact CMP-1.4.8 adapter protocol/binding semantics. |
| `deadline` | Effective accepted execution deadline and never later than the canonical job/request deadline. |
| `fundingRef` | Existing canonical funded-job evidence. It cannot be invented by the scientific layer and is not proof that a future research reward pool exists. |

If an accepted source changes, the existing scientific commitment is historical evidence only. Material changes require a newly authorized request/match/job/unit according to existing lifecycle rules.

## 4. Authority and safety boundaries

CMP-4.1 MUST preserve these boundaries:

- a research-project commitment grants no requester, payer, worker, verifier, scheduler, Vault, settlement, stake/slash, governance, bridge, wallet or validator authority;
- a scientific commitment does not prove that a project or researcher is legitimate; CMP-4.2 and CMP-4.3 own those registries/identity semantics;
- dataset bytes, credentials, private parameters and secrets are not stored in the canonical commitment;
- a dataset/input commitment does not itself grant data-access authority;
- an executable/container hash does not waive the CMP-3 sandbox, malicious-workload, resource-control or content-addressed retrieval requirements;
- verification strategy is frozen before execution and cannot be selected by the worker after seeing a result;
- sampled/probabilistic PASS means only that the exact accepted protocol passed, never full scientific truth;
- `fundingRef` proves only the existing canonical funding relationship; rewards and research pools remain CMP-6;
- no scientific field can broaden the accepted maximum spend, provider eligibility, resource constraints, privacy policy, deadline or verification policy;
- schedulers and workers may transport the binding but cannot authoritatively rewrite it.

## 5. Validation and fail-closed behavior

A conforming CMP-4.1 consumer rejects:

- zero/unsupported schema version or zero chain ID;
- zero `unitId` or any required commitment;
- a unit ID inconsistent with the accepted job/partition/replica state;
- project commitment substitution after acceptance;
- manifest or executable/container commitment drift;
- dataset/input mismatch against the canonical job/request;
- unversioned or mutable parameter interpretation;
- resource class mismatch against the accepted request/match;
- output-schema mismatch;
- verification-policy mismatch or post-result strategy selection;
- a deadline that exceeds the accepted job/request/match deadline;
- zero, unrelated, duplicate or self-reported funding evidence;
- cross-chain replay or cross-unit reuse of the same scientific commitment;
- treating the scientific commitment itself as authorization, correctness, settlement, reward or slashing evidence.

Rejection must not allocate a new job/unit, consume payer funds, create a worker entitlement, mutate verification state, or create a settlement entitlement.

## 6. Relationship to existing scientific verification

CMP-1.4.8 already provides scientific/probabilistic verification adapters, pre-execution sampling commitments and explicit `INCONCLUSIVE/PASS/FAIL` evidence. CMP-4.1 binds a scientific unit to the **accepted verification strategy**, but does not duplicate or supersede that verifier machinery.

Where a CMP-1.4.8 route is used, its workload/profile/schema/protocol/adapter-code binding must be consistent with the job's frozen verification policy and this scientific unit. A worker cannot substitute a different adapter family, protocol revision or output schema.

## 7. Forward dependencies without premature implementation

CMP-4.1 freezes the interface points required by later canonical steps:

- **CMP-4.2 Research Project Registry:** now resolves `researchProjectCommitment` to an exact revisioned project commitment and current new-work admission state;
- **CMP-4.3 Researcher / institution identity:** authenticates project actors without changing job authority;
- **CMP-4.4 Dataset manifests:** now binds `datasetInputCommitment` to an exact current project-bound dataset manifest while leaving raw bytes and access authorization off-chain;
- **CMP-4.5 Reproducible execution environments:** now resolves `executableContainerCommitment` to an exact current project-bound environment revision while CMP-0.4/CMP-3 retain execution authority;
- **CMP-4.6 Result provenance:** links committed outputs and receipts to scientific units;
- **CMP-4.7 Scientific metadata and lineage:** links derived units/results;
- **CMP-4.8 Publication / retention policy:** defines disclosure/retention semantics;
- **CMP-4.9 Research dashboard:** consumes these records;
- **CMP-4.10 Phase closeout:** performs the accumulated Level 3 qualification.

None of those future implementations is claimed complete here.

## 8. Level 1 qualification and exit criteria

CMP-4.1 is complete when one exact implementation/specification SHA proves:

1. all nine roadmap bindings are explicitly present and nonzero/bounded;
2. the scientific commitment is domain-separated, versioned, chain-bound and unit-bound;
3. source-of-truth ownership is mapped to existing canonical job/request/match/manifest/funding/verification state;
4. scientific metadata cannot become alternate lifecycle, authorization, custody, settlement, reward or correctness authority;
5. negative/boundary rules cover substitution, replay, zero fields, deadline widening, policy drift, funding fabrication and cross-unit/cross-chain reuse;
6. CMP-1.4.8 scientific verification semantics remain distinct and compatible;
7. machine-readable configuration and mechanical verifier/test are committed;
8. the affected Compute Market Level 1 workflow passes the exact implementation SHA.

No Level 2 milestone is required at CMP-4.1. The first scientific-framework integration milestone should occur when multiple CMP-4 objects converge; Level 3 remains CMP-4.10.

## 9. Intentionally deferred

- researcher/institution identity — CMP-4.3;
- scientific result provenance and lineage — CMP-4.6/CMP-4.7;
- publication/retention enforcement — CMP-4.8;
- dashboard/API/indexer user surfaces — later CMP-4.9/CMP-7/CMP-8;
- research reward pools and sponsor economics — CMP-6;
- live scientific workload demonstration — CMP-9.13;
- repository-wide Level 3 qualification — CMP-4.10.

## 10. Next canonical step

**CMP-4.2 — Research Project Registry**
