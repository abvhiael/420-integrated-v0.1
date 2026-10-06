# 420Mail

420Mail is the provider-neutral, identity-addressed ecosystem inbox defined by the GEN-SVC consumer-service architecture.

## Canonical status

The authoritative frozen Genesis application catalog is `config/genesis-applications.json`. 420Mail is **not** currently a frozen Genesis application in that file. It is a `GENESIS_SHARED_INFRASTRUCTURE_AND_THIN_UI` implementation target in `config/genesis-consumer-services.json`. Promotion into the frozen catalog requires a separate explicit decision.

Service ID: `420/service/mail/v1`. Authority: `REPLACEABLE_COMMUNICATION_SERVICE`.

420Mail has no canonical smart contract and no independent settlement, wallet, identity, rights, governance, registry, bridge, validator, treasury, or custody authority.

## Purpose and boundaries

Provide a private ecosystem inbox addressed by 420Identity references. Genesis scope is internal ecosystem delivery only. External SMTP is explicitly disabled by `mail.external_smtp=false`.

- 420Identity resolves sender/recipient identity references.
- 420Messenger supplies message eligibility/block policy.
- 420Storage supplies private off-chain body storage.
- 420Notifications receives optional non-authoritative delivery signals.
- Mail metadata is application state, not consensus.
- Message bodies remain off-chain and are excluded from public indexing.
- Wallet private keys are never handled by 420Mail.
- Retriable send uses a sender-scoped idempotency key; conflicting reuse fails closed. Ordinary user-authenticated sends must use the canonical `420/service/mail/v1` source, preventing callers from impersonating another ecosystem application. Signed application-generated mail requires a separately qualified source-authorization path.
- Visibility is `PRIVATE`.

## API and client

Stable prefix: `/v1`.

- `POST /v1/messages`
- `GET /v1/inbox?cursor=&limit=`
- `GET /v1/messages/{id}`
- `POST /v1/messages/{id}/read`
- `POST /v1/messages/{id}/unread`
- `GET /v1/mailboxes/{INBOX|SENT|OUTBOX|DRAFTS|ARCHIVE|JUNK|TRASH}?cursor=&limit=`
- `GET /v1/messages/{id}/mailbox`
- `PATCH /v1/messages/{id}/mailbox`
- `POST /v1/messages/{id}/restore`
- `DELETE /v1/messages/{id}` (permanent owner-scoped deletion after Trash)

The HTTP handler requires an injected authentication function and does not trust a user-supplied sender header as identity proof. `mail/client` is the typed Go client.


## Phase 2 mailbox state model

The canonical Phase 2 roadmap is `docs/420MAIL-PHASE2-ROADMAP.md`. MAIL-2.1 defines owner-scoped mailbox state separately from shared message metadata/body storage.

System folders are `INBOX`, `SENT`, `OUTBOX`, `DRAFTS`, `ARCHIVE`, `JUNK`, and `TRASH`.

- A successfully delivered message creates `INBOX` state for the recipient and `SENT` state for the sender.
- Recipient mailbox moves are restricted to Inbox/Archive/Junk/Trash lifecycle transitions.
- Sender mailbox moves are restricted to Sent/Archive/Trash lifecycle transitions.
- `DRAFTS` and `OUTBOX` are defined now but are reserved for MAIL-2.9 and MAIL-2.10; delivered messages cannot be manually moved into them.
- Trash restoration returns to the immediately previous legal folder, with Inbox/Sent fallback only if prior state is unusable.
- Permanent deletion is owner-scoped, requires Trash first, hides the message and body from that owner, and does not delete the counterparty's independent mailbox copy.
- Mailbox read/unread is owner-view state. The message-level `ReadAt` remains a first-read delivery receipt and is not erased when the recipient marks a message unread.
- Starred, pinned, and muted are owner-scoped mailbox flags.
- Archive/Junk/Trash/permanent-delete timestamps and state versions are retained in mailbox state.
- Message bodies remain private/off-chain. MAIL-2.1 adds no on-chain mail authority.

MAIL-2.2 replaces the repository-only in-memory metadata path with a durable transactional store implementation for production-equivalent Mail runtime composition.

### Durable metadata store

