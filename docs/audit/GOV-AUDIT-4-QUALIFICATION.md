# GOV-AUDIT-4 — qualification evidence

## Step identity

- Step: **GOV-AUDIT-4 — Indexer, ABI and event-model reconciliation**
- Qualification model: **Level 1 complete**
- Implementation SHA: `4d859e2f0f9f8371aaf2ee7259e414daf17720a2`
- Audit branch: `audit/420governance-complete-20261001`
- PR: #449
- PR base: `01dc4d3a7c272e5e0e70261d3a5f7a26afd04872`
- Current main observed during qualification: `cdd5f58f20a3673bb9a81c6210be2a3019e22380`

This evidence commit is documentation-only. It does not change executable source, tests, workflows, dependencies, interfaces, artifacts or deployment state. The implementation SHA above remains the authoritative Level 1 qualification target.

## Implementation summary

GOV-AUDIT-4 reconciles 420Indexer with the canonical Civic Governance event model without making the Indexer authoritative.

Completed work includes:

- artifact-backed, address-unbound descriptors for the five canonical Civic modules;
- exact compiled-artifact event/indexing verification;
- canonical Governance proposal object keys in the form `proposalId:<hex>`;
- lifecycle reconstruction from authoritative Proposal Registry events:
  - `CivicProposalRegistered` => ACTIVE;
  - `CivicProposalStateChanged` newState 1 => ACTIVE;
  - newState 2 => PASSED;
  - newState 3 => FAILED;
  - newState 4 => QUEUED;
  - newState 5 => EXECUTED;
- no synthetic Civic cancellation projection under the GOV-AUDIT-1 non-cancellation decision;
- dedicated `idx_governance_state` projection using only lifecycle-bearing Governance events;
- public object lookup routed through the dedicated Governance state view;
- canonical search/event-stream/subscription proposal keys and Civic event names;
- explicit non-authoritative event-stream semantics;
- replay/idempotency/reorg replacement-fork qualification;
- fail-closed descriptor/artifact ABI/indexing drift coverage.

## Exact-head qualification

Exact implementation SHA:

`4d859e2f0f9f8371aaf2ee7259e414daf17720a2`

Successful dedicated Governance runs:

- push **#147** — run ID `36923487591` — job ID `110575499544` — **SUCCESS**
- pull request **#148** — run ID `36923498616` — job ID `110575589453` — **SUCCESS**

Both exact-head runs passed:

- exact SHA verification;
- GOV-AUDIT-1/2/3/4 verifier chain;
- Genesis interface verifier;
- Governance Solidity formatting;
- canonical Governance contract build;
- exact Civic artifact ↔ Indexer descriptor reconciliation;
- retained Civic/Governance Foundry qualification;
- forbidden primitive scan;
- focused Governance Indexer build/tests.

The standalone 420Indexer push suite also passed on the same SHA:

- run **#795** — run ID `36923487526` — job ID `110574983688` — **SUCCESS**

## Requirements satisfied

1. Civic contract-to-`420Governance` ABI classification retained.
2. Descriptor event shapes are generated/verified against exact compiled Civic artifacts.
3. Descriptor addresses remain unbound until canonical deployment/discovery; no invented Civic address is introduced.
4. Lifecycle reducer event names match real Civic emitted events.
5. Proposal object keys are deterministic and consistent across reducer/SQL/query/search/stream/subscription surfaces.
6. Proposal current state is reconstructed from authoritative Proposal Registry events rather than inferred from Wallet/Indexer policy.
7. Reorg rollback, replacement-fork replay and idempotent re-indexing are covered.
8. Indexer/event streams remain explicitly non-authoritative.
9. Public query/search/event-subscription schema is reconciled to canonical Civic names and keys.
10. Unknown/stale/mismatched artifact/event shapes fail closed.

## Level 2

Not separately required for this ordinary Indexer reconciliation step. The standalone complete 420Indexer test suite passed on the exact implementation SHA in addition to the focused Governance workflow.

## Level 3

Deferred to complete Governance app-phase closeout. Full current-main reconciliation, canonical repository Solidity inventory, Genesis/address-authority qualification, 420 Integrated/global qualification and repository-wide Docs reconciliation are not repeated here.

## Blockers

No GOV-AUDIT-4 implementation blocker remains.

## Completion

**GOV-AUDIT-4 — COMPLETE.**

Next canonical roadmap step:

**GOV-AUDIT-5 — 420 Wallet Governance user application.**
