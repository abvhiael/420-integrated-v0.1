# EXP-0.3.1 — authoritative Genesis requirement inventory

**Status:** authoritative requirement inventory committed; exact-head CI qualification required before closeout.  
**Baseline:** merged EXP-0.2 `main` commit `c7cb5f4dac07eb9416cac4a11eeee31b6efb10f0`.  
**Machine-readable inventory:** `docs/audit/EXP-0.3.1-authoritative-genesis-requirements.json`.

## Objective

EXP-0.3.1 creates one authoritative, traceable inventory of the requirements that define 420Explorer's Genesis scope.

This is deliberately broader than a list of UI features. The dedicated Explorer Genesis profile also defines mandatory data-source boundaries, Indexer-consumer rules, finality/rebuild guarantees, contract-verification boundaries, and thirteen architecture invariants. Those are Genesis requirements even when they are not directly visible in the UI.

The inventory reconciles:

- `contracts/config/420explorer-genesis.json`;
- frozen `config/genesis-applications.json`;
- the two frozen system-address maps;
- EXP-0.2.1 capability classifications;
- EXP-0.2.2 workflow evidence;
- EXP-0.2.5 gap classifications;
- EXP-0.2.6 acceptance ownership/evidence map.

## Inventory composition

The register contains **65 requirements**:

- **60 mandatory Genesis requirements**;
- **2 optional integrations**;
- **2 post-Genesis enhancements**;
- **1 unresolved scope-decision requirement**.

The 60 mandatory requirements include:

- 10 required Explorer views;
- Explorer application/authority boundaries;
- mandatory shared source dependencies;
- Indexer service/version/chain and ownership restrictions;
- all seven dedicated-profile required Indexer endpoints;
- seven indexing/finality/rebuild rules;
- five contract-verification presentation/authority rules;
- all thirteen `EXP-INV-001` through `EXP-INV-013` invariants;
- three fixed-address authority requirements.

Every requirement records:

- a stable requirement ID;
- category and scope classification;
- authoritative source and selector;
- normative statement;
- concrete repository implementation path(s);
- later qualification owner(s);
- mapped AC-1 through AC-10 acceptance criteria where applicable;
- current evidence-backed status;
- notes/limitations where required.

## Mandatory required views

The inventory contains exactly the ten dedicated-profile `requiredViews`:

1. block;
2. transaction;
3. receipt/logs;
4. address;
5. contract;
6. token/asset activity;
7. validator;
8. epoch/rotation;
9. protocol service/version;
10. network status.

Each maps back to its EXP-0.2 capability ID and forward to implementation paths, later qualification owners and acceptance criteria.

No additional view is silently made mandatory.

## Mandatory architectural requirements

EXP-0.3.1 also freezes the following architectural requirements as Genesis scope:

- no Explorer-specific Genesis contract;
- Explorer is not canonical state authority;
- chain index comes from 420Indexer;
- no direct Explorer execution-RPC ingestion;
- required chain ID remains 420;
- no independent Explorer chain ingestion, checkpoint store, reorg engine or decoder registry;
- fail closed on canonical-authority claims;
- Indexer data remains non-canonical and rebuildable;
- head/safe/finalized remain distinct;
- reorg repair is bounded above finality;
- finalized history remains immutable under ordinary repair;
- runtime bytecode and canonical provenance outrank labels/source metadata;
- Explorer remains read-only and replaceable.

## Frozen address authority

The inventory explicitly reconciles the frozen system-address authority:

- `config/system-addresses.json` and `contracts/config/system-addresses.json` must remain structurally identical;
- Explorer owns no fixed Genesis system address;
- ProtocolRegistry remains frozen at `0x0000000000000000000000000000000000000434`.

A frozen address is configuration authority, **not** proof that the target network has the expected deployed bytecode. Deployment/runtime verification remains later work.

## Optional integrations

Two dedicated-profile integrations remain explicitly optional:

- 420 Names display enrichment;
- 420 Identity public display enrichment.

Neither receives a Genesis acceptance criterion in this inventory, and neither may block core Genesis qualification.

## Post-Genesis enhancements

The inventory carries forward two explicitly non-blocking enhancements from the qualified EXP-0.2 gap register:

- a dedicated staking/reward activity view;
- 420 Verify-backed source-verification presentation integration.

Their inclusion prevents later work from accidentally treating them as missing mandatory scope.

## Governance scope conflict

The frozen application decision describes 420 Explorer as covering:

`Blocks, transactions, contracts, validators, assets, governance, finality`.

The dedicated Explorer Genesis profile does **not** include a governance entry in `requiredViews`.

EXP-0.3.1 therefore records one requirement as:

`scope_decision_required`

It does not add a governance view and does not dismiss governance as optional. The conflict remains an explicit blocker for final EXP-0 scope closeout and is owned by later EXP-0.3 reconciliation.

## Qualification gate

`scripts/verify-exp-0-3-1-authoritative-requirements.py` must fail closed unless:

1. the inventory schema, milestone and merged-main baseline are correct;
2. exactly 65 requirement IDs exist and are unique;
3. the classification totals remain 60 mandatory / 2 optional / 2 post-Genesis / 1 scope decision;
4. all ten dedicated-profile required views exist exactly once as mandatory requirements;
5. every mandatory view maps to a real implementation path, owner and applicable acceptance criterion;
6. all mandatory Explorer/Indexer boundary fields from the dedicated profile are represented;
7. all seven dedicated-profile required Indexer endpoints are represented exactly once;
8. all seven indexing rules and all five verification-boundary rules are represented;
9. all thirteen Explorer invariants are represented with their source text preserved;
10. both frozen address maps match, Explorer has no assignment, and ProtocolRegistry remains at `0x...0434`;
11. the frozen application record and dedicated profile both still classify Explorer as contract-free Genesis user application;
12. Names and Identity remain optional and non-blocking;
13. post-Genesis entries remain non-blocking;
14. governance remains `scope_decision_required` while the authoritative-source conflict exists;
15. every referenced implementation/evidence path exists;
16. every referenced acceptance criterion exists in the qualified EXP-0.2.6 acceptance map.

The verifier writes:

- `exp-0-3-1-evidence/summary.json`;
- `exp-0-3-1-evidence/requirements.tsv`.

## Completion condition

EXP-0.3.1 is qualified when the dedicated verifier and the existing Explorer/Indexer/repository qualification suites pass on the same exact PR head and the evidence artifact is uploaded.

Qualification means the **authoritative Genesis requirement inventory is complete and internally reconciled**. It does not resolve the governance decision or satisfy later runtime/deployment acceptance criteria.