`mail/store.go` provides a provider-neutral `MailStore` transaction interface plus:

- `OpenDurableStore(path)` for an atomic file-backed durable store;
- schema versioning and forward-version rejection;
- schema-zero migration initialization;
- durable message metadata, mailbox state, sender-scoped idempotency evidence, and owner/folder secondary indexes;
- atomic temp-file + fsync + rename commits;
- 0600 state/lock-file permissions;
- process-local serialization plus OS advisory file locking so multiple Mail processes sharing the same durable path observe one transactional state;
- index rebuild/validation on load;
- fail-closed corrupt-store handling;
- transaction rollback when a callback fails;
- restart recovery and immediate cross-instance visibility.

`NewDurableService(..., path)` is the durable service constructor. `NewService(...)` requires the caller to select a `MailStore` explicitly; there is no implicit in-memory fallback. Tests/development may explicitly pass `NewMemoryStore()`, while deployed Mail must use a durable `MailStore`.

Distributed idempotency is enforced by rechecking the sender-scoped idempotency key inside the exclusive durable transaction before commit. Multiple instances sharing the same transactional store cannot commit two logical messages for the same sender/key. Conflicting payload reuse fails closed with `ErrIdempotencyConflict`.

The built-in file implementation requires all cooperating instances to share a filesystem with correct advisory-lock and atomic-rename semantics. A database-backed `MailStore` may replace it later without changing service semantics.

## Labels and custom folders

MAIL-2.3 adds owner-scoped organization metadata without changing delivery folders or private body storage.

- Users may create up to 100 labels and 50 custom folders.
- Label and custom-folder names are normalized and case-insensitively unique per owner.
- System folder names cannot be reused as custom-folder names.
- System labels `STARRED`, `PINNED`, `MUTED`, and `UNREAD` are created per owner, are immutable, and expose live virtual views derived from each owner's mailbox flags/read state rather than accepting manual assignment.
- A mailbox copy may hold up to 20 user labels and at most one custom folder assignment.
- Bulk organization updates are transactional for up to 100 message IDs: any missing/unauthorized message or invalid label/folder aborts the whole update.
- Label/custom-folder definitions and message assignments persist in the durable store and survive restart.
- Owner/label and owner/custom-folder secondary indexes support direct organization views without exposing private mail to public search.
- Deleting a user label or custom folder removes only that owner's organizational metadata/assignments; it does not delete the message or the counterparty's mailbox state.
- Labels/custom folders remain off-chain application metadata.

API additions:

- `GET|POST /v1/labels`
- `DELETE /v1/labels/{id}`
- `GET /v1/labels/{id}/messages`
- `GET|POST /v1/custom-folders`
- `DELETE /v1/custom-folders/{id}`
- `GET /v1/custom-folders/{id}/messages`
- `PATCH /v1/messages/{id}/organization`
- `PATCH /v1/organization/bulk`

## Private Mail Search

MAIL-2.4 adds authenticated, owner-scoped mailbox search without publishing Mail content or search indexes to 420Search.

- `POST /v1/search` accepts a bounded `SearchRequest`.
- Search is scoped strictly to mailbox copies owned by the authenticated actor.
- Permanently deleted mailbox copies are excluded.
- Metadata search covers sender, recipient, subject, source, system folder, assigned label names, and assigned custom-folder names.
- Private message bodies are searched on demand through the configured `PrivateBlobStore`; body plaintext is not copied into the durable metadata store or any public index.
- Search can filter by system folder, label, custom folder, sender, recipient, source, unread/read state, starred state, and date bounds.
- Queries are limited to 256 bytes, each request scans at most 500 owner-visible mailbox items, opaque continuation cursors make later mailbox segments searchable, and result pages remain capped at 100.
- Unknown/foreign label or custom-folder identifiers fail closed rather than widening the search.
- Search returns mailbox/message metadata; it does not return body plaintext in the search result payload.
- No 420Search/public-index publication is introduced by MAIL-2.4.

## User Filters & Rules Engine

MAIL-2.5 adds durable, owner-scoped rules that automatically organize an incoming recipient mailbox copy inside the same transaction that materializes delivery.

Conditions are ANDed when more than one is supplied:

