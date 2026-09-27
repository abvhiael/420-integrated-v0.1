# EXP-0.4.7 — canonical qualification ledger

**Status:** qualified at repository scope; final evidence-recording head requalification required.

## Purpose

EXP-0.4.7 creates the single downstream machine-readable qualification ledger used by later Explorer qualification stages. It does not replace the authoritative EXP-0.2/EXP-0.3 artifacts; it continuously cross-checks and projects them into one current state.

## Canonical state

At the EXP-0.4.6 qualified baseline:

- **60** mandatory Genesis requirements exist;
- **0** mandatory requirements are Genesis-qualified;
- **10** active Genesis blockers remain;
- **10** acceptance criteria exist and all **10 remain unverified**;
- **0** unresolved scope conflicts remain;
- **0** runtime-, deployment-, live-network- or Genesis-qualified evidence events exist;
- Explorer is therefore **not Genesis-ready**.

## Ledger contents

For every mandatory requirement the ledger records current frozen status, blocker and AC links, current exact-head-revalidated repository evidence, missing evidence layers, future owners and promotion prerequisites.

For every active blocker it records owners, AC links, remediation/test obligations, current-open freshness, and the conditions required before the blocker can be closed.

For every AC it records ownership, mapped requirements/blockers, present repository evidence, missing release evidence, freshness, and satisfaction prerequisites. AC-9 is explicitly modeled as a global exact-release-candidate test-inventory criterion: it intentionally has no direct requirement or blocker IDs and is not an orphan.

## Freshness model

Repository/source evidence is considered current because the entire retained qualification chain passed on `298f73b99b384704a3231e5dfdfebef0bff3faab`, the final EXP-0.4.6 closeout head. Runtime, deployment, live-network and exact-release-candidate evidence remains pending until the owning later milestone executes it in the applicable environment.

Historical `COMPLETE` or `QUALIFIED` records remain scoped by EXP-0.4.6 and cannot silently promote current state.

## Promotion discipline

No requirement can move to Genesis-qualified and no AC can move to satisfied merely because source CI is green. Promotion requires its recorded later procedures, mapped blocker resolution, applicable runtime/deployment/live evidence, and final exact-release-candidate EXP-8 closeout.


## Exact-head implementation qualification

Qualified implementation head: `74ac28b63eef424fbda36f4767ecda9ed72adffa`

- 420Indexer #639 — run `36289925450`, job `108537922752` — success.
- 420Docs Qualification #2971 — run `36289925480`, job `108538009623` — success.
- 420 Integrated Qualification #5588 — run `36289925472` — success.
  - fault-matrix `108537952238` — success.
  - offline-core `108537952247` — success.
  - production-dependencies `108537952287` — success.
  - geth-engine `108537952293` — success.
- EXP-0.4.7 artifact `10922101258`.
- Digest `sha256:2c51d42bc7446eb87103429c7a13ce4f76cdc75f1968781a7b9afb8ecca5355c`.

The first implementation attempt exposed a semantic error in the new verifier: AC-9 intentionally has no direct requirement IDs because it globally qualifies the exact release-candidate test inventory. The corrected ledger explicitly records that global linkage while retaining fail-closed orphan detection for all other criteria.

This evidence recording changes the branch SHA, so a final exact-head retained-suite rerun is required before EXP-0.4.7 is marked COMPLETE.
