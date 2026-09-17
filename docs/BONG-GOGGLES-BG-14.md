# Bong Goggles BG-14 — Full Private Messaging

BG-14 builds the Bong Goggles application messaging layer over the already-canonical 420Messenger contracts and `BongGogglesPrivateMessaging420`. It does not create a second messaging protocol and it never makes plaintext or ciphertext chain state.

## Canonical ownership

- `MessengerConversationRegistry420` owns direct conversation identity and `REQUESTED -> ACTIVE -> CLOSED` state.
- `MessengerEnvelopeRegistry420` owns canonical encrypted-envelope commitments/sequence metadata, not plaintext.
- `MessengerReceiptRegistry420` owns delivery/read acknowledgement state.
- `MessengerBlockRegistry420` and Bong Goggles relationship/social-policy contracts own block and messaging eligibility.
- `BongGogglesPrivateMessaging420` binds active Messenger conversations to Bong Goggles private contexts, device-key commitments and private epochs.
- 420Resource/420Storage may carry encrypted payload/attachment bytes, but providers never become message-content authority.
- BG-13 media/storage delivery is reused for private attachments with messaging authorization layered above it.

## Phase roadmap

### BG-14.1 — conversation/request projection + canonical context resolver — IN PROGRESS

- Project canonical Messenger conversation state into Bong Goggles inbox/request views.
- Distinguish incoming requests, outgoing requests, active conversations and closed conversations.
- Re-read current block and Bong Goggles `canMessage` policy rather than caching durable permission.
- Validate Bong Goggles private-context bindings against the exact Messenger conversation and participants.
- Expose wallet-authorized intents for request, accept, close and private-context binding; the service never signs or executes them.
- Exclude plaintext, ciphertext, keys, credentials, sessions and transport routes from canonical/application projections.

### BG-14.2 — encrypted send/receive bridge

- Build application send/receive coordination over Messenger envelope IDs, sequence rules and encrypted-envelope commitments.
- Keep encryption/decryption client-side or trusted endpoint-side; no plaintext reaches chain/index/search logs.
- Validate sender, conversation, sequence, epoch and envelope commitment before presentation.
- Make retry/idempotency behavior deterministic and replay-safe.

### BG-14.3 — inbox, unread/read and request state

- Materialize inbox/request/conversation summaries from canonical conversations, envelopes and receipts.
- Track local presentation metadata separately from canonical delivery/read receipts.
- Implement pagination, unread counters, last-message ordering and request acceptance/closure refresh.
- Fail closed across reorgs and canonical state changes.

### BG-14.4 — permitted group threads

- Define Bong Goggles group-thread application contexts only where the owning group/community membership policy permits them.
- Reuse 420Messenger/private-context primitives without converting public Commons channels into private Messenger authority.
- Revalidate membership and epoch eligibility at send/read time.
- Rotate group epochs on membership/security changes where required.

### BG-14.5 — private attachments

- Reuse BG-13 descriptor/storage identity, upload and verified retrieval machinery for attachments.
- Require active conversation/context authorization before upload association or retrieval presentation.
- Keep attachment keys, private URLs, provider credentials and payload bytes out of public indexes/logs.
- Preserve immutable storage provenance while allowing message/context lifecycle to remove presentation eligibility.

### BG-14.6 — safety, devices, epoch rotation and recovery

- Integrate blocks, message policy, spam/request controls and report hooks.
- Handle device-key set/revoke flows and stale-device failure semantics.
- Implement private epoch rotation and recovery flows without exposing key material.
- Invalidate send/read capability promptly after blocks, closure, profile disablement, device revocation or epoch change.

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

BG-14 is developed on `feature/bong-goggles-bg14-private-messaging` after BG-13 merged to `main` in PR #308.
