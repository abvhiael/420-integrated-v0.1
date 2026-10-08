# CMP-7.10 — Phase closeout

Status: **LEVEL 3 CLOSEOUT CANDIDATE — exact-head comprehensive qualification pending.**

## Canonical definition

Reconcile the complete accumulated CMP-7 developer-surface phase against current `main`, establish one exact merge-candidate implementation SHA, run every required Level-3 owner once on that SHA, preserve durable evidence, and hand off to **CMP-8 — 420Compute application**.

## Reconciliation baseline

Current reconciled `main`: `d112b2eb55b50a3a4f52a5e2a5364374595efe71`.

Accumulated CMP-7 anchor: `7516fc8b9cd85eafb2c88ba013074074b5f70520`.

The branch was reconciled to current `main` with true merge anchor `7516fc8b9cd85eafb2c88ba013074074b5f70520`; the closeout candidate is therefore 0 commits behind the recorded baseline.

## Qualified phase surface

CMP-7 contains:

- typed `@420/sdk` Compute client and request validation;
- Wallet-authorized job-submission API;
- worker, verifier and research-project APIs;
- artifact-derived/reorg-safe Compute indexer projections;
- bounded historical analytics;
- developer documentation;
- `420 compute submit|worker|status|verify|rewards` CLI.

The phase does not move canonical protocol authority into SDK/API/Indexer/CLI layers. Writes remain canonical-contract + Wallet-authorized operations. Read projections remain explicitly non-authoritative.

## Level-2 milestones

- CMP-7.5 — API convergence: retained SDK + job/worker/verifier/research API integration.
- CMP-7.9 — full developer-surface convergence: retained SDK + API + Indexer + CLI integration.

## Level-3 ownership

1. **Solidity Contracts** owns the canonical repository Foundry inventory exactly once, four balanced shards.
2. **Genesis Address Authority** owns address/namespace/collision/predeploy/frozen-manifest verification and must not duplicate full Foundry.
3. **420 Integrated Qualification** owns global runtime/build/fault qualification.
4. **420Docs Qualification** owns global documentation/reconciliation.
5. **Compute Market Qualification** owns retained Compute protocol verification and the CMP-7.10 closeout verifier.
6. **Compute Developer Surfaces** owns exact-head SDK/API/Indexer/CLI retained integration.
7. **420Indexer** owns shared Indexer and consumer qualification.
8. **420 Genesis Contract Hardening** owns size/invariant/static-analysis coverage including the Slither high-severity gate.

Missing, cancelled, stale, superseded, skipped-required or untriggered gates are not passing evidence.

## Safety and authority invariants

The final candidate must preserve:

- SDK/API/CLI never request or store private keys, mnemonics or seed phrases;
- write plans remain unsigned until Wallet authorization;
- chain identity and canonical contract resolution fail closed;
- indexer/analytics records remain `authoritative:false`;
- reorg replay reconstructs canonical indexed state;
- duplicate reward identities cannot be silently double-counted;
- API/CLI cannot manufacture verifier, settlement, reward or worker authority;
- private workload/dataset/credential/result bytes do not enter public index projections;
- repository qualification is not misrepresented as public deployment.

## Live/testnet boundary

CMP-7.10 closes the repository developer-surface phase only.

Still deferred:

- CMP-8 human-facing 420Compute application;
- CMP-9 canonical public-testnet deployment and real funded workloads;
- CMP-10 external/adversarial security campaign;
- CMP-11 mainnet release.

## Exit criteria

CMP-7.10 may be marked COMPLETE only after all required Level-3 owners pass on one exact reconciled implementation SHA and durable evidence records the results.

## Next canonical phase

**CMP-8 — 420Compute application**
