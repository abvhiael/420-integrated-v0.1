# Bong Goggles BG-14 — Full Private Messaging

BG-14 builds the Bong Goggles application messaging layer over the already-canonical 420Messenger contracts and `BongGogglesPrivateMessaging420`. It does not create a second messaging protocol and it never makes plaintext or ciphertext chain state.

## Canonical ownership

- `MessengerConversationRegistry420` owns direct conversation identity and `REQUESTED -> ACTIVE -> CLOSED` state.
- `MessengerEnvelopeRegistry420` owns canonical encrypted-envelope commitments/sequence metadata, not plaintext.
- `MessengerReceiptRegistry420` owns delivery/read acknowledgement state.
- `MessengerBlockRegistry420` and Bong Goggles relationship/social-policy contracts own block and messaging eligibility.
- `BongGogglesPrivateMessaging420` binds active Messenger conversations to Bong Goggles private contexts, device-key commitments and private epochs.
- `BongGogglesCommunityRegistry420` owns canonical Bong Goggles group existence, privacy and membership state.
- 420Resource/420Storage may carry encrypted payload/attachment bytes, but providers never become message-content authority.
- BG-13 media/storage delivery is reused for private attachments with messaging authorization layered above it.

## Phase roadmap

### BG-14.1 — conversation/request projection + canonical context resolver — COMPLETE AND QUALIFIED

- Project canonical Messenger conversation state into Bong Goggles inbox/request views.
- Distinguish incoming requests, outgoing requests, active conversations and closed conversations.
- Re-read current block and Bong Goggles `canMessage` policy rather than caching durable permission.
- Validate Bong Goggles private-context bindings against the exact Messenger conversation and participants.
- Expose wallet-authorized intents for request, accept, close and private-context binding; the service never signs or executes them.
- Exclude plaintext, ciphertext, keys, credentials, sessions and transport routes from canonical/application projections.

### BG-14.2 — encrypted send/receive bridge — COMPLETE AND QUALIFIED

- Coordinate outbound/inbound application delivery over canonical `MessengerEnvelopeRegistry420` commitments.
- Require exact sender/recipient/conversation binding, active conversation state, current block/social policy and current Bong Goggles private epoch.
- Enforce exact per-sender next-sequence semantics before wallet commit intent construction.
- Bind transport metadata to canonical envelope hash and storage-reference hash before presentation.
- Keep ciphertext payload bytes off-chain and outside public projections; only an opaque bounded ciphertext reference is passed through the application bridge.
- Reject plaintext, message bodies, private keys, session secrets and credentials from transport-envelope DTOs.
- Expose wallet-authorized `commit` and recipient `acknowledge` intents without signing/executing them.
- Preserve deterministic retry/replay behavior through canonical sequence + envelope identity rather than transport arrival order.

### BG-14.3 — inbox, unread/read and request state — COMPLETE AND QUALIFIED

- Materialize inbox/request/conversation summaries strictly from current canonical conversations, envelopes and receipts.
- Distinguish incoming requests, outgoing requests and active/closed conversations without inventing separate application authority.
- Rebuild unread counts from inbound canonical envelopes whose canonical receipt has no `readAt`; viewer-sent envelopes never increment unread count.
- Order inbox deterministically with incoming requests first, then latest canonical message timestamp, then conversation ID as a stable tie-breaker.
- Paginate with canonical conversation IDs as deterministic cursors and bounded page sizes.
- Keep local presentation state non-authoritative and separate from canonical delivery/read receipt state.
- Rebuild materialized inbox state from current canonical inputs after reorg/replay so removed/replaced envelopes cannot leave stale unread counts or last-message pointers.
- Fail closed on conversation/envelope participant mismatch and impossible receipt ordering (`readAt` without `deliveredAt`).

### BG-14.4 — permitted group threads — COMPLETE AND QUALIFIED

- Treat `BongGogglesCommunityRegistry420` as canonical group/membership authority; only ACTIVE members may read or send through a private group thread.
- Keep the group-thread descriptor application-level and explicitly non-authoritative; it binds `groupId`, thread ID, group epoch commitment, membership digest and exact active-member set.
- Compute the membership digest deterministically from canonical active membership + roles so joins, removals and role/security changes make an old descriptor stale.
- Require group-epoch rotation whenever the canonical membership digest changes before further group-thread read/send presentation is allowed.
- Deliver group messages as per-recipient fan-out over already-canonical direct `MessengerConversationRegistry420` + `BongGogglesPrivateMessaging420` contexts; no parallel group conversation authority is invented.
- Revalidate each recipient's direct conversation, private context, block state, message policy and direct epoch before fan-out.
- Fail the fan-out plan closed when any required recipient route is unavailable instead of silently omitting a current group member.
- Keep public/Commons group-channel semantics separate: a PUBLIC Bong Goggles group does not make a Commons channel a private Messenger thread.

### BG-14.5 — private attachments — COMPLETE AND QUALIFIED

- Reuse BG-13 canonical `mediaRoot`, manifest descriptor, item ID and 420Storage object identity rather than introducing messaging-specific storage identity.
- Bind each attachment descriptor to the exact active Messenger conversation, Bong Goggles private context and current private epoch.
- Require exact `BongGogglesMediaRegistry420` owner/mediaRoot/manifestHash identity plus exact manifest item -> storage object identity before association or presentation.
- Permit upload association only for the attachment owner and only while current block/social messaging policy remains eligible.
- Permit retrieval presentation only to current canonical conversation participants and re-read conversation/context/block/policy state on every authorization.
- Delegate actual upload preparation, ingest verification and full-object retrieval verification to the already-qualified BG-13 media/storage services.
- Reject attachment/decryption keys, signed/private/provider URLs, credentials, tokens, cookies, session secrets, payload bytes, plaintext and ciphertext from attachment descriptors/public projections.
- Preserve immutable storage/media provenance when a conversation closes, a block is introduced, a context closes or an epoch rotates; those lifecycle events remove current presentation eligibility instead of rewriting storage history.

