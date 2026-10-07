# PB-8 — Safety and moderation

## Purpose
Implement the canonical PuffBuddies safety domain: private report cases, evidence-integrity metadata, immediate independent block authority, moderation workflow/actions, restriction/suspension/ban lifecycle enforcement, appeal review, least-privilege access, protected persistence, auditability and stale-state invalidation without public reputation.

## Canonical requirements
1. Implement all twelve PB-0.10 report classes.
2. Implement RECEIVED, TRIAGED, REVIEWING, RESTRICTED_PENDING_REVIEW, ACTIONED, NO_ACTION, APPEALED and CLOSED.
3. Report receipt is not proof of guilt and report count is not an adjudication field.
4. Block is immediate, unilateral, user-owned and independent of report/moderation outcome.
5. Filing a report does not silently block; blocking does not require reporting.
6. Block invalidates derived discovery/matching/messaging authority for both affected participants and advances pair consent epoch so stale likes cannot restore contact.
7. Moderator actions may restrict platform participation but cannot force like/match/unblock/rematch/message/profile disclosure/contact.
8. Temporary restriction uses canonical RESTRICTED lifecycle authority and all-derived safety invalidation.
9. Final feature restriction/suspension/ban uses canonical safety lifecycle authority and all-derived invalidation.
10. Irreversible/final moderation action requires explicit human-reviewed=true; automation alone cannot finalize action.
11. Appeal is subject-owned request from ACTIONED and does not itself restore lifecycle, unblock, rematch or conversation/contact.
12. Appeal adjudication requires appeals/senior authority.
13. NO_ACTION does not erase an independent user block.
14. Reporter identity, case/evidence metadata and moderation actor/history are protected safety state.
15. Raw report/evidence/message content is not stored by the PB-8 case model; case persistence stores a SHA-256 digest plus bounded opaque evidence reference.
16. Evidence references reject public URLs and cross-case free-form payloads.
17. Safety persistence uses purpose-limited retention and optimistic concurrency.
18. Safety records identify case, subject, reporter actor, report class, action/status, policy basis, evidence integrity reference, moderation actor, retention reason and version.
19. Payment/premium/token/staking/ranking/reputation/operator favoritism are not safety bypass inputs.
20. Safety case records expose no public risk/desirability score or report-count guilt field.
21. Current safety/lifecycle action outranks stale discovery/matching/messaging/Notifications/Messenger/client/cache state.
22. Safety actions are private/off-chain and non-enumerable; no Registry/Search/Explorer/public-chain/public-wallet publication is introduced.
23. Cross-service enforcement remains capability-limited; PB-8 does not grant moderators ambient Wallet/Identity/Pay/Messenger/Notifications authority.
24. Emergency/legal/law-enforcement workflow is not invented here.
25. Purpose-retained safety evidence cannot recreate a deleted profile, discovery/match authority or public reputation.
26. PB-8 introduces no classifier, moderation console, evidence database engine, contract, fixed address/service ID, deployment or live-enforcement claim.

## Qualification
PB-8 requires **Level 1 exact-head qualification plus Level 2 retained app integration**, because it introduces the canonical safety/lifecycle authority that must override the accumulated PB-4 through PB-7 discovery/matching/messaging/notification stack.

Level 2 remains app-focused. Level 3 repository-wide inventories remain deferred.

## Affected components
- `puffbuddies/domain/safety.py`
- canonical private safety schema
- PB-1 relationship/lifecycle/invalidation primitives
- PB-5 pair state
- PB-2/PB-6 messaging authority
- PB-7 downstream notification authorization
- PB-8 targeted/integration tests and workflow
- canonical roadmap/PB-0.19 scope reconciliation
- durable qualification evidence

## Exit criteria
All report/moderation states are implemented; report/block separation holds; immediate block invalidates contact authority; protected evidence/persistence boundaries hold; least-privilege moderation transitions and human-review guard hold; restriction/suspension/ban invalidate stale participation; appeal cannot restore interpersonal consent; retained integration proves block/suspension override accumulated interaction authority; privacy/public-reputation negative gates pass; exact-head Level 1 and Level 2 app qualification pass; durable evidence is recorded.
