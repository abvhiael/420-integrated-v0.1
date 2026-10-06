# PB-0.14 qualification evidence

## Step

**PB-0.14 — Cannabis taxonomy**

## Qualification level

**Level 1 — per-roadmap-step fast qualification**

## Canonical definition

PB-0.14 defines canonical cannabis-compatibility vocabulary without turning cannabis fields into public or tokenized identity.

## Implementation summary

PB-0.14 adds:

- PB-CANNABIS-001 through PB-CANNABIS-040;
- optional use-status/frequency vocabulary;
- optional method, social-context, environment-boundary, partner-compatibility, interest, and enthusiasm vocabulary;
- first-class NON_USER and PREFER_NOT_TO_SAY states;
- privacy/public-identity boundaries;
- matching/consent constraints;
- economic/tokenization prohibitions;
- safety/legal/health boundaries;
- a taxonomy-extension decision rule.

No profile implementation, database, matching engine, public registry, token/NFT credential, API, contract, fixed address, service ID, deployment, or live taxonomy is introduced by PB-0.14.

## Files changed

- docs/puffbuddies/PB-0.14-CANNABIS-TAXONOMY.md
- docs/puffbuddies/PUFFBUDDIES-ROADMAP.md
- scripts/verify-puffbuddies-pb0.py
- docs/puffbuddies/PB-0.14-QUALIFICATION.md

## Requirements satisfied

Pending exact-head qualification.

## Implementation SHA

**PENDING EXACT-HEAD QUALIFICATION**

## Current main/base SHA

Current main observed at PB-0.14 start: f5a0d703ca015962e49e95d075ff582d833a7c33

PR #526 remains open on the cumulative PB-0 branch. Current-main merge-candidate reconciliation remains deferred to the applicable Level 3 phase boundary.

## CI evidence

Workflow: **PuffBuddies PB-0 Qualification**

Pending exact-head run.

## Security/adversarial/invariant scope

The cumulative verifier must reject missing/duplicate/reordered PB-CANNABIS identifiers; public/tokenized cannabis identity; wallet/token/payment proof of use; cannabis fields bypassing consent/safety/lifecycle; non-user exclusion; hidden substance-use inference; medical/legal/impairment conclusions; coercion; unauthorized marketplace semantics; and false live taxonomy claims.

## Milestone status

PB-0.14 is not a Level 2 integration milestone. It defines vocabulary/data semantics only and introduces no executable matching/profile/shared runtime integration.

## Intentionally deferred checks

Level 2 retained PuffBuddies integration is not required for PB-0.14.

Level 3 comprehensive repository qualification and current-main merge-candidate reconciliation remain deferred to the applicable phase boundary.

## Limitations

PB-0.14 defines vocabulary and semantic boundaries only. Exact UI controls, localization, product copy, matching weights, database schema, profile APIs, analytics implementation, moderation tooling, jurisdiction-specific legality, and health information remain later work.

## Blockers

Exact-head Level 1 qualification must pass before PB-0.14 is formally COMPLETE.

## Completion state

**PB-0.14 — PENDING QUALIFICATION**

## Next canonical roadmap step

**PB-0.15 — Visibility model**