- `sender_equals` — exact identity-address comparison;
- `content_contains` — case-insensitive substring match across subject and the private body supplied during delivery;
- `source_equals` — exact source-service comparison.

Supported automated actions are:

- move the recipient copy to Inbox, Archive, Junk, or Trash;
- add owner-scoped user labels;
- assign or clear an owner-scoped custom folder;
- mark the owner copy read/unread without creating a false message-level human read receipt;
- set starred, pinned, or muted owner-view flags;
- stop processing lower-priority rules after the current rule.

Rules are evaluated deterministically by ascending priority, then creation time/ID. Disabled rules do not execute. Multiple enabled matching rules compose unless `stop_processing` is set.

Rule definitions are durable application metadata in store schema v3. Rule names are normalized and case-insensitively unique per owner. Each owner may create up to 100 rules; match strings and rule actions are bounded. Rule actions cannot target another owner's labels/folders or the Sent/Drafts/Outbox lifecycle classes. Deleting an organization target removes that target from dependent rules and deletes a rule if it would otherwise have no mailbox action.

The delivery path evaluates recipient rules using the already-authorized private send payload before committing the recipient mailbox state. Rule execution does not publish body text, rule conditions, or rule results to public 420Search or on-chain state.

API additions:

- `GET|POST /v1/rules`
- `PUT /v1/rules/{id}`
- `DELETE /v1/rules/{id}`

## Blocklists, Allowlists & Trust Controls

MAIL-2.6 adds durable owner-scoped trust policy for identities, phrases, and application/source identifiers.

Each trust entry has one disposition:

- `BLOCK` — reject a new incoming delivery that matches the entry;
- `ALLOW` — mark matching mail trusted for allowlist policy and permit a trusted identity/application to bypass phrase blocks;
- `MUTE` — keep delivery but suppress the recipient notification and mark the recipient mailbox copy muted.

Trust evaluation is deterministic:

1. an explicit blocked sender identity or blocked application/source rejects the new delivery;
2. an explicitly allowed sender identity or application marks the delivery trusted;
3. blocked phrases reject only when the sender/application is not already trusted;
4. allowed phrases may satisfy optional allowlist-only mode;
5. matching mute entries suppress notification;
6. when `require_trusted` is enabled, mail with no matching ALLOW entry is rejected.

A recipient's trust policy is checked before private-body storage for a new logical send and checked again inside the durable delivery transaction. The second check prevents a concurrent trust-policy change from being bypassed. A sender-scoped idempotent replay of a delivery already committed before a later block still returns the existing logical message rather than retroactively failing.

Identity/application/phrase values are normalized case-insensitively. Each owner may keep up to 250 trust entries. Rules and trust controls are separate: MAIL-2.5 organizes accepted mail; MAIL-2.6 may reject it before delivery. Trust mute has final precedence over a mailbox rule attempting to unmute the same incoming copy.

Trust entries/settings are durable application metadata in store schema v4 and are never published to public 420Search or on-chain state.

API additions:

- `GET /v1/trust/entries`
- `PUT /v1/trust/entries`
- `DELETE /v1/trust/entries/{id}`
- `GET /v1/trust/settings`
- `PUT /v1/trust/settings`

## Spam, Junk & Phishing Protection

MAIL-2.7 adds repository-level defenses for spam, junk delivery and phishing while preserving private-mail and ecosystem authority boundaries.

### Reputation and abuse state

420Mail keeps **owner-scoped sender reputation**. A recipient's abuse decisions affect that recipient's future handling of the sender; they do not become protocol identity authority or a public global reputation score.

Recipients may report a delivered message as:

- `SPAM`
- `PHISHING`

A report is idempotent per owner/message. Reusing the same report returns the existing record; trying to relabel the same report as another abuse class fails closed. A sender cannot report their own Sent copy as recipient abuse.

Spam reports add one recipient-local risk point; phishing reports add two. A user-approved false-positive release subtracts one effective point, bounded at zero. Reputation metadata records delivery/quarantine/report counts but never stores the private message body.

### Duplicate/fingerprint defense

Accepted deliveries record a normalized cryptographic content fingerprint derived from subject and body. The fingerprint itself is stored; the body is not.

