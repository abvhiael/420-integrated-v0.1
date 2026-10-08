# HZ-GCA-1.20 — HZ-GCA-1 Level-2 milestone qualification

Status: **COMPLETE — Level 2 exact-head qualified**

This is the documented app-specific integration milestone for the accumulated HZ-GCA-1 architecture.

## Scope

HZ-GCA-1.20 qualifies HZ-GCA-1.1 through HZ-GCA-1.19 together on one exact implementation SHA.

It is intentionally broader than ordinary Level-1 steps but remains 420Hz-focused. It does not perform the later repository-wide Level-3 closeout.

## Current-main reconciliation

Current main at milestone preparation:

`0993ff5b5b3b213a0768dbde90e4734df5ab4cc0`

CMP-7 SDK/API/CLI/Indexer materially overlapped the AI/Compute/Indexer interfaces consumed by the 420Hz architecture. RR-11 later advanced main in unrelated ReeferReview paths; the final milestone reconciliation preserved current-main ReeferReview state while retaining the HZ-GCA architecture and reconciled CMP-7 integration surface.

The active HZ-GCA branch was therefore reconciled with current main before Level-2 qualification.

Reconciliation commit:

`2c9e626dea96706391536a4950245575c4b40f32`

The base-to-main and base-to-HZ-GCA deltas had no overlapping changed paths, so the reconciliation preserved both histories without semantic conflict.

## Retained Level-2 suite

The milestone requires:

- every HZ-GCA-1.1 through HZ-GCA-1.19 verifier;
- the consolidated architecture/no-authority-duplication checks;
- the Phase-1 adversarial matrix;
- retained 420Hz web verification;
- 420AI current Compute integration verification;
- 420AI provider runtime verification;
- reconciled Compute SDK retained tests;
- reconciled Compute API retained tests;
- reconciled Compute Indexer retained tests;
- a dedicated HZ-GCA-1.20 milestone integration verifier.

## Integration assertions

The milestone proves that:

1. canonical authority ownership remains unique and derived services remain non-authoritative;
2. Generate lifecycle, disclosure, provenance, rights/consent, privacy, storage and economics agree;
3. Community relations do not become Chart credit or Awards authority;
4. Charts remain deterministic/rebuildable and RAW_PLAY does not imply QUALIFIED_PLAY;
5. AwardVote is separate from Chart/Community/Civic voting;
6. Wallet-only voting does not claim human uniqueness;
7. unique-human voting retains minimum-disclosure/replay protection;
8. moderation cannot rewrite external canonical state;
9. Arbitration remains optional/explicit and remedy-bounded;
10. API mutations remain actor/domain/resource/idempotency bound;
11. recovery reconciles canonical state before new spend/publication/vote/moderation/remedy effects;
12. privacy cannot widen during dependency failure/recovery;
13. reconciled CMP-7 SDK/API/Indexer surfaces preserve unsigned Wallet authorization and non-authoritative projections.

## Level-3 exclusions

HZ-GCA-1.20 must not run merely for ceremony:

- the canonical full Solidity inventory;
- Genesis/address-authority full qualification;
- 420 Integrated/global qualification;
- Geth/global fault/soak qualification;
- unrelated app audits;
- production deployment/config closeout.

Those remain later Level-3 responsibilities.

## Exit criteria

HZ-GCA-1.20 is complete when the exact-head Level-2 workflow passes every required retained app/integration check with no required skip/cancellation, durable evidence is committed, and HZ-GCA-1 has no unresolved authority duplication or architecture contradiction.

Next canonical roadmap step after successful milestone closeout:

**HZ-GCA-2 — Generation job and provider abstraction**


## Qualification result

Qualified implementation SHA:

`b8974c2aa68b7b0c027ce0cc7dc4784ca5ad02c1`

Required workflow:

- **420Hz GCA Qualification**
- Run: **37803965886** (#261)
- Job: **HZ-GCA Level 2**
- Job ID: **113403242290**
- Result: **PASS**

The exact-head Level-2 run included a PostgreSQL service so the retained 420Indexer PostgreSQL integration test executed instead of being skipped.

Required Level-2 checks passed:

- HZ-GCA-1.1 through HZ-GCA-1.19 retained verifiers;
- HZ-GCA-1.20 milestone verifier;
- 420Hz web verifier;
- 420AI Compute integration verifier;
- 420AI provider runtime and provider-boundary verifier;
- reconciled Compute SDK suite and build;
- reconciled Compute API suite;
- reconciled 420Indexer suite including PostgreSQL integration.

The same exact SHA also passed 420Hz Web Qualification #159 and 420Docs Qualification #7406.

No canonical full Solidity, Genesis/address-authority, 420 Integrated/global, Geth/fault/soak or unrelated app Level-3 inventories were run for this milestone.

**HZ-GCA-1 is COMPLETE at Level 2.**
