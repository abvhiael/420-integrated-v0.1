# CMP-4.2 — Research Project Registry

Status: **COMPLETE — Level 1 exact-head qualified on `8e4199c7d1e8b883a3518167a4093dae4899598a`.**

Canonical roadmap step: **CMP-4.2 — Research Project Registry**.

CMP-4.2 closes the first deferred authority point from CMP-4.1: a scientific work unit can now bind an exact, authoritative **research project revision commitment** rather than an arbitrary caller-supplied project hash.

## 1. Canonical responsibility

`ComputeResearchProjectRegistry420` owns only:

- canonical research-project identity;
- project owner/control address;
- nonzero research-domain commitment;
- nonzero immutable project-definition commitment per revision;
- append-only project revision history;
- whether the current revision accepts new scientific work;
- terminal project retirement;
- exact revision commitments used by CMP-4.1 scientific work units.

It does **not** own researcher/institution identity, datasets, execution environments, job lifecycle, worker selection, verification decisions, funding custody, rewards, settlement, disputes, publication/retention, governance, bridge, wallet or validator authority.

## 2. Project identity

A project ID is allocated only by the registry:

`projectId = keccak256(abi.encode(PROJECT_DOMAIN, block.chainid, address(registry), owner, uint64(nonce)))`

where:

`PROJECT_DOMAIN = keccak256("420/COMPUTE/RESEARCH_PROJECT/V1")`.

The nonce is monotonic per registry and failed registration does not consume it. Project IDs are therefore chain- and registry-bound and cannot be supplied by an arbitrary caller.

CMP-4.3 will add researcher/institution identity semantics. CMP-4.2 deliberately treats the owner as an address-level controller only and does not claim that an address represents a verified researcher or institution.

## 3. Revision model and project commitment

Each project revision stores:

- owner;
- `researchDomain`;
- `definitionCommitment`;
- predecessor commitment;
- creation/update observations;
- revision number;
- `acceptingNewWork`;
- ACTIVE/RETIRED status.

The exact project-revision commitment is:

`keccak256(abi.encode(COMMITMENT_DOMAIN, block.chainid, address(registry), projectId, owner, researchDomain, definitionCommitment, predecessorCommitment, revision, acceptingNewWork, status))`

with:

`COMMITMENT_DOMAIN = keccak256("420/COMPUTE/RESEARCH_PROJECT_COMMITMENT/V1")`.

Every successful mutation creates a new revision and stores the previous revision unchanged in history. No mutation overwrites an accepted historical project meaning.

## 4. Admission semantics

New scientific work must use:

`isCurrentAcceptable(projectId, revision, exactCommitment)`.

Admission succeeds only when:

- the project exists;
- status is ACTIVE;
- the current project accepts new work;
- the supplied revision is exactly current;
- the supplied commitment is nonzero and equals the registry-derived current commitment.

A pause, project revision or retirement therefore invalidates a stale project revision for **new** scientific-work admission without rewriting scientific units that already bound an older exact commitment.

## 5. Mutation authority

V1 mutation authority is deliberately narrow:

- anyone may register a project **only for themselves**;
- only that recorded project owner may revise, pause/resume new-work admission, or retire the project;
- stale expected revisions fail closed;
- retirement is terminal;
- there is no owner transfer, arbitrary admin setter, scheduler mutation, worker mutation, verifier mutation or governance takeover path in CMP-4.2.

Institutional delegation, verified researcher roles and identity recovery belong to CMP-4.3 rather than being guessed here.

## 6. Security and invariant behavior

Required behavior:

- zero research-domain or definition commitments reject before identity allocation;
- failed creation does not consume a project nonce;
- outsider mutation fails atomically;
- stale-revision mutation fails;
- revision history is immutable and linked by predecessor commitments;
- pause/resume is itself revisioned;
- exact current commitment is required for new-work admission;
- cross-project commitment replay fails;
- stale revision replay fails;
- retired projects cannot resume, revise or retire twice;
- historic commitments remain readable after pause, revision or retirement;
- project registration cannot create job/funding/reward/settlement authority.

Project definitions are commitments, not raw research data. Dataset bytes, private parameters, credentials, participant records and secret material remain off-chain/under later policy.

## 7. CMP-4.1 integration

CMP-4.1 `researchProjectCommitment` is now resolved as the exact commitment returned by this registry for the bound `projectId` and revision.

A conforming scientific-work-unit builder must validate the project with `isCurrentAcceptable` **before new work is admitted** and then freeze that exact commitment into the scientific unit. Later project revisions or retirement do not rewrite historical work-unit semantics.

The registry does not validate CMP-4.1's manifest, executable, dataset, parameter, resource, output-schema, verification, deadline or funding fields; their existing canonical owners remain unchanged.

## 8. Qualification boundary

CMP-4.2 is an ordinary **Level 1** step.

Required exact-head qualification:

- affected Compute contracts compile;
- retained `Compute*.t.sol` suite passes;
- dedicated project-registry tests cover identity, revision history, authorization, stale revision, pause/resume, retirement and replay;
- CMP-4.2 mechanical verifier passes;
- CMP-4.1 verifier remains compatible with the new authoritative project source;
- Compute Market Qualification passes the exact implementation SHA.

No Level 2 milestone is required yet. The registry is the first scientific-framework authority object, but it does not yet converge with researcher identity or dataset manifests. Level 3 remains CMP-4.10.

## 9. Intentionally deferred

- researcher/institution identity and delegated institutional control — CMP-4.3;
- dataset manifests — CMP-4.4;
- reproducible execution environments — CMP-4.5;
- result provenance — CMP-4.6;
- scientific metadata/lineage — CMP-4.7;
- publication/retention policy — CMP-4.8;
- research dashboard — CMP-4.9;
- comprehensive phase closeout — CMP-4.10;
- reward pools/sponsor economics — CMP-6;
- live scientific testnet demonstration — CMP-9.13.

## 10. Next canonical step

**CMP-4.3 — Researcher / institution identity**


## Qualification evidence

Retained exact-head qualification evidence: [CMP-4.2 qualification](CMP-4.2-QUALIFICATION-EVIDENCE.md). Compute Market Qualification **#400** / run `37405254531` passed on exact SHA `8e4199c7d1e8b883a3518167a4093dae4899598a`, including exact-head verification, Compute contract build, the retained `Compute*.t.sol` suite, verification-script compilation, and the CMP-4.2 verifier.
