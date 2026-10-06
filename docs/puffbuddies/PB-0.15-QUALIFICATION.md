# PB-0.15 qualification evidence

## Step

**PB-0.15 — Visibility model**

## Qualification level

**Level 1 — per-roadmap-step fast qualification**

## Canonical definition

PB-0.15 defines canonical PuffBuddies field audiences including private, discoverable, matched, participant-only, moderator-only, service-minimum, aggregate-only, public-explicit, and never-public visibility.

## Implementation summary

PB-0.15 adds:

- PB-VIS-001 through PB-VIS-040;
- canonical visibility audience classes;
- field-specific audience rules;
- discovery-vs-public separation;
- visibility revocation for block, lifecycle, unmatch, and deletion;
- stale-cache/derived-copy invalidation;
- server-side authorization requirement;
- economic visibility prohibitions;
- a field-classification decision rule.

No profile schema, ACL engine, API, database, client implementation, contract, fixed address, service ID, deployment, or live visibility enforcement is introduced by PB-0.15.

## Files changed

- docs/puffbuddies/PB-0.15-VISIBILITY-MODEL.md
- docs/puffbuddies/PUFFBUDDIES-ROADMAP.md
- scripts/verify-puffbuddies-pb0.py
- docs/puffbuddies/PB-0.15-QUALIFICATION.md

## Requirements satisfied

- PB-VIS-001 through PB-VIS-040 exist exactly once and in sequence;
- PRIVATE_SELF, DISCOVERABLE, MATCHED, PARTICIPANT_ONLY, MODERATOR_ONLY, SERVICE_MINIMUM, AGGREGATE_ONLY, PUBLIC_EXPLICIT, and NEVER_PUBLIC audiences are defined;
- DISCOVERABLE is explicitly limited to authorized in-app discovery and is not equivalent to unauthenticated/public internet/public protocol visibility;
- canonical audiences are defined for membership, profile presentation, preferences, cannabis data, precise/coarse location, likes/passes, matches, blocks, reports/moderation, messages, identity evidence, eligibility conclusions, wallet linkage, payments, lifecycle/safety state, ranking state, sessions/security data, and audit evidence;
- block, lifecycle restriction, unmatch, and deletion revoke stale broader visibility;
- caches, clients, queues, notifications, indexes, analytics, Search/Explorer, and derived views must preserve source visibility restrictions;
- client-side hiding alone is not authorization; backend/service authorization is required;
- public Search/Explorer/wallet/unauthenticated services cannot promote in-app DISCOVERABLE/MATCHED data into public visibility;
- payment, premium, token holdings, staking, sponsorship, boosts, and promotions cannot purchase another user's protected field visibility;
- the field-classification decision rule covers ownership, audience, transitions, override authorities, service-minimum needs, enumeration/inference risk, retention/deletion, stale-copy invalidation, and audit;
- no profile schema, ACL engine, API, database, client implementation, contract, fixed address, service ID, deployment, or live visibility enforcement is claimed.

## Implementation SHA

`d332cb36c2f7f5aea07c344c32158466ff5030c9`

## Current main/base SHA

Current main observed at PB-0.15 start: f5a0d703ca015962e49e95d075ff582d833a7c33

PR #526 remains open on the cumulative PB-0 branch. Current-main merge-candidate reconciliation remains deferred to the applicable Level 3 phase boundary.

## CI evidence

Workflow: **PuffBuddies PB-0 Qualification**

Exact-head push qualification:
- run: `37396121426` — **PASS**
- job: `112052375158` (`pb0-fast`) — **PASS**
- exact-head checkout — **PASS**
- exact-head SHA verification — **PASS**
- cumulative PB-0 verifier — **PASS**
- accidental PuffBuddies runtime/contract implementation rejection — **PASS**

Exact-head pull-request qualification:
- run: `37396124304` — **PASS**
- job: `112052386014` (`pb0-fast`) — **PASS**

## Security/adversarial/invariant scope

The cumulative verifier must reject missing/duplicate/reordered PB-VIS identifiers; DISCOVERABLE-as-public interpretation; public preference/match/block/report/location/session exposure; client-side hiding as authorization; stale visibility after block/unmatch/lifecycle/deletion; Search/Explorer promotion of in-app fields; paid access to protected fields; and false live visibility-enforcement claims.

## Milestone status

PB-0.15 is not a Level 2 integration milestone. It defines field audience policy only and introduces no executable ACL/profile/shared runtime integration.

## Intentionally deferred checks

Level 2 retained PuffBuddies integration is not required for PB-0.15.

Level 3 comprehensive repository qualification and current-main merge-candidate reconciliation remain deferred to the applicable phase boundary.

## Limitations

PB-0.15 defines policy only. Exact field schemas, per-field UI controls, ACL implementation, APIs, database policy, client rendering, cache invalidation mechanisms, notification redaction code, and moderation tooling remain later roadmap work.

## Blockers

None for PB-0.15.

## Completion state

**PB-0.15 — COMPLETE**

All canonical PB-0.15 exit criteria are satisfied on exact implementation SHA `d332cb36c2f7f5aea07c344c32158466ff5030c9`.

## Next canonical roadmap step

**PB-0.16 — Non-goals reconciliation**
