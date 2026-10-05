# PB-0.8 qualification evidence

## Step

**PB-0.8 — Ecosystem dependencies**

## Qualification level

**Level 1 — per-roadmap-step fast qualification**

## Canonical definition

PB-0.8 defines the exact narrow roles and authority boundaries of approved 420Integrated dependencies used by PuffBuddies.

## Repository-grounded dependency sources

PB-0.8 was reconciled against current repository architecture/audit documentation for 420Wallet, 420Identity, 420Names, 420Messenger, 420Notifications, 420Pay, 420Registry, 420AppStore, 420Analytics, and derived Indexer/Explorer/Search/Verify roles.

## Implementation summary

PB-0.8 adds:

- PB-DEP-001 through PB-DEP-024;
- a canonical dependency authority matrix;
- exact narrow roles for Wallet, Identity, Names, Messenger, Notifications, Pay, Registry, AppStore, Analytics, Indexer, Explorer, Search, and Verify;
- no-authority-inheritance rules;
- dependency failure/freshness behavior;
- an integration decision rule for later implementation.

No dependency integration client, contract, fixed address, service ID, deployment, or live wiring is introduced by PB-0.8.

## Files changed

- docs/puffbuddies/PB-0.8-ECOSYSTEM-DEPENDENCIES.md
- docs/puffbuddies/PUFFBUDDIES-ROADMAP.md
- scripts/verify-puffbuddies-pb0.py
- docs/puffbuddies/PB-0.8-QUALIFICATION.md

## Requirements satisfied

Pending exact-head qualification.

## Implementation SHA

**PENDING EXACT-HEAD QUALIFICATION**

## Current main/base SHA

Current main observed at PB-0.8 start: 4840e9a3e1c89d8c6a9e241ea387166f33202697

PR #526 remains on a historical base and requires later accumulated-branch reconciliation before merge/Level 3 closeout.

## CI evidence

Workflow: **PuffBuddies PB-0 Qualification**

Pending exact-head run.

## Security/adversarial/invariant scope

The cumulative verifier must reject missing/duplicate/reordered PB-DEP identifiers, authority inheritance, Messenger-created match consent, Notifications-created authorization, Pay-created consent/eligibility, Registry ambient privilege, protected-data analytics ingestion, and false implemented/live integrations.

## Milestone status

PB-0.8 is not a Level 2 integration milestone. It defines dependency contracts without implementing cross-component runtime wiring.

## Intentionally deferred checks

Level 2 retained PuffBuddies integration is not required for PB-0.8.

Level 3 comprehensive repository qualification and current-main merge-candidate reconciliation remain deferred to the applicable phase boundary.

## Limitations

PB-0.8 defines dependency roles and authority boundaries. Exact APIs, service IDs, addresses, manifests, client code, retries, transport, deployment, and live testnet binding remain later roadmap work.

## Blockers

Exact-head Level 1 qualification must pass before PB-0.8 is formally COMPLETE.

## Completion state

**PB-0.8 — PENDING QUALIFICATION**

## Next canonical roadmap step

**PB-0.9 — State ownership**
