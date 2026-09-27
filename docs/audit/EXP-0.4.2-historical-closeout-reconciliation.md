# EXP-0.4.2 — historical qualification and closeout reconciliation

**Status:** QUALIFIED at repository scope.

## Objective

EXP-0.4.2 reconciles historical and current statements that use words such as *complete*, *qualified*, *qualification*, *closeout* or *ready* around 420Explorer. The purpose is not to erase older evidence. It is to prevent a narrow source/consumer qualification from being promoted into deployment, live-network, acceptance-criterion or Genesis qualification.

## Result

The inventory contains **14 explicit claim records**.

- 10 are `current_and_applicable` within a deliberately narrow scope.
- 1 is retained as `historical_supporting_evidence`.
- 1 user-facing historical wording record is `scope_changed` and is not qualification evidence.
- 2 test mechanisms are `insufficient_provenance` until an approved target run supplies exact commit, inputs, run ID and evidence.
- 0 records establish broad Genesis qualification.
- 0 retained records establish a currently executed/approved live Explorer closeout.
- The authoritative gap register still contains 10 Genesis-blocking findings.

## Key reconciliation

### QUALIFIED_INDEXER_API_CONSUMER

This label remains valid, but only for the source/client boundary proving that Explorer consumes the shared 420Indexer API and does not introduce its own crawler, checkpoint store, reorg engine or decoder registry. It appears in Indexer readiness, Explorer API/startup metadata and architecture documentation.

It does **not** establish Indexer deployment, Explorer deployment, target-network binding, Registry publication, consensus-provider wiring, end-to-end browser witnesses or Genesis readiness.

### EXP-7.1 / EXP-7.2 tooling

The repository contains an EXP-7.1 smoke program and EXP-7.2 live validator. Source code capable of emitting `QUALIFIED` or a passing report is a **qualification mechanism**, not proof that an approved deployment was actually qualified. No such execution is promoted by this inventory.

### Current readiness records

`testnet/public-services/explorer/readiness.json` remains explicit: backend is `INDEXER_CONSUMER_IMPLEMENTED_PENDING_DEPLOYMENT`, frontend is `PENDING`, and URLs are placeholders. The Indexer readiness record likewise keeps its URL at `REPLACE` / `PENDING_TESTNET_DEPLOYMENT`.

These records override any temptation to interpret older source-qualified wording as live deployment evidence.

### EXP-0 exact-head records

The exact-head records from EXP-0.2, EXP-0.3 and EXP-0.4.1 remain applicable to the specific audit/model scopes they qualified. Their own scope boundaries are retained. None says AC-1 through AC-10 are satisfied or that Explorer is Genesis-ready.

## Classification policy

Allowed dispositions are:

- `current_and_applicable`
- `historical_supporting_evidence`
- `superseded`
- `scope_changed`
- `runtime_evidence_expired`
- `cannot_reproduce`
- `insufficient_provenance`

The absence of a disposition is a verifier failure. Historical evidence may support later work but cannot silently update the authoritative EXP-0.3 status freeze.

## Scope boundary

EXP-0.4.2 qualifies the historical-closeout inventory and the interpretation rules for old qualification language. It does not modify Explorer functionality, run the manual live-testnet validator, close a Genesis blocker, or satisfy an acceptance criterion.


## Exact-head qualification evidence

Qualified head: `7e97fd4fb472f42e91dde45e1d6a808dddf9bc56`

- 420Indexer #609 — run `36271531639` — success.
- 420Docs Qualification #2927 — run `36271531648` — success.
- 420 Integrated Qualification #5544 — run `36271531693` — success.
- EXP-0.4.2 evidence artifact `10915817634`.
- Digest `sha256:32c88290fc1a95f4bac35225ca94d73b98999c4d91b04b8e93be74e048c676d5`.

The first implementation run failed only because the new verifier read the acceptance-map field as `status` instead of the authoritative `current_status`. The retained EXP-0.2.6 gate remained green and demonstrated that all ten criteria were still unverified. The new verifier was corrected and the entire exact-head suite passed.

EXP-0.4.2 is therefore complete at repository scope. It establishes interpretation/provenance discipline for historical qualification language and does not close runtime, deployment, live-network or Genesis blockers.
