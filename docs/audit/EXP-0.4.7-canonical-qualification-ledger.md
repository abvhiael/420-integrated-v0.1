# EXP-0.4.7 — canonical qualification ledger

**Status:** implementation complete; exact-head qualification required.

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
