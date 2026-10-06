# PB-2.9 — Messaging eligibility enforcement

## Purpose
Enforce current adult eligibility and current reciprocal PuffBuddies relationship authorization before ordinary matched-user messaging can be treated as allowed.

PB-2.9 defines the PuffBuddies-side authorization gate only. It does not implement 420Messenger transport, conversation state, encrypted envelopes, message delivery/read receipts, notification delivery, or the later PB-4 live Messenger integration.

## Canonical requirements
1. Ordinary matched-user messaging requires both participants to have current effective ELIGIBLE state.
2. Both participants must remain ordinary ACTIVE PuffBuddies participants.
3. Both sides must carry current MATCHED relationship authorization; one-sided likes, discoverability, prior conversation state, inactivity or client state are insufficient.
4. A current PuffBuddies block, unmatch, deactivation, suspension, ban, deletion/ineligible state or equivalent hard deny revokes ordinary messaging authorization.
5. PuffBuddies messaging authorization must be evaluated independently for both participants and fail closed if either side is not currently authorized.
6. Both sides must have current PB-1.9 MESSAGING_AUTH derived-generation authority.
7. Stale MESSAGING_AUTH generation on either side after eligibility revocation/expiry, unmatch, block, lifecycle change or deletion fails immediately.
8. 420Messenger-native deny state may impose an additional denial but must never create or broaden PuffBuddies match/consent/eligibility authority.
9. Stale Messenger conversation/delivery state must not resurrect a PuffBuddies authorization that current state denies.
10. Payment, premium, token, admin, moderator, recommendation, notification or delivery state cannot manufacture ordinary messaging consent.
11. The gate must not create match/relationship state; it consumes current canonical PuffBuddies state.
12. Persist/expose no message body, attachment, ciphertext, conversation graph, raw identity/proof evidence, wallet linkage or public match graph.
13. Introduce no Messenger API client, transport, conversation store, notification worker, contract, fixed address/service ID, deployment or false live integration claim.
14. Preserve the PB-0.8 authority boundary: PuffBuddies decides dating/social messaging authorization; 420Messenger owns its native messaging coordination domain.
15. Do not pre-empt later PB-4 implementation of Messenger/Notifications integration.

## Affected components
- `puffbuddies/domain/messaging_eligibility.py`
- `puffbuddies/tests/test_pb_2_9_messaging_eligibility.py`
- `.github/workflows/puffbuddies-pb2.yml`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- this canonical definition and qualification evidence

## Qualification
**Level 1 — ordinary roadmap-step fast qualification.**

PB-2.9 is not Level 2. **PB-2.13 — PB-2 Integration Milestone** remains Level 2 and **PB-2.14 — PB-2 Phase Closeout** remains Level 3.

## Dependencies
PB-0.5 consent invariants; PB-0.7 threat/trust model; PB-0.8 420Messenger authority boundary; PB-0.12 lifecycle; PB-1.5 authorization; PB-1.9 derived invalidation; PB-2.1 through PB-2.8 COMPLETE.

## Exit criteria
Current mutual MATCHED + both-side current eligibility/lifecycle passes the PuffBuddies messaging gate; either-side ineligibility/lifecycle/block/unmatch fails; stale MESSAGING_AUTH generation on either side fails; Messenger-native deny can only deny; gate cannot manufacture match/consent or carry message payload; retained PuffBuddies regressions pass; exact-head PB-2 fast qualification passes; durable Level-1 evidence is recorded.
