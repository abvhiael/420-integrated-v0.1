# EXP-0.2.1 — required Genesis capability matrix

**Status:** implementation/classification record committed; exact-head CI qualification required before closeout.  
**Baseline:** `main` after merged EXP-0.1, commit `0b35683920e126d9507658e2fff47e9aeea13fdd`.  
**Normative inputs:** `contracts/config/420explorer-genesis.json` and frozen `config/genesis-applications.json`.  
**Evidence inputs:** merged EXP-0.1.2 Indexer dependency reconciliation and EXP-0.1.3 contract/ABI/address reconciliation.

## Objective

EXP-0.2.1 converts the source inventories from EXP-0.1 into a single, machine-checkable capability register. It answers one narrow question: **what capabilities are mandatory for 420Explorer at Genesis, which dependencies merely support those capabilities, which enrichments are optional, and which functions are outside Explorer authority?**

This milestone does not prove live deployment, testnet correctness, UI completeness, performance, or end-to-end Genesis readiness. Those remain later EXP gates.

The machine-readable register is `docs/audit/EXP-0.2.1-genesis-capability-matrix.json`.

## Classification rules

The register uses six classifications:

- `mandatory_genesis` — explicitly listed in the dedicated Explorer Genesis profile's `requiredViews`.
- `shared_supporting_dependency` — infrastructure required to provide those views without becoming an Explorer-owned capability or canonical authority.
- `optional_display_enrichment` — explicitly optional presentation enrichment whose absence must not block the core Explorer Genesis scope.
- `post_genesis_enhancement` — reserved for desirable later features when an authoritative requirement does not make them Genesis-mandatory. No capability is assigned here merely to make the matrix exhaustive.
- `explicitly_out_of_scope` — functionality prohibited by the Explorer trust boundary or owned by another Genesis application/protocol.
- `scope_decision_required` — conflicting or incomplete authoritative scope that must be resolved during EXP-0 rather than guessed.

Implementation, runtime, and qualification status are separate fields. `implemented_source` means a repository execution path was found; it does **not** mean deployed or Genesis-qualified.

## Mandatory Genesis views

The dedicated profile contains ten `requiredViews`, and the matrix carries exactly those ten as `mandatory_genesis`:

| Capability | Explorer surface | Shared Indexer source | Current source disposition |
| --- | --- | --- | --- |
| block | `/v1/blocks`, `/v1/blocks/{number}` | blocks + block logs | implemented in source; live correctness unverified |
| transaction | `/v1/transactions/{hash}` | transaction + receipt | implemented in source; live correctness unverified |
| receipt/logs | `/v1/receipts/{hash}`, block detail | receipt + block logs | implemented in source; live correctness unverified |
| address | `/v1/addresses/{address}` | address-filtered transaction projection | implemented in source; live correctness unverified |
| contract | `/v1/contracts/{address}` | indexed contract record | implemented in source; live correctness unverified |
| token/asset activity | `/v1/assets/activity` | asset-transfer projection | implemented in source; live correctness unverified |
| validator | `/v1/consensus` | consensus projection | implemented in source; deployed backend wiring unverified |
| epoch/rotation | `/v1/consensus` | consensus projection | implemented in source; deployed backend wiring unverified |
| protocol service/version | service list/detail/version routes | Registry-backed decoder catalogue | implemented in source; live Registry provenance unverified |
| network status | `/v1/status`, `/v1/ready` | `/v1/health` | implemented in source; live freshness/network evidence unverified |

This mapping deliberately preserves the EXP-0.1 finding that the seven core `IndexerReader` methods are not sufficient by themselves: address, assets, contracts, consensus and Registry views depend on additional capability interfaces.

## Supporting dependencies

`420Indexer /v1` is mandatory shared infrastructure, but it is not canonical state and is not an Explorer-owned ingestion engine. The matrix therefore classifies it as a `shared_supporting_dependency`, with source coverage established and deployed serving/data still pending later qualification.

The 420Registry-backed service/version projection is also a shared dependency. Explorer reads Indexer DTOs; it does not acquire Registry publication authority or own Registry state.

## Optional enrichments

The dedicated Genesis profile explicitly identifies 420 Names and 420 Identity as optional display enrichments. EXP-0.2.1 therefore records both as `optional_display_enrichment`. No direct Names or Identity lookup path was established in EXP-0.1, and their absence is not converted into a core Explorer blocker.

## Explicitly excluded authority

The matrix records the following as outside the Explorer Genesis capability set:

- an Explorer-specific Genesis smart contract;
- transaction signing or contract-writing authority;
- custody or canonical protocol state;
- an independent Explorer RPC crawler, checkpoint database, reorg engine or decoder registry;
- an Explorer-owned verified-source submission/verdict engine. 420 Verify is the separately frozen Genesis verifier application; Explorer may present verification metadata without becoming that authority.

These exclusions are qualification requirements in their own right: later work must not accidentally add a competing canonical source or execution authority.

## Authoritative scope conflict: governance

The frozen Genesis application decision describes 420 Explorer's purpose as **"Blocks, transactions, contracts, validators, assets, governance, finality."** The dedicated Explorer Genesis profile, however, does not include a governance view in `requiredViews`, and EXP-0.1 did not establish a concrete Explorer governance API/client path.

EXP-0.2.1 therefore records `governance view` as `scope_decision_required`. It is **not** silently promoted to a blocker and is **not** dismissed as optional. EXP-0 must resolve the authoritative scope conflict before EXP-0 closeout.

## Automated qualification gate

`scripts/verify-exp-0-2-1-capability-matrix.py` must fail closed unless:

1. the matrix schema and milestone are correct;
2. every dedicated-profile `requiredViews` entry appears exactly once as `mandatory_genesis`;
3. no extra capability is silently marked mandatory;
4. every mandatory entry has source evidence, an Explorer API surface and/or Indexer dependency, and retains runtime qualification as unverified;
5. all dedicated-profile `requiredEndpoints` appear in the dependency surface represented by the matrix;
6. Names and Identity remain optional enrichments;
7. the Explorer contract-free/non-canonical policy is represented by out-of-scope entries;
8. every referenced repository evidence path exists;
9. IDs and capability names are unique and classifications/status values are valid;
10. the governance wording conflict is represented as `scope_decision_required` while it remains absent from `requiredViews`.

The verifier writes `exp-0-2-1-evidence/summary.json` and `capabilities.tsv`, which CI uploads as the milestone evidence artifact.

## Completion condition

EXP-0.2.1 is qualified when the exact branch head passes the new fail-closed matrix verifier **and** the existing Explorer/Indexer regression suite on the same CI run. Qualification means the Genesis capability inventory is complete and correctly classified for the current authoritative sources. It does not resolve the governance scope decision or qualify any live capability.