### BG-14.6 — safety, devices, epoch rotation and recovery — IN PROGRESS

- Re-read current profile activity, bilateral block state, Bong Goggles `canMessage`, spam/request eligibility, Messenger conversation state, Bong Goggles private-context state, device-key record and private epoch before each protected send/read authorization.
- Treat device-key `{ keyCommitment, revision, active }` from `BongGogglesPrivateMessaging420` as canonical device security metadata; application caches may never override a newer revision or revocation.
- Reject stale device revisions, revoked devices, stale private epochs and stale epoch commitments even when a previously authorized session remains reachable.
- Expose wallet-authorized device set/revoke, epoch rotation and context-close intents; the service never signs or executes them.
- Model device-loss recovery as an ordered plan: establish/refresh the surviving device commitment, revoke lost devices, then rotate every affected private context to a fresh externally produced epoch commitment.
- Require a fresh canonical read after every recovery stage before continuing to prevent recovery from racing a block, closure, device revision or epoch change.
- Keep private device keys and decrypted epoch material entirely outside the service plan; only commitments and opaque device/context identifiers are handled.
- Fail closed immediately after block, message/spam policy denial, profile disablement, Messenger conversation closure, Bong Goggles context closure, device revocation/revision or epoch rotation.

### BG-14.7 — production messaging closeout

- Add delivery/receipt latency, retry, failure and abuse telemetry with strict secret redaction.
- Run transport loss, duplicate/replay, stale epoch, device loss, blocked-peer and attachment-failure drills.
- Run bounded inbox/send/receipt/attachment load qualification.
- Add operator runbook, recovery procedures and exact-head phase qualification.
- Reconcile with latest `main`, qualify, then merge BG-14 once.

## BG-14 invariants

1. Plaintext messages and decrypted attachment bytes never become chain state or public index data.
2. Bong Goggles never invents conversation authority parallel to 420Messenger.
3. A request/active/closed state is presented only from the canonical Messenger conversation record.
4. A Bong Goggles private context must bind the exact active Messenger conversation and exact participants.
5. Block and `canMessage` policy are re-evaluated from current canonical/social state before send eligibility.
6. Application transaction intents never sign or execute on behalf of a user; wallet/session authorization remains mandatory.
7. Message sequence/envelope identity and receipt state are never inferred from transport arrival order alone.
8. Device-key commitments and epoch commitments may be public metadata; private keys and decrypted epoch material never are.
9. Private attachments reuse canonical BG-13/420Storage identity and cannot substitute URLs/provider routes for object identity.
10. Closing, blocking or rotating presentation/security state does not rewrite historical canonical envelope/receipt/storage provenance.
11. Logs, metrics and alerts redact message bodies, ciphertext where unnecessary, keys, tokens, cookies, session IDs and credentials.
12. 420Commons remains authoritative for public/community channels; BG-14 does not silently convert them into Messenger conversations.
13. Outbound message sequence must equal canonical sender sequence + 1; retries do not invent a new sequence.
14. Inbound transport payload metadata must match the canonical envelope commitment exactly before the application may present it.
15. A stale private epoch cannot send or present a message even if the envelope transport is otherwise reachable.
16. Delivery/read acknowledgements can only be constructed for the canonical recipient and remain wallet/session authorized.
17. Inbox unread counts are derived from canonical envelopes and canonical receipt state, never incremented/decremented as independent authority.
18. Reorg/replay rebuild must be able to remove stale unread counts and last-message pointers when canonical envelopes disappear or change.
19. A read receipt without a delivery receipt is invalid for presentation and must fail closed.
20. Inbox ordering and pagination are deterministic from canonical request state, canonical message time and conversation identity.
21. Group-thread membership eligibility derives only from current canonical `BongGogglesCommunityRegistry420` ACTIVE membership.
22. A changed canonical group membership/role set invalidates the previous group membership digest and requires a new group epoch before presentation or send.
23. Every group-thread recipient is delivered through a canonical direct Messenger/private context; group fan-out never creates parallel conversation authority.
24. Group fan-out fails closed if any current recipient lacks an eligible direct route; it may not silently shrink the canonical member set.
25. PUBLIC group/community visibility does not convert a Commons/public channel into private Messenger authority.
26. A private attachment must resolve to the exact canonical BG-13 mediaRoot/manifest/item/storage-object identity before messaging may associate or present it.
27. Attachment association is allowed only to the attachment owner in a currently eligible active Messenger/private context.
28. Attachment presentation eligibility is re-evaluated at read time; closing/blocking/context closure/epoch rotation revokes presentation without mutating immutable storage provenance.
29. Attachment descriptors and public projections never contain attachment/decryption keys, signed/private/provider URLs, credentials, tokens, session secrets or payload bytes.
30. A cached messaging capability is never durable authority: current profile/block/policy/conversation/context/device/epoch state must be re-read before protected send/read use.
31. Device revocation or revision invalidates any capability tied to an older device revision without rewriting historical message provenance.
32. Private epoch rotation invalidates any capability tied to the prior epoch or epoch commitment immediately.
33. Device-loss recovery never transports private key or decrypted epoch material through Bong Goggles services; it coordinates commitments and wallet-authorized intents only.
34. Recovery must refresh canonical state between device establishment, lost-device revocation and context epoch rotation stages.

BG-14 is developed on `feature/bong-goggles-bg14-private-messaging` after BG-13 merged to `main` in PR #308.