The fourth repeated delivery of the same normalized content from a sender becomes a spam signal. Explicitly trusted sender/application entries from MAIL-2.6 bypass spam-reputation and duplicate-content signals, but **do not bypass phishing detection**.

This is deterministic duplicate-content protection, not a complete sender/network rate-limiter. Broader rate-limit and operational abuse controls remain in MAIL-2.35.

### Phishing defense

MAIL-2.7 implements conservative deterministic link/lure signals:

- URL user-info tricks such as `trusted.example@evil.example`;
- IP-literal links;
- punycode hostnames;
- insecure `http://` links;
- credential/wallet/urgency lures when a link is present.

A phishing score at or above the configured threshold is quarantined even when the sender is trusted, because a trusted identity may itself be compromised.

The current thin UI renders message bodies with DOM `textContent`, not HTML injection, so repository-baseline message content cannot create active HTML/script links.

### Quarantine semantics

Automatic spam/phishing quarantine:

- materializes the recipient copy in **JUNK**;
- records a durable quarantine reason/score record;
- mutes the recipient copy;
- suppresses the recipient notification;
- overrides MAIL-2.5 mailbox rules that would otherwise move the message out of Junk.

A quarantined message cannot be moved to Inbox/Archive through the generic mailbox-move API. The recipient must explicitly release it through the quarantine review path. Moving a quarantined item to Trash remains allowed.

Explicit release:

- moves a Junk quarantine back to Inbox;
- clears the quarantine mute;
- records a false-positive reputation credit;
- marks the quarantine record released rather than deleting its audit history.

Reporting an already-trashed message does not resurrect it from Trash.

### Durability and privacy

Spam-protection metadata is part of durable store schema v5:

- sender reputation;
- abuse reports;
- quarantine records;
- duplicate-content fingerprint counts.

Existing v4 stores migrate to v5 with initialized protection maps. Private body plaintext remains exclusively in the private blob provider and is not written into Mail metadata, quarantine records, reputation state, public 420Search, or on-chain state.

API additions:

- `POST /v1/messages/{id}/abuse`
- `GET /v1/quarantine`
- `POST /v1/quarantine/{id}/release`
- `GET /v1/reputation/{sender}`

## Threads & Conversations

MAIL-2.8 adds durable, owner-scoped conversation semantics on top of the existing private-message model.

### Conversation identity and replies

Every root message receives a deterministic conversation ID derived from its canonical message ID. Clients cannot attach an arbitrary conversation ID to a new root message.

Replies are parent-message bound. A reply:

- names a parent message through `reply_to`;
- inherits the parent's conversation ID;
- requires the replying actor to own a non-deleted mailbox copy of the parent;
- requires the reply recipient to be the other participant in the parent message;
- rejects a caller-supplied conversation ID that differs from the parent's canonical conversation ID;
- rejects replies to a permanently deleted parent mailbox copy.

The typed convenience route `POST /v1/messages/{id}/reply` infers the other participant from the parent. The lower-level send surface also enforces the same reply/conversation invariants.

Conversation membership remains private application metadata and does not create protocol identity or wallet authority.

### Participant and thread views

Conversation views are owner-scoped. An actor may list only conversations represented by their own non-deleted mailbox copies.

Each summary exposes:

- the canonical conversation ID;
- sorted participant identities;
- owner-visible message count;
- the latest owner-visible message timestamp;
- owner-specific archived/muted thread state.

Conversation detail returns owner-visible messages in deterministic chronological order:

1. `created_at` ascending;
2. message ID ascending as the tie-breaker.

Conversation-list ordering is deterministic:

1. latest message timestamp descending;
2. conversation ID ascending as the tie-breaker.

Permanently deleted owner copies disappear from that owner's conversation index/view without deleting the other participant's copy.

### Thread archive

Archive state is owner-scoped.

Archiving a conversation:

- marks the conversation archived;
- moves the owner's recipient-side Inbox copies in that conversation to Archive;
- leaves Sent copies in Sent;
- causes future non-quarantined Inbox deliveries in that conversation to materialize in Archive.

Unarchiving clears the thread archive state and restores recipient copies that were archived from Inbox back to Inbox.

