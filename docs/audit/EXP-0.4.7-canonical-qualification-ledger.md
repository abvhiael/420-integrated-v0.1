# EXP-0.4.7 — canonical qualification ledger

**Status:** qualified at repository scope; final evidence-recording head requalification required.

## Purpose

EXP-0.4.7 provides the repository's single canonical crosswalk of mandatory requirements, active Genesis blockers, acceptance criteria, current exact-head repository evidence, missing later evidence, and promotion gates.

It reconciles rather than replaces the authoritative EXP-0.2/0.3/0.4 source records.

## Canonical populations

- 60 mandatory Genesis requirements.
- 10 active Genesis blockers.
- 10 acceptance criteria.
- 0 Genesis-qualified requirements.
- 0 satisfied acceptance criteria.
- 0 unresolved scope conflicts.
- 0 runtime-, deployment-, live-network-, or Genesis-qualified provenance events.

Each requirement entry records its authoritative status, AC links, blocker links, missing evidence layers, future owners, promotion gate, current model gates and functional test files. Current repository evidence is anchored to the final cumulatively requalified EXP-0.4.6 head `298f73b99b384704a3231e5dfdfebef0bff3faab`.

## Global acceptance semantics

AC-9 is intentionally global: it is the exact-release-candidate mandatory test inventory and therefore has no direct mandatory requirement links. It is not orphaned. AC-1 through AC-8 and AC-10 retain direct requirement mappings.

## Promotion discipline

No repository/source qualification may self-promote into runtime, deployment, live-network or Genesis qualification. Historical `QUALIFIED` and `COMPLETE` claims are constrained by EXP-0.4.6. Promotion requires the mapped later procedures and evidence layers, closure of applicable blockers, and exact release-candidate closeout under EXP-8.


## Exact-head implementation qualification

Qualified implementation head: `dae98752645b416e359f20c81cc814a937bd52dd`

- 420Indexer #648 — run `36292497908`, job `108545143461` — success.
- 420Docs Qualification #2984 — run `36292497879`, job `108545144676` — success.
- 420 Integrated Qualification #5601 — run `36292497884` — success.
  - fault-matrix `108545145373` — success.
  - geth-engine `108545145386` — success.
  - production-dependencies `108545145423` — success.
  - offline-core `108545145433` — success.
- EXP-0.4.7 artifact `10923190695`.
- Digest `sha256:d8e622d65b0498f5387bc0fb573fac74a0adfe17b6341f7a4697a8ca400476bb`.

The canonical ledger is therefore qualified at repository scope on the implementation head. This evidence recording changes the branch SHA, so the resulting head must be requalified before EXP-0.4.7 is marked COMPLETE.
