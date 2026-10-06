# 420Mail MAIL-2.8 qualification evidence

Step: **MAIL-2.8 — Threads & Conversations**  
Status: **COMPLETE**  
Qualification level: **Level 1 — per-roadmap-step fast qualification**

## Repository identity

- Accumulated Phase 2 PR: **#530 — feat(mail): Phase 2 mailbox foundation (MAIL-2.1–2.8)**
- Audit/feature branch: `mail-2-1-mailbox-state-model-20261005`
- Reconciliation/base `main` SHA: `f5fe16414893a1e4bd4f3db22eb36b685a2030f5`
- Current-main reconciliation merge commit before final qualification: `a3c55d483b2be9e23545477ef1a93946f26b79a6`
- Qualified implementation branch SHA: `10fbe491bc661f146ddc5172a94f1b55a4edff7c`
- Exact GitHub PR merge-candidate SHA tested by CI: `3d311960ce04f4b9edf284938a34eac09a40491e`
- Roadmap bookkeeping SHA: `6b98ef0dc1bb29997f842c76d9aedfd367ac4e34`
- CI workflow: **420Mail Audit Qualification**
- Final implementation CI run: **37416818080** (run #141)
- Final implementation CI job: **112117143703** (`mail-audit`) — PASS

The roadmap closeout and this evidence record are bookkeeping/evidence-only changes. They do not alter executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state, or substantive MAIL-2.8 requirements. Under the phase qualification policy they inherit the exact implementation qualification above without recursive Level 1 qualification.

## Canonical definition

The canonical Phase 2 roadmap defines MAIL-2.8 exactly as:

> **MAIL-2.8 — Threads & Conversations** — Add replies, participant/thread views, thread archive/mute, and conversation ordering.

MAIL-2.8 is an ordinary app-scoped Level 1 step inside the documented **Mailbox foundation milestone (MAIL-2.1 through MAIL-2.10)**.

## Pre-step gap analysis

Before MAIL-2.8:
- messages exposed an optional passive `conversation_id` field but no canonical thread lifecycle;
- callers could supply arbitrary conversation IDs;
- there was no explicit reply-parent relation;
- there was no owner-scoped conversation index;
- there were no conversation summaries or participant views;
- there was no conversation detail API;
- there was no durable thread archive state;
- there was no durable thread mute state;
- there was no deterministic conversation-list ordering;
- there was no migration for historical messages without canonical conversation IDs.

## Requirements satisfied

### Replies — PASS

MAIL-2.8 adds explicit parent-message-bound replies.

Every root message now receives a deterministic conversation ID derived from its canonical message ID.

A reply:
- records `reply_to`;
- inherits the parent's canonical conversation ID;
- requires the replying actor to own a non-deleted mailbox copy of the parent;
- requires the recipient to be the other participant in the parent message;
- rejects a mismatched caller-supplied conversation ID;
- rejects use of a permanently deleted parent copy;
- remains subject to existing Identity, Messenger, trust, spam/phishing, storage and idempotency controls.

A typed `Reply` service/client operation and `POST /v1/messages/{id}/reply` convenience route infer the counterparty from the parent message.

The lower-level send path independently rechecks reply/conversation authority inside the durable transaction, preventing preflight-to-commit races.

### Conversation injection defense — PASS

A new root send cannot attach itself to an arbitrary supplied conversation ID.

A reply cannot:
- select a different canonical conversation than its parent;
- choose an unrelated recipient;
- use a parent the actor does not own;
- use an owner-deleted parent.

These checks prevent guessed conversation IDs from being used to splice unrelated mail into another user's thread view.

### Participant/thread views — PASS

MAIL-2.8 adds owner-scoped conversation summaries and detail views.

Conversation summaries expose:
- canonical conversation ID;
- sorted participant identities;
- owner-visible message count;
- latest owner-visible timestamp;
- owner-specific conversation state.

Conversation detail returns only message copies represented in the authenticated owner's mailbox state.

Foreign actors receive no conversation visibility merely by knowing a conversation ID.

### Conversation ordering — PASS

Conversation detail uses deterministic ordering:
1. `created_at` ascending;
2. message ID ascending as the tie-breaker.

Conversation summaries use deterministic ordering:
1. latest owner-visible message timestamp descending;
2. conversation ID ascending as the tie-breaker.

Tests cover both chronological thread ordering and newest-thread-first summary ordering.

### Thread archive — PASS

Conversation archive state is owner-scoped and durable.

Archiving a thread:
- marks the owner's conversation state archived;
- moves the owner's recipient-side Inbox copies for that conversation to Archive;
- leaves Sent copies in Sent;
- causes future ordinary Inbox deliveries to that archived conversation to materialize in Archive.

Unarchiving:
- clears owner thread archive state;
- restores recipient copies that were archived from Inbox back to Inbox.

MAIL-2.7 quarantine remains stronger than thread archive. Suspicious mail still goes to Junk rather than allowing archived-thread policy to bypass quarantine.

### Thread mute — PASS

Conversation mute state is owner-scoped and durable.

Future incoming mail in a muted conversation:
- is marked muted on the recipient mailbox copy;
- suppresses the normal recipient notification;
- remains delivered.

Thread mute does not create blocking authority and does not replace MAIL-2.6 trust controls.

### Durable storage and migration — PASS

Durable metadata schema advanced from **v5 to v6**.

Schema v6 adds:
- `ConversationStates`;
- `ConversationIndex`;
- durable message `conversation_id`;
- optional `reply_to` parent linkage.

The owner/conversation secondary index is rebuilt from authoritative mailbox/message state.

Migration from v5:
- deterministically backfills historical messages lacking conversation IDs as independent root conversations;
- rebuilds owner conversation indexes;
- preserves prior mail rather than guessing relationships between historical messages.

Conversation state survives durable-store restart.

Current-schema validation requires canonical conversation IDs and validates reply-parent existence/conversation consistency.

### Growth bound — PASS

The repository baseline bounds owner-visible conversation growth at **1000 messages per conversation**.

Reply resolution fails closed when the canonical owner conversation is already at the configured bound.

### Authenticated API/client surface — PASS

HTTP and typed client support now includes:
- `POST /v1/messages/{id}/reply`;
- `GET /v1/conversations`;
- `GET /v1/conversations/{conversation_id}`;
- `PATCH /v1/conversations/{conversation_id}`.

Unknown JSON fields fail closed.

### Privacy / authority boundaries — PASS

MAIL-2.8:
- introduces no Mail-owned smart contract;
- introduces no wallet signing/custody authority;
- introduces no public conversation index;
- does not expose thread membership to public 420Search;
- persists only private application metadata;
- keeps private message bodies behind the private blob-store boundary;
- preserves Identity/Messenger/Storage/Notifications ownership boundaries;
- does not alter the frozen Genesis application catalog.

## Implementation summary

MAIL-2.8 introduced or materially changed:

- `mail/conversation.go`
- `mail/conversation_test.go`
- `mail/service.go`
- `mail/store.go`
- `mail/store_test.go`
- `mail/http.go`
- `mail/http_test.go`
- `mail/client/client.go`
- `config/420mail-service-v1.json`
- `docs/420MAIL.md`
- `scripts/verify-420mail-audit.py`
- `docs/420MAIL-PHASE2-ROADMAP.md` — closeout bookkeeping only after implementation qualification.

The branch was reconciled against current `main` before final qualification. The reconciliation used current-main as the base tree and overlaid only the active Mail Phase 2 diff, preserving unrelated current-main changes.

## Security / adversarial / boundary coverage

MAIL-2.8 qualification includes tests for:
- deterministic root conversation IDs;
- explicit reply-parent linkage;
- inherited conversation IDs;
- counterparty inference;
- participant inventory;
- chronological conversation detail ordering;
- newest-thread-first list ordering;
- owner-scoped conversation reads;
- foreign reply rejection;
- arbitrary root conversation injection rejection;
- reply conversation mismatch rejection;
- reply recipient mismatch rejection;
- permanently deleted parent reply rejection;
- archive state;
- archive movement of current recipient Inbox copies;
- archive behavior for future incoming replies;
- unarchive restoration;
- mute state;
- muted-thread notification suppression;
- durable v5 -> v6 migration;
- historical root-thread backfill;
- conversation index rebuild;
- durable conversation-state restart recovery;
- strict HTTP JSON decoding;
- retained MAIL-2.1 through MAIL-2.7 regression coverage;
- race-detector coverage.

## Qualification history

Non-passing/superseded runs are not completion evidence.

1. **Run #134 / 37416560315 / job 112116345947** — stopped at Go-format. Behavioral/static checks correctly did not run.
2. Exact formatter output was applied.
3. **Run #138 / 37416647815 / job 112116620554** — reached `go test` and exposed two fixture issues:
   - the HTTP ordering fixture used an identical fixed timestamp for root and reply while expecting chronological insertion order even though the documented tie-breaker is message ID;
   - an older current-schema durable-index fixture constructed a v6 message without the now-required conversation ID.
   The fixtures were corrected without weakening production invariants.
4. **Run #140 / 37416754526 / job 112116955494** — build failed because the updated HTTP test used `time` without importing it. This was a test-harness compile defect and was fixed directly.
5. **Run #141 / 37416818080 / job 112117143703** — final authoritative implementation qualification: PASS.

## Final Level 1 qualification

Workflow: **420Mail Audit Qualification**  
Run: `37416818080` (#141)  
Job: `112117143703`  
Qualified branch implementation: `10fbe491bc661f146ddc5172a94f1b55a4edff7c`  
Exact PR merge candidate: `3d311960ce04f4b9edf284938a34eac09a40491e`  
Reconciliation base: `f5fe16414893a1e4bd4f3db22eb36b685a2030f5`

CI checkout explicitly recorded:

`HEAD is now at 3d31196 Merge 10fbe491bc661f146ddc5172a94f1b55a4edff7c into f5fe16414893a1e4bd4f3db22eb36b685a2030f5`

Results:
- exact head — PASS;
- Go format — PASS;
- `go test ./mail/...` — PASS;
- `go test -race ./mail/...` — PASS;
- `go vet ./mail/...` — PASS;
- `python3 scripts/verify-420mail-audit.py` — PASS.

## Level 2 status

**Intentionally deferred.**

MAIL-2.8 remains inside the documented **Mailbox foundation milestone (MAIL-2.1 through MAIL-2.10)**. The retained broader Mail integration suite remains scheduled for completion of **MAIL-2.10**, unless a later shared-dependency change makes earlier Level 2 qualification necessary.

## Intentionally deferred Level 3 checks

Level 3 remains deferred to complete app-phase closeout.

MAIL-2.8 changes no Solidity contract, Genesis/frozen address, consensus code, token settlement authority, public Indexer authority or shared on-chain protocol.

Therefore full repository Foundry inventory, Genesis/address-authority closeout, Geth qualification, 420 Integrated global qualification and global Docs closeout were not repeated for this ordinary app-scoped step.

## Limitations / downstream work

MAIL-2.8 does not implement:
- Draft autosave/recovery/edit/discard/multi-device behavior — MAIL-2.9;
- queued delivery/outbox lifecycle — MAIL-2.10;
- later wallet-native identity and external integration phases;
- full desktop conversation UI — MAIL-2.30;
- live public-testnet integration or production operational qualification.

None of those later roadmap obligations blocks MAIL-2.8 from satisfying its own Level 1 exit criteria.

## Completion

**MAIL-2.8 — Threads & Conversations: COMPLETE at Level 1.**

Next canonical roadmap step: **MAIL-2.9 — Drafts System**.