Quarantine remains stronger than thread archive: MAIL-2.7 phishing/spam quarantine continues to force suspicious mail to Junk rather than allowing thread archive to bypass quarantine.

### Thread mute

Mute state is owner-scoped and durable.

When a future message arrives in a muted conversation:

- the recipient mailbox copy is marked muted;
- the ordinary Mail notification is suppressed.

Muting a thread does not block delivery and does not change the sender's authority. It is distinct from MAIL-2.6 identity/application/phrase trust controls and MAIL-2.7 quarantine.

### Durability and migration

MAIL-2.8 advances the durable metadata schema to v6.

Schema v6 persists:

- owner/conversation state;
- the owner/conversation secondary index;
- canonical message `conversation_id`;
- optional `reply_to` parent linkage.

Existing v5 messages that predate canonical thread IDs are migrated as independent root conversations using a deterministic ID derived from their existing message ID. This preserves prior mail rather than silently grouping unrelated historical messages.

Conversation indexes are rebuilt transactionally from authoritative mailbox/message state. Conversation growth is bounded to 1000 owner-visible messages per thread in the repository baseline.

Private message bodies remain outside conversation metadata and continue to reside only behind the private blob-store boundary.

API additions:

- `POST /v1/messages/{id}/reply`
- `GET /v1/conversations`
- `GET /v1/conversations/{conversation_id}`
- `PATCH /v1/conversations/{conversation_id}`

## Drafts System

MAIL-2.9 adds private, durable draft autosave/recovery/edit/discard semantics without turning drafts into sent mail or public searchable content.

### Private body storage

Draft bodies are never written into the Mail metadata store, public 420Search, or on-chain state. The repository stores only the draft metadata plus a private blob reference/digest. Deployment requires the configured private blob provider to provide the encryption/key-custody guarantees declared for 420 Storage.

Draft metadata includes:

- owner;
- optional recipient;
- optional subject;
- private body reference/digest;
- optional conversation/reply context;
- canonical Mail source;
- created/updated timestamps;
- optimistic revision number.

### Autosave and recovery

A device creates a draft with an owner-scoped `autosave_key`. The draft ID is deterministically derived from the owner plus that autosave key, so retrying the same creation request recovers the already-created draft rather than creating duplicate autosave records.

Recovery surfaces are:

- `GET /v1/drafts` — list the authenticated owner's drafts, newest autosave first;
- `GET /v1/drafts/{id}` — recover one draft and its private body.

A foreign identity cannot recover, edit, list or discard another owner's draft even if it learns a draft ID.

### Edit/autosave and multi-device behavior

Each saved draft has a monotonically increasing `version`.

`PUT /v1/drafts/{id}` requires `expected_version`. The save succeeds only when the supplied revision equals the current canonical revision.

This creates explicit multi-device optimistic concurrency:

1. two devices may recover the same revision;
2. the first successful autosave increments the revision;
3. a stale device cannot silently overwrite the newer canonical draft;
4. stale saves fail with a draft conflict;
5. the stale device must recover the latest revision and consciously reapply/merge its local edits.

The repository does not silently merge private draft text because doing so could corrupt user content or conceal a real cross-device conflict.

### Discard

`DELETE /v1/drafts/{id}?expected_version=N` is version-checked just like autosave.

Discard requires a private blob provider implementing the deletion capability. Successful discard removes both:

- canonical draft metadata;
- the referenced private draft blob.

If private-blob deletion fails after metadata removal, Mail attempts an immediate metadata rollback and returns a service-unavailable draft-delete error rather than falsely claiming successful discard.

A stale device cannot discard a newer revision.

### Bounds and ordering

The repository baseline enforces:

- at most 500 drafts per owner;
- at most 128 bytes per autosave key;
- existing Mail subject/body size bounds;
- deterministic draft ordering by `updated_at` descending then draft ID ascending.

### Durability and migration

MAIL-2.9 introduced durable draft metadata in schema v7. MAIL-2.10 advances the durable metadata schema to v8 so outbox delivery records survive restart while body plaintext remains outside the durable Mail JSON file.

Existing v7 stores migrate to v8 with an initialized delivery queue map; older supported schemas continue through the existing migration path. Draft metadata and body references survive Mail service restart; body recovery continues through the private blob provider.

