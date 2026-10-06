# PB-6 — 420Messenger integration

## Purpose
Integrate PuffBuddies current matched-user messaging authorization with the repository's canonical 420Messenger coordination domain without transferring authority in either direction.

PuffBuddies remains canonical for dating/social eligibility, lifecycle, match, unmatch, block/safety and whether the PuffBuddies interaction is currently authorized. 420Messenger remains canonical for Messenger endpoint state, Messenger-native blocks, conversation lifecycle, encrypted-envelope commitments and delivery/read coordination.

## Canonical repository dependency
PB-6 consumes the existing qualified 420Messenger V1 interfaces:
- active endpoint state from `MessengerEndpointRegistry420`;
- bilateral native block state from `MessengerBlockRegistry420`;
- deterministic two-party conversation lifecycle `NONE/REQUESTED/ACTIVE/CLOSED` from `MessengerConversationRegistry420`;
- read-only request/send authority semantics from `MessengerRouter420`;
- envelope/receipt coordination remains wholly Messenger-owned.

The canonical Messenger service is Registry-resolved under `420/service/messenger/v1`; PB-6 does not invent or freeze a Messenger address.

## Canonical requirements
1. Conversation entry requires current PuffBuddies matched-user messaging authorization for both participants.
2. PuffBuddies authorization must be rechecked on every protected Messenger handoff; a prior match/conversation is not permanent authority.
3. A transient private profile→Messenger-account binding may be supplied at the integration boundary only for the current operation.
4. PB-6 must not persist, publish, index, return or create a public lookup from PuffBuddies profile identity to Messenger/wallet account.
5. The two transient account bindings must correspond exactly to the two PuffBuddies authorization subjects and must be distinct.
6. Conversation request additionally requires both canonical Messenger endpoints active.
7. Conversation request/accept/send fail when Messenger reports a native block in either direction.
8. Messenger-native block is additive deny state only; it does not rewrite PuffBuddies match, profile, eligibility, lifecycle or safety state.
9. Conversation acceptance requires canonical Messenger REQUESTED state, exact pair participants, and the accepter must not be the requester.
10. Send authorization requires canonical Messenger ACTIVE conversation state and exact pair participants.
11. Messenger endpoint deactivation is required to deny new conversation requests according to Messenger V1; PB-6 does not invent stricter endpoint semantics for an already-active conversation.
12. An active Messenger conversation cannot resurrect PuffBuddies authorization after unmatch, block, eligibility loss, lifecycle loss or stale PB generation.
13. A stale PuffBuddies MESSAGING_AUTH generation fails before send even if Messenger still reports ACTIVE.
14. Messenger authority/read outages fail closed before request/accept/send authorization is granted.
15. Conversation state, endpoint state, blocks, envelopes and receipts are read from Messenger authority; PuffBuddies must not keep a parallel canonical Messenger history.
16. PB-6 may emit a best-effort close handoff for a PuffBuddies-scoped Messenger conversation after PuffBuddies revocation; failure/delay of that close must not restore PuffBuddies authorization.
17. The close handoff uses Messenger participant authority and does not grant PuffBuddies general Messenger admin capability.
18. PB-6 authorization conclusions are minimum-disclosure and contain no profile IDs, wallet/account bindings, relationship reason, eligibility reason or private message metadata.
19. Conversation/request handoff objects contain only the Messenger routing/context fields needed for the immediate call and never PuffBuddies profile IDs.
20. Plaintext, ciphertext bodies, attachments, private keys, key packages, envelope bodies/storage objects and read/delivery receipt state remain outside PuffBuddies canonical state.
21. Payment, premium, token, staking, admin, moderator, ranking, notification or cached client state cannot bypass either PuffBuddies or Messenger deny state.
22. Messenger conversation state cannot create or restore a PuffBuddies match.
23. PuffBuddies match state cannot create Messenger endpoint/block/conversation/envelope/receipt state without the canonical Messenger action and authority.
24. No public relationship/message graph, Search/Explorer/Indexer publication or analytics identity correlation is introduced.
25. No Messenger contract, frozen address, deployment graph, capability ID or service ID is modified by PB-6.
26. PB-7 remains owner of 420Notifications integration.

## Qualification
PB-6 requires:
- **Level 1** exact-head PuffBuddies integration qualification;
- **Level 2** retained app integration because PB-6 introduces a major cross-app authority dependency between PB-5/PB-2 messaging authorization and 420Messenger;
- direct Messenger interface verification with `scripts/verify-420messenger-audit.py`.

Level 2 remains app-focused. PB-6 does not trigger the canonical full Solidity inventory, Genesis full qualification, global Geth/fault/soak or Level-3 closeout.

## Affected components
- `puffbuddies/domain/messenger_integration.py`
- existing PB-2.9 messaging eligibility gate
- existing PB-5 canonical match state
- canonical Messenger V1 interfaces/manifests as read-only dependencies
- `puffbuddies/tests/test_pb_6_messenger_integration.py`
- `puffbuddies/tests/test_pb_6_integration.py`
- `.github/workflows/puffbuddies-pb6.yml`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- durable qualification evidence

## Dependencies
PB-0.3, PB-0.4, PB-0.5, PB-0.7, PB-0.8, PB-0.9, PB-0.10, PB-0.11; PB-2.9; **PB-5 — Likes and matching — COMPLETE**; repository-qualified 420Messenger V1 interfaces.

## Exit criteria
- current matched PuffBuddies pair can prepare a Messenger conversation request only when Messenger endpoints/blocks allow it;
- acceptance requires current PB authorization plus exact pending Messenger conversation authority;
- send requires current PB authorization plus exact active Messenger conversation and no native block;
- PB unmatch/revocation/stale generation denies immediately despite an active Messenger conversation;
- Messenger native block denies handoff without mutating PB match authority;
- Messenger authority outage fails closed;
- transient profile/account binding is never persisted or returned in minimum-disclosure authorization results;
- best-effort conversation close handoff after PB revocation cannot become PuffBuddies authorization;
- canonical Messenger verifier passes unchanged;
- Level-1 targeted and retained PuffBuddies regressions pass;
- Level-2 PB-5/PB-6 integration passes on the exact same SHA;
- durable evidence records the qualified SHA and milestone status.
