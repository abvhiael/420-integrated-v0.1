# EXP-0.4.3 — exact-head qualification evidence provenance ledger

**Status:** initial exact-head qualification recorded; final closeout head requalification required.

## Objective

EXP-0.4.3 replaces scattered qualification prose with one machine-readable provenance ledger. Every retained Explorer qualification event from EXP-0.1 through EXP-0.4.2 now records its exact qualified SHA, PR/branch/base, workflow runs, job IDs, qualification profile, artifact IDs/digests where retained, evidence scope, affected requirements/findings/acceptance criteria, reproducibility and explicit limitations.

## Qualification levels

The ledger separates six evidence levels:

1. `source_qualified`
2. `integration_qualified`
3. `runtime_qualified`
4. `deployment_qualified`
5. `live_network_qualified`
6. `genesis_qualified`

No promotion is implied between levels. In particular, source and integration evidence cannot be reused as deployment or live-network proof.

## Historical accounting

The ledger contains 17 exact-head events:

- combined EXP-0.1.1–0.1.3;
- EXP-0.2.1/0.2.2 and EXP-0.2.3–0.2.6;
- EXP-0.3.1–0.3.8;
- EXP-0.4.1;
- EXP-0.4.2;
- EXP-0.4.3 initial qualification head.

All 17 retain concrete workflow run IDs and job IDs. Sixteen retain artifact digests in the closeout record; EXP-0.1 retains its artifact ID but its historic PR record did not preserve the digest, which is represented explicitly rather than invented.

## Current qualification truth

The ledger intentionally records:

- zero runtime-qualified events;
- zero deployment-qualified events;
- zero live-network-qualified events;
- zero Genesis-qualified events;
- ten current Genesis blockers;
- ten currently unverified acceptance criteria.

This prevents historical exact-head repository qualification from silently becoming a later-stage runtime or release claim.

## Reproducibility

Qualification command detail is normalized through three profiles: the Explorer/Indexer exact-head gate, documentation gate and repository regression gate. Each event points to the applicable profiles and concrete run/job IDs.

## Scope boundary

EXP-0.4.3 qualifies evidence provenance and level discipline. It does not execute the manual live Explorer validator, deploy Explorer/Indexer, remediate the ten blockers, or satisfy AC-1 through AC-10.


## EXP-0.4.3 initial exact-head qualification

Qualified implementation head: `1a9ba8d0c81e9e8fe2f35655ddd5235dd6ab2f8f`

- 420Indexer #614 — run `36273730986`, job `108492373617` — success.
- 420Docs Qualification #2934 — run `36273730968`, job `108492375629` — success.
- 420 Integrated Qualification #5551 — run `36273731020` — success:
  - production-dependencies `108492433189`;
  - offline-core `108492433295`;
  - geth-engine `108492433316`;
  - fault-matrix `108492433374`.
- EXP-0.4.3 evidence artifact `10916835141`.
- Digest `sha256:3370b78c68cd05be90fb74d7d5b55d71d5f00ed3e464c3174802b7021a0544e4`.

Recording this event changes the branch head. EXP-0.4.3 is not finally COMPLETE until the resulting closeout head reruns the same required gates successfully.
