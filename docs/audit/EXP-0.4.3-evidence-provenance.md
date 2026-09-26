# EXP-0.4.3 — exact-head qualification evidence provenance ledger

**Status:** implementation complete; exact-head qualification required.

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

The ledger contains 16 exact-head events:

- combined EXP-0.1.1–0.1.3;
- EXP-0.2.1/0.2.2 and EXP-0.2.3–0.2.6;
- EXP-0.3.1–0.3.8;
- EXP-0.4.1;
- EXP-0.4.2.

All 16 retain concrete workflow run IDs and job IDs. Fifteen retain artifact digests in the closeout record; EXP-0.1 retains its artifact ID but its historic PR record did not preserve the digest, which is represented explicitly rather than invented.

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
