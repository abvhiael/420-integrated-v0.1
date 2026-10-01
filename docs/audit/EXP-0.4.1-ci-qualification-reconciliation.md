# EXP-0.4.1 — CI and qualification-workflow inventory

**Status:** QUALIFIED at repository scope; final closeout head requalification required after evidence recording.

## Objective

This step establishes the authoritative inventory of active qualification mechanisms that can support a 420Explorer claim. It deliberately distinguishes source/static evidence from deployment and live-network evidence.

## Findings

Eight active workflows materially contribute to Explorer qualification:

1. **420Indexer** — primary Explorer/Indexer repository source and integration gate.
2. **420Explorer Live Testnet Validation** — manual Explorer-specific live target gate.
3. **420 Integrated Qualification** — repository-wide regression/build/Engine/fault/soak support.
4. **420Docs Qualification** — documentation and audit consistency support.
5. **Genesis Address Authority** — conditional frozen-address, namespace, collision and predeploy authority support when shared config/address surfaces are touched. It does **not** own or duplicate repository-wide Foundry qualification.
6. **420 Integrated Testnet RC** — manual network release-candidate support; not a substitute for Explorer live validation.
7. **420Explorer EXP-NEXT.4 Repository Readiness** — repository-readiness and live-blocker integrity support.
8. **Solidity Contracts** — canonical owner of the complete repository Foundry inventory, using four runner-aware deterministic shards.

The machine-readable inventory expands these into 22 concrete mechanisms and records commands, environment requirements, artifacts, authority level, qualification scope, exclusions, finding references and acceptance-criterion references.

## Evidence semantics

- Green source CI proves only its recorded source/static/integration scope.
- The Explorer live workflow is manual and has no evidentiary force until run against an approved deployment with its exact inputs and commit recorded.
- The integrated repository workflow is strong regression evidence but cannot prove Explorer deployment, target-network binding, Registry publication or live consensus-provider composition.
- `if: always()` artifact upload means only that evidence packaging was attempted. Artifact existence cannot convert a failed/skipped verifier into a pass.
- EXP-0.1.1 intentionally remains pinned to `95a83a961286701b6e8c064de1deccad10f41fd7`; it is historical pinned-tree inventory evidence, not current-tree proof.
- The Testnet RC workflow proves network/release-candidate properties when manually executed, but does not execute the Explorer-specific live validator.

## Qualification implementation

`scripts/verify-exp-0-4-1-ci-inventory.py` fails closed if:

- any of the six active workflow files disappears;
- required workflow names/triggers/commands drift;
- the primary gate no longer executes the retained Explorer/Indexer test and EXP verifier chain;
- the live workflow loses its unit/live validator commands or evidence upload;
- repository, docs, address-authority, canonical Solidity-inventory or RC supporting gates drift from the recorded commands;
- Genesis regains a duplicate Foundry inventory or Solidity Contracts loses canonical full-inventory ownership;
- workflow/mechanism identifiers are missing or duplicated;
- a workflow lacks scope, exclusions, authority, evidence, finding mapping or AC mapping fields;
- the inventory falsely labels a supporting workflow as Explorer live authority.

## Scope boundary

EXP-0.4.1 inventories and qualifies the CI/qualification machinery itself. Repository-wide Foundry qualification has one canonical owner: **Solidity Contracts**. **Genesis Address Authority** is limited to address/namespace/predeploy authority checks and must not duplicate that Foundry inventory. It does **not** close any of the ten remaining Genesis-blocking findings, qualify a deployment, run the manual live workflow, or promote any Genesis acceptance criterion to satisfied.


## Exact-head qualification evidence

The corrected implementation head `388a5ba873efc9381d11975f8963b3532f287b58` passed the complete required qualification set:

- 420Indexer #604 — run `36268479103` — success.
- 420Docs Qualification #2909 — run `36268479095` — success.
- 420 Integrated Qualification #5526 — run `36268479127` — success.
- EXP-0.4.1 evidence artifact `10914652783`.
- Evidence digest: `sha256:3e9cddc0fd2111f75c2456c4491faaeac032f3cf761b5d009d82529922846750`.

The first attempt exposed only an EXP-0.4.1 verifier assertion defect: a supporting-authority label containing the words `live_authority` was incorrectly treated as the exact live-authority designation. All retained EXP-0.1–0.3 checks were green in that run. The assertion was corrected to compare the exact authority value and the complete suite was rerun successfully.

Because adding this evidence changes the repository SHA, the resulting final closeout head is requalified before EXP-0.4.1 is marked COMPLETE.
