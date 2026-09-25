# EXP-0.2.2 — Genesis user-workflow acceptance matrix

**Status:** workflow inventory and acceptance mapping committed; exact-head CI qualification required before closeout.  
**Predecessor:** EXP-0.2.1 required Genesis capability matrix.  
**Scope:** map the fifteen practical user scenarios from the originating Explorer audit to the actual Explorer source surface, identify unsupported or partial workflows, assign later qualification owners, and prohibit premature runtime claims.

The machine-readable register is `docs/audit/EXP-0.2.2-user-workflow-matrix.json`.

## Qualification rule

EXP-0.2.2 is a **workflow acceptance-definition** milestone, not a claim that the workflows are already live. The originating audit requires every scenario to include an objective, prerequisites, exact workflow, expected result and limitations, and it forbids describing an interaction as executable without implementation and runtime evidence. This record therefore separates:

- `source_support`: whether an execution path is visible in the repository;
- `runtime_status`: whether that path has been demonstrated against a running target network;
- `execution_claim`: whether the workflow may currently be presented as runtime-qualified;
- `acceptance_status`: whether later qualification can proceed on the current source path or implementation work is first required.

Every workflow remains `runtime_status: unverified` and `execution_claim: not_runtime_qualified` at EXP-0.2.2.

## Required fifteen workflows

The matrix contains exactly the fifteen audit scenarios:

1. verify receipt of a native 420 transfer;
2. confirm success or failure of a transaction;
3. inspect transaction fees;
4. review wallet activity;
5. locate and examine a smart contract;
6. verify a contract deployment;
7. track token transfers;
8. inspect validator-produced blocks;
9. investigate a failed contract interaction;
10. confirm an ecosystem application transaction;
11. verify an on-chain payment;
12. review publicly available staking or reward activity;
13. examine contract events;
14. confirm an application's published contract address;
15. use Explorer data during troubleshooting or development.

## Source-supported workflows

The current source provides strong direct presentation paths for native transfer facts, success/revert status, contract-deployment provenance, Registry-published implementation lookup and general troubleshooting views. These remain runtime-unverified.

Several other workflows are intentionally classified `partial_source`:

- transaction fees: `gasUsed` exists, but the inspected transaction/receipt model has no effective gas price or actual fee field;
- wallet activity: address transaction history exists, but balances/token holdings are not established by the current address view;
- contract location: the contract route exists, but global search routes a 20-byte value to the address page rather than resolving account type first;
- token transfer tracking: asset activity exists, but the web page does not expose the API's asset/address filters and decoder coverage remains unqualified;
- failed contract interactions: raw input/status/log provenance exists, but no revert reason or ABI-aware call decoding is presented;
- ecosystem-application transactions and payments: generic chain facts can be correlated with Registry/transfer data, but Explorer does not infer application-specific semantics;
- contract events: log provenance exists, but the current web table does not display full topic values/data or ABI-decoded event fields.

## Confirmed workflow gaps

Two requested scenarios cannot currently be claimed implemented from the inspected source:

### Validator-produced blocks

`indexer/model.BlockRecord` does not include a proposer/validator identity. The consensus view exposes scheduled/current consensus information, but the inspected Explorer source does not map a historical block to its producer. The workflow is therefore `not_observed` and requires implementation under later indexing/service/UI milestones.

### Staking or reward activity

No staking/reward-specific Explorer route or presentation model is established in the current API/web surface. Generic address/asset history and consensus status are insufficient evidence for this workflow. It is therefore `not_observed` and assigned to later service/protocol/ecosystem/UI work.

## Later milestone ownership

The matrix assigns each workflow to one or more later milestones:

- **EXP-1** for missing chain/indexing provenance such as historical block-producer identity;
- **EXP-2** for Explorer data models, API correctness and missing fields such as fee/staking data;
- **EXP-3** for ABI/Registry/protocol decoding and contract-event semantics;
- **EXP-4** for user-visible workflow completion, search/navigation and presentation;
- **EXP-5** for application/payment/staking ecosystem correlation;
- **EXP-6** for troubleshooting/reliability exercises;
- **EXP-7** for production-equivalent and live-network witness qualification.

EXP-0.2.2 does not implement those later capabilities.

## Automated gate

`scripts/verify-exp-0-2-2-user-workflows.py` fails closed unless:

1. all fifteen required scenario names are present exactly once;
2. every workflow contains objective, prerequisites, user path, expected result, limitations, capability references, evidence, later owners and required tests;
3. every referenced EXP-0.2.1 capability ID exists;
4. every repository evidence path exists;
5. runtime status remains `unverified` and execution claims remain `not_runtime_qualified`;
6. source/acceptance status values are valid;
7. `not_observed` workflows are marked as implementation gaps;
8. the known fee, validator-produced-block and staking/reward limitations remain represented;
9. supported/partial workflows identify concrete Explorer routes or APIs;
10. the matrix never treats Explorer as payment, Registry, staking or consensus authority.

The verifier writes `exp-0-2-2-evidence/summary.json` and `workflows.tsv`, which CI uploads as the milestone artifact.

## Completion condition

EXP-0.2.2 is qualified when the dedicated verifier and the existing Explorer/Indexer regression suite pass on the same exact PR head and the evidence artifact is uploaded. Qualification means the fifteen workflows are completely and honestly mapped to present source support and later qualification owners. It does not mean the workflows are live or Genesis-qualified.