API additions:

- `POST /v1/drafts`
- `GET /v1/drafts`
- `GET /v1/drafts/{id}`
- `PUT /v1/drafts/{id}`
- `DELETE /v1/drafts/{id}?expected_version=N`

Typed client methods mirror all five operations.

## MAIL-2.10 outbox and delivery queue

MAIL-2.10 turns the previously reserved `OUTBOX` mailbox class into an owner-scoped delivery queue while preserving the qualified synchronous `POST /v1/messages` path for compatibility.

Queued delivery lifecycle states are:

- `QUEUED`;
- `SENDING`;
- `RETRYING`;
- `DELIVERED`;
- `FAILED`;
- `CANCELLED`.

A queued message is materialized in the authenticated sender's `OUTBOX` immediately. The private body is staged through the private blob provider; plaintext is not written into durable Mail metadata, public 420Search, or on-chain state.

Processing a queued item reuses the canonical send path. Successful delivery atomically converges the message to sender `SENT` plus recipient delivery state and records `DELIVERED` evidence on the queue item. A crash after send commit but before queue-finalization is safe to reprocess because canonical send idempotency prevents duplicate message materialization or notification.

Retryable dependency failures move the item to `RETRYING` until the bounded attempt ceiling is reached. Terminal or exhausted delivery moves to `FAILED`. A queued, retrying, or failed item can be cancelled; a sending or delivered item cannot be cancelled through this surface.

Repository baseline bounds:

- maximum three processing attempts per queue item;
- maximum 1000 active queued/sending/retrying/failed items per sender;
- deterministic sender/idempotency-derived message identity;
- owner-only list/get/process/retry/cancel operations;
- durable restart recovery in metadata schema v8.

Authenticated API additions:

- `POST /v1/outbox` — queue a delivery;
- `GET /v1/outbox` — list the authenticated owner's queue history;
- `GET /v1/outbox/{id}` — inspect one queue item;
- `POST /v1/outbox/{id}/process` — process or resume one queued item;
- `POST /v1/outbox/{id}/retry` — move an eligible failed item back to retrying;
- `POST /v1/outbox/{id}/cancel` — cancel an eligible item.

Typed Go client methods mirror these operations.

## Thin UI

`mail/web/index.html` provides inbox, read and compose surfaces. It assumes the deployment shell establishes the authenticated 420Identity. This is repository UI evidence, not deployment evidence.

## Security

Applicable shared threats include SPAM, SYBIL, MESSAGING_ABUSE, INDEX_POISONING and WEBHOOK_REPLAY where adapters use callbacks. Repository controls include actor/sender binding, canonical-source enforcement for the user send path, identity resolution, Messenger policy checks before persistence, private body references, input bounds, idempotency conflict detection, recipient-only read acknowledgement, no public list/search route, injected authentication and bounded pagination.

Deployment still requires network/device rate limits, moderation/operator abuse workflows, attachment policy/scanning if attachments are added, encrypted private body storage, secret handling, observability, backup/restore operations, retention policy, provider failure behavior and live privacy testing. MAIL-2.2 qualifies repository durability/restart semantics; it does not claim production backup/disaster-recovery operations.

## Build and test

```bash
go test ./mail/...
go test -race ./mail/...
go vet ./mail/...
python3 scripts/verify-420mail-audit.py
```

No Solidity build is required because the canonical service has no Mail-owned contracts.

## Deployment order

1. establish authenticated Wallet/420Identity session;
2. configure qualified Identity resolution;
3. configure qualified Messenger policy;
4. configure private 420Storage-compatible body provider;
5. configure Notifications adapter;
6. deploy API/UI behind TLS, request-size limits and rate limits;
7. run live privacy, idempotency, provider-failure, recovery, load and accessibility tests;
8. record URL/runtime hashes and adapter versions;
9. only consider Genesis closeout after an explicit frozen-catalog decision.

## Current limitations

The repository baseline does not prove deployed Identity, Messenger, Storage or Notifications integration; provider encryption/key custody; public-testnet operation; production observability; SMTP; attachments; production network/device spam throttling or moderation operations; or disaster recovery. Those remain release gates.
