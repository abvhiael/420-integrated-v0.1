# EXP-0.4.7 — canonical qualification ledger

**Status:** implementation complete; exact-head qualification required.

## Purpose

EXP-0.4.7 creates one canonical crosswalk for the current 420Explorer qualification state. It does not replace the underlying EXP-0.2/0.3/0.4 authorities; it reconciles them so later stages cannot promote a requirement by reading only a favorable subset of historical evidence.

## Canonical contents

The ledger contains:

- all 60 mandatory Genesis requirements and their frozen/current source status;
- current CI/model/functional-test coverage;
- future qualification owners and procedures;
- missing runtime/deployment/live/release-candidate evidence layers;
- all mapped Genesis blockers;
- all AC-1 through AC-10 mappings and evidence state;
- the latest cumulatively requalified repository head;
- explicit layer booleans preventing source evidence from being relabeled as runtime, deployment, live-network, or Genesis evidence;
- the stale-evidence precedence established by EXP-0.4.6.

## Current canonical state

- 60 mandatory requirements.
- 47 source-qualified, 6 implemented-source, 4 partial-source, 1 deployment-pending, 2 runtime-unverified.
- 0 Genesis-qualified requirements.
- 10 active Genesis blockers.
- 10 unverified acceptance criteria.
- 0 satisfied acceptance criteria.
- No runtime-, deployment-, live-network-, or Genesis-qualified requirement is asserted.
- Latest cumulatively requalified repository evidence before this milestone: `298f73b99b384704a3231e5dfdfebef0bff3faab`.

## Promotion discipline

A requirement may advance only through the procedures and evidence layers already assigned to it. A green repository workflow proves the repository layer only. Historical `QUALIFIED` or `COMPLETE` wording is constrained by its recorded scope and by the EXP-0.4.6 disposition.

Final Genesis promotion requires the exact release candidate, closure of all applicable blockers, complete mandatory suites, and AC satisfaction under EXP-8.
