# EXP-0.4.1 — CI and qualification-workflow inventory

**Status:** implementation complete; exact-head qualification required.

## Objective

This step establishes the authoritative inventory of active qualification mechanisms that can support a 420Explorer claim. It deliberately distinguishes source/static evidence from deployment and live-network evidence.

## Findings

Six active workflows materially contribute to Explorer qualification:

1. **420Indexer** — primary Explorer/Indexer repository source and integration gate.
2. **420Explorer Live Testnet Validation** — manual Explorer-specific live target gate.
3. **420 Integrated Qualification** — repository-wide regression/build/Engine/fault/soak support.
4. **420Docs Qualification** — documentation and audit consistency support.
5. **Genesis Address Authority** — conditional frozen-address/predeploy/Solidity authority support when shared config/address surfaces are touched.
6. **420 Integrated Testnet RC** — manual network release-candidate support; not a substitute for Explorer live validation.

The machine-readable inventory expands these into 20 concrete mechanisms and records commands, environment requirements, artifacts, authority level, qualification scope, exclusions, finding references and acceptance-criterion references.

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
- repository, docs, address-authority or RC supporting gates drift from the recorded commands;
- workflow/mechanism identifiers are missing or duplicated;
- a workflow lacks scope, exclusions, authority, evidence, finding mapping or AC mapping fields;
- the inventory falsely labels a supporting workflow as Explorer live authority.

## Scope boundary

EXP-0.4.1 inventories and qualifies the CI/qualification machinery itself. It does **not** close any of the ten remaining Genesis-blocking findings, qualify a deployment, run the manual live workflow, or promote any Genesis acceptance criterion to satisfied.
