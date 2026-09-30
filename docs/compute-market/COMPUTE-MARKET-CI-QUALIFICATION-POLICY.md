# Compute Market CI qualification policy

Status: ACTIVE

## Purpose

Compute Market development uses phase-based qualification so ordinary roadmap steps do not repeatedly pay the cost of repository-wide closeout suites that the step did not affect.

## Level 1 — per-roadmap-step fast qualification

Ordinary CMP roadmap steps qualify only the surfaces they change:

- affected Compute Market Solidity compilation and retained `Compute*.t.sol` tests;
- step-specific verifier/regression scripts;
- directly affected documentation/configuration checks;
- affected SDK, RPC, Indexer, Wallet or backend tests only when those surfaces change.

The stable `Compute Market Qualification` workflow is the default CI gate for Compute-only changes.

A Compute-only Solidity PR is classified by `Solidity Contracts` and runs focused Compute qualification instead of the complete 16-shard repository inventory.

A Compute-only `contracts/config/compute-market/**` change still runs Genesis cross-manifest authority checks when triggered, but does not duplicate the complete 16-shard Foundry inventory unless the PR also changes non-Compute/global authority surfaces.

## Level 2 — integration milestone qualification

At meaningful multi-step integration boundaries, run the broader retained Compute suite and any directly affected integration consumers. Use this when a change crosses component boundaries or materially changes shared interfaces.

## Level 3 — phase closeout qualification

At major Compute phase closeout, explicitly run the expensive retained global gates that are applicable to the phase, including:

- complete Solidity inventory;
- Genesis Address Authority when address/predeploy authority is affected;
- 420 Integrated Qualification when consensus/execution/global runtime behavior is affected or as a deliberate final closeout gate;
- other affected application qualification workflows.

Full closeout qualification is evidence for the exact implementation/reconciliation SHA. Evidence-only commits that merely record already-green run IDs do not automatically require the same expensive suite again unless they alter runtime code, tests, configuration semantics, workflows, dependencies, or substantive requirements.

## Concurrency

PR qualification uses `cancel-in-progress: true` where practical so superseded SHAs stop consuming runners.

## Safety rule

Fast qualification is not permission to skip relevant tests. If a roadmap step changes a shared contract, authority map, global runtime surface, address/predeploy claim, dependency, workflow, or consumer outside Compute Market, the corresponding broader qualification remains required.
