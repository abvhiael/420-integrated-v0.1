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

## MAIL-2.11 Email-as-a-Wallet Onboarding

MAIL-2.11 adds four onboarding entry paths without giving 420Mail custody or signing authority:

- Google identity onboarding;
- Apple identity onboarding;
- passkey onboarding;
- existing-wallet onboarding.

The Mail service does **not** verify provider tokens, WebAuthn assertions, wallet signatures, or wallet ownership itself. Those security-sensitive decisions remain delegated to an injected canonical Wallet/420Identity onboarding authority. That authority is responsible for provider validation, subject/email verification where applicable, wallet/identity binding, nonce/challenge freshness, signature/WebAuthn verification, replay prevention, and issuing the ordinary Wallet/Identity session used by the deployment authentication layer.

420Mail accepts only the minimum opaque proof material needed to hand off each ceremony:

- Google: an opaque provider ID token;
- Apple: an opaque provider ID token;
- passkey: an opaque WebAuthn assertion envelope;
- existing wallet: wallet address, canonical authority challenge, and signature.

Mail never accepts a private key, seed phrase, recovery secret, authenticator private key, or passkey private material. JSON input is strict, so unrecognized secret-bearing fields are rejected before the canonical authority adapter is called.

A successful onboarding result is accepted only when it is:

- explicitly marked non-custodial;
- bound to a canonical 420 identity;
- bound to an EVM wallet address;
- accompanied by a non-empty Wallet/Identity session token;
- accompanied by a future session-expiry timestamp;
- tagged with the exact onboarding method that was invoked.

A malformed, custodial, unbound, expired, or method-mismatched authority result fails closed. Mail does not persist onboarding provider credentials, passkey assertions, wallet challenges/signatures, or returned session tokens in its durable metadata store, public 420Search, or on-chain state.

Public pre-session API additions:

- `POST /v1/onboarding/google`
- `POST /v1/onboarding/apple`
- `POST /v1/onboarding/passkey`
- `POST /v1/onboarding/wallet`

The typed Go client mirrors all four methods. The thin web UI exposes the same four choices through a deployment-provided `window.__420_ONBOARDING__` adapter. That adapter performs the actual Google/Apple/passkey/existing-wallet ceremony through canonical Wallet/Identity code. The returned Mail session is held in browser memory only and attached to later API requests; it is not written to local storage.

MAIL-2.11 does not claim live Google/Apple credentials, a production WebAuthn RP ID, a deployed Wallet/Identity session issuer, or public-testnet onboarding. Those remain deployment/testnet evidence gates and must be qualified against the actual provider/runtime in the live MAIL-AUDIT path.

## MAIL-2.12 Passkey-First Security

MAIL-2.12 adds an authenticated Mail security-management surface for passkeys, devices, canonical recovery, session revocation, and security alerts without making 420Mail a wallet, signer, recovery authority, or credential store.

### Canonical authority boundary

420Mail delegates every security-sensitive read or mutation to an injected Wallet/420Identity `SecurityAuthority`.

Mail does not:

- mint or hold passkey private material;
- store wallet private keys, seed phrases, recovery secrets, or session signing secrets;
- create a parallel device/session registry;
- override SmartAccount420 authorization epochs;
- shorten, bypass, or locally finalize canonical recovery timelocks;
- manufacture account/session authority when Wallet/Identity is unavailable.

The returned security state is accepted only when it belongs to the authenticated Mail identity and satisfies canonical shape and epoch invariants.

### Passkeys and authorization epochs

Mail exposes passkey enrollment and revocation handoffs.

Enrollment accepts only a bounded **public attestation/assertion envelope** plus non-secret device metadata. Private passkey material must remain inside the platform authenticator/qualified Wallet flow.

Each passkey summary carries the Wallet authorization epoch used for the binding. A passkey from a future epoch is invalid. A passkey from an older epoch may be shown only as **inactive** review/history state; stale-epoch passkeys marked active are rejected by Mail rather than silently trusted.

### Device enrollment and lost-device response

Mail exposes device enrollment and device revocation through the canonical security authority.

The device proof is opaque to Mail. The Wallet/Identity authority remains responsible for proving possession, binding the device, deciding whether additional authorization is required, and invalidating dependent authority when a device is lost or revoked.

Mail does not persist its own device registry.

### Recovery

The security surface supports the canonical SmartAccount420 recovery action classes:

- `SET_AUTHORITY`
- `PROPOSE`
- `CANCEL`
- `FINALIZE`

Recovery requests are validated for account/address shape before delegation, but Mail never signs or authorizes the underlying recovery transition.

The Wallet authority must preserve canonical recovery rules, including the SmartAccount timelock, owner cancellation window, current/pending authority state, simulation/approval policy, and post-confirmation canonical-state re-read. Mail has no local recovery timer and cannot claim that recovery is executable or final before canonical Wallet/SmartAccount state says so.

### Sessions

Mail exposes canonical session listings through the security snapshot and provides session revocation.

Session summaries are authorization-epoch bound. A future-epoch session is invalid. An older-epoch session may be shown only when inactive; a stale session marked active is rejected.

Disconnecting the Mail UI is not treated as canonical session revocation. Revocation must pass through Wallet/Identity authority.

### Security alerts

Mail exposes owner-scoped Wallet/Identity security alerts and acknowledgement.

Alerts are treated as security-authority projections. Mail does not create a second canonical incident ledger and does not publish alerts to public 420Search, Explorer, analytics, or on-chain state.

### Authenticated API

- `GET /v1/security` — current canonical security projection;
- `POST /v1/security/passkeys` — enroll a passkey through Wallet/Identity authority;
- `DELETE /v1/security/passkeys/{id}` — revoke a passkey;
- `POST /v1/security/devices` — enroll a device;
- `DELETE /v1/security/devices/{id}` — revoke a device;
- `POST /v1/security/recovery` — request one canonical recovery action;
- `POST /v1/security/sessions/{id}/revoke` — revoke a canonical session;
- `POST /v1/security/alerts/{id}/ack` — acknowledge a security alert.

Typed Go client methods mirror all of these operations.

### MAIL-2.13 Wallet Functions Inside Mail

MAIL-2.13 adds non-custodial wallet-aware actions and verification handoffs while preserving 420 Wallet / SmartAccount420 as the only authorization, signing, simulation, and submission boundary.

420Mail may prepare a bounded intent, show the resulting Wallet handoff, and later ask canonical Wallet/RPC/Identity verification authority to confirm evidence. It does **not** sign, submit, hold signing secrets, create reusable wallet authority, or promote a Wallet submission acknowledgement into proof of canonical execution.

### Supported wallet-aware intent classes

The repository surface supports two generic intent classes:

- `TRANSACTION` — a bounded chain/account/target/value/calldata intent for qualified Wallet simulation, review, authorization, signing and submission.
- `MESSAGE_SIGNATURE` — a bounded chain/account/payload-digest intent for Wallet-reviewed message-signature authorization or account-control verification.

Mail deliberately does not invent protocol-specific contract semantics in this step. Higher-level applications may supply already-resolved canonical targets/calldata through their owning protocol integration, but Mail itself is not a contract-address authority.

### Transaction handoff rules

A transaction intent must bind:

- chain ID;
- wallet/Smart Account address;
- exact target address;
- unsigned decimal native value;
- exact calldata;
- human-readable explanation;
- explicit expiry.

The injected canonical wallet adapter must return the same bound fields, an authorization epoch, a handoff ID, `non_custodial=true`, and `requires_wallet_approval=true`.

Mail rejects a handoff if the authority mutates chain, account, target, value, calldata, explanation, or expiry; omits explicit Wallet approval; or returns a custodial result.

Wallet remains responsible for:

- network verification;
- canonical account discovery;
- live owner/EntryPoint/capability/session/authorization-epoch checks;
- simulation;
- user review;
- signing method;
- nonce/UserOperation construction;
- submission;
- retry policy.

### Message-signature handoff rules

A message-signature intent binds chain ID, account, a fixed 32-byte digest, explanation, and expiry.

Raw private keys, seed phrases, passkey private material, or signing secrets are never accepted.

The Mail service does not claim that every message signature proves ownership for every protocol. Verification semantics remain owned by the injected canonical Wallet/Identity verification adapter.

### Verification handoffs

`POST /v1/wallet/verifications` accepts bounded evidence for either:

- `TRANSACTION`
- `SIGNATURE`

The evidence payload is opaque to Mail and is interpreted by the canonical verification adapter.

A result is accepted only when it:

- belongs to the authenticated Mail identity;
- matches the requested handoff ID and verification kind;
- identifies a valid wallet account;
- is explicitly `verified=true`;
- is explicitly `canonical=true`;
- is explicitly non-custodial;
- contains a verification timestamp.

Transaction verification additionally requires a chain ID and canonical transaction hash. `finalized` remains a separate result bit; canonical verification and finality are not collapsed.

A Wallet/provider submission acknowledgement alone is not canonical completion and is rejected when the verification authority does not confirm canonical evidence.

### API

Authenticated routes:

- `POST /v1/wallet/actions` — prepare a bounded Wallet action handoff;
- `POST /v1/wallet/verifications` — verify canonical transaction/signature evidence.

Typed Go client methods mirror both routes.

### MAIL-2.14 External Integrations Framework

MAIL-2.14 adds a provider-neutral connector architecture that later Discord, Signal, Telegram, and other integration steps can use without placing provider-specific behavior inside the 420Mail core.

### Provider registry and capability model

Connectors register a normalized provider identifier, display name, and explicit capability set. Core recognizes only generic capability classes:

- `LINK`
- `PULL`
- `PUSH`
- `WEBHOOK`
- `WALLET_VERIFY`

A provider may expose only the capabilities it actually implements. Unsupported operations fail before an adapter is invoked. Duplicate providers, malformed identifiers, and duplicate/unknown capabilities are rejected.

The registry is deterministic and provider-neutral; it does not hard-code Discord, Signal, Telegram, OAuth vendors, webhook signatures, message schemas, or provider URLs.

### Account linking boundary

User-driven connector operations remain authenticated to the current Mail identity.

Linking receives:

- provider identifier;
- an opaque secure-broker authorization reference;
- optional non-secret account hint.

The Mail API does **not** accept raw access tokens, refresh tokens, client secrets, wallet private keys, or provider passwords as supported link fields. Provider credentials and refresh behavior belong to the adapter or qualified secure credential broker.

A successful connector link is accepted only when it:

- belongs to the authenticated Mail identity;
- belongs to the requested provider;
- has a connection ID and external account ID;
- is active;
- is explicitly non-custodial;
- has canonical link/update timestamps.

Mail core does not persist provider credentials.

### Pull and push handoffs

`PULL` adapters receive provider, connection ID, and an opaque cursor. Returned provider/connection identity must match the request and every returned item must have an external ID, kind, timestamp, and bounded payload.

`PUSH` adapters receive provider, connection ID, kind, bounded payload, and an explicit idempotency key. Push success must return the same provider/connection, an external ID, acceptance timestamp, and `accepted=true`.

The framework does not define Discord/Signal/Telegram message semantics. Those are introduced only by their later roadmap steps.

### Webhook boundary

External provider webhooks use a public pre-session transport route because provider servers do not possess a Mail user session.

Webhook authentication is still mandatory, but it belongs to the connector adapter. Mail supplies:

- the provider selected from the URL path;
- the raw bounded payload;
- the **actual HTTP transport headers** observed by the Mail service.

Webhook verification headers cannot be supplied through the JSON model because the framework does not deserialize provider webhook payloads into a Mail-owned authentication structure. The adapter must verify provider-specific signature/timestamp/replay rules before returning `verified=true`, owner identity, connection ID, and normalized connector items.

Mail rejects unverified, provider-mismatched, unbound, malformed, or oversized webhook results.

### Provider isolation

Connector results are validated against the provider and authenticated identity that initiated the operation.

A connector cannot:

- return a different provider and have Mail accept it;
- link a connection to a different Mail identity;
- bypass its declared capability set;
- cause Mail core to treat provider credentials as mailbox metadata;
- widen Mail authority into provider credential custody;
- publish private integration payloads to public 420Search or on-chain state.

Adapter dependency failures fail closed. There is no generic fallback that impersonates a provider or silently switches connectors.

### API

Authenticated owner routes:

- `GET /v1/connectors/providers`
- `POST /v1/connectors/link`
- `POST /v1/connectors/unlink`
- `POST /v1/connectors/pull`
- `POST /v1/connectors/push`

Public provider transport route:

- `POST /v1/connectors/webhooks/{provider}`

The public webhook route is not an authorization bypass: the provider adapter must authenticate the transport evidence and bind the result to a specific Mail identity/connection before the result is accepted.

Typed Go client methods cover provider discovery and authenticated link/unlink/pull/push operations. Provider webhook transport is intentionally not presented as an authenticated user client operation.

### Scope boundary

MAIL-2.14 provides architecture only. It intentionally does **not** claim:

- Discord OAuth/account linking;
- Discord message ingestion or delivery;
- Discord wallet verification;
- Signal integration;
- Telegram integration;
- unified cross-provider inbox behavior;
- cross-platform identity;
- production provider credentials;
- live webhook signatures/replay behavior;
- provider rate-limit/retry production evidence.

Those belong to MAIL-2.15 and later steps and production-equivalent testnet/security qualification.

## MAIL-2.15 Discord Account Linking

MAIL-2.15 introduces the first concrete provider adapter on top of the provider-neutral MAIL-2.14 connector framework.

The scope is intentionally limited to **Discord account linking and unlinking**. Discord message sync, Discord delivery, Discord wallet verification, and Discord webhook ingestion remain owned by MAIL-2.16 through MAIL-2.18.

### Authority boundary

420Mail does not exchange Discord OAuth codes directly and does not accept raw Discord access tokens, refresh tokens, client secrets, or provider passwords.

The Discord connector receives only an opaque secure-broker authorization reference from the generic connector link request. A deployment-provided `DiscordLinkAuthority` is responsible for the actual Discord OAuth/broker exchange, replay protection, provider token lifecycle, and authoritative Discord identity lookup.

### Accepted Discord account result

The authority result is accepted only when:

- the Discord user ID is a valid numeric snowflake;
- a username is present;
- the granted scopes include `identify`;
- scopes are normalized and non-duplicated;
- the provider identity has been verified;
- the result is explicitly non-custodial;
- a link timestamp is present.

The resulting Mail connector connection is owner-bound to the authenticated 420Mail identity and uses:

- provider: `discord`;
- connection ID: `discord:{snowflake}`;
- external ID: the Discord snowflake;
- display name: Discord global display name when present, otherwise username.

### Unlinking

Unlinking requires the authenticated Mail identity and a valid Discord connection ID. The provider-specific authority performs the actual credential/account unlink operation.

Mail core does not locally retain Discord OAuth credentials.

### Capability boundary

The MAIL-2.15 Discord adapter declares only:

- `LINK`

It explicitly returns unsupported for:

- pull/sync;
- push/delivery;
- webhook ingestion;
- wallet verification.

This prevents later Discord roadmap functionality from being silently implemented or claimed during account-linking qualification.

### Construction

`NewDiscordConnectorService(authority)` creates a connector service with the Discord link-only adapter registered through the same provider-neutral registry used by MAIL-2.14.

The existing generic connector API and UI are reused:

- `GET /v1/connectors/providers`
- `POST /v1/connectors/link`
- `POST /v1/connectors/unlink`

No Discord-specific HTTP route is required because the provider-neutral framework already carries the provider selector and opaque authorization reference.

MAIL-2.15 repository completion does not claim live Discord OAuth credentials, redirect URI configuration, production token rotation/revocation, public-testnet account linking, or provider availability. Those remain deployment/testnet/security qualification gates.

## MAIL-2.16 Discord → 420Mail Sync

MAIL-2.16 extends the linked Discord connector with inbound `PULL` capability and materializes verified Discord messages into the authenticated owner's private 420Mail mailbox.

### Sync authority and connection binding

Discord sync requires an existing Discord connection ID in the canonical `discord:{snowflake}` form and the authenticated 420Mail identity.

The Discord adapter delegates provider access to `DiscordSyncAuthority`, which receives:

- the authenticated 420Mail identity;
- the linked Discord user snowflake;
- the last durable opaque cursor.

The authority returns a page of normalized Discord messages plus the next opaque cursor.

### Message validation and materialization

Each inbound Discord message must provide:

- Discord message snowflake;
- Discord author snowflake;
- author username;
- Discord channel snowflake;
- optional channel display name;
- bounded message content;
- source creation timestamp.

Messages are imported in deterministic `created_at ASC, message_id ASC` order.

Each newly imported item becomes a private 420Mail recipient copy with:

- sender `discord:{author-snowflake}`;
- recipient = authenticated 420Mail identity;
- source = `discord`;
- folder initially `INBOX`;
- private off-chain body reference/digest;
- deterministic Discord-channel conversation ID;
- external-message idempotency bound to owner + connection + Discord message ID.

Existing trust controls, spam/phishing protection, incoming rules, conversation archive/mute state, quarantine behavior, and notification suppression are applied during materialization.

### Idempotency and cursor durability

Discord message IDs are treated as immutable external event identifiers. Replaying an identical external message is a no-op. Reusing the same Discord message ID with different content/author/channel/timestamp fails closed as a sync conflict instead of silently mutating already imported private mail.

Per-owner/per-connection sync cursor state is persisted in Mail durable metadata schema v9. The cursor advances only after the pulled page has been validated and all new items have been materialized successfully. On restart, the next pull resumes from the persisted cursor.

### API

Authenticated endpoint:

- `POST /v1/connectors/discord/sync`
  - input: `connection_id`
  - output: newly imported mailbox items, next cursor, sync timestamp.

Typed Go client method: `SyncDiscord`.

### Scope boundary

MAIL-2.16 adds only inbound Discord → 420Mail synchronization.

It does **not** add:
- 420Mail → Discord delivery;
- Discord webhook ingestion as a required sync path;
- Discord wallet verification;
- Discord outbound message composition;
- public indexing of Discord content;
- on-chain Discord message bodies.

Those remain later roadmap steps.

## MAIL-2.17 420Mail → Discord Delivery

MAIL-2.17 adds authenticated outbound delivery from 420Mail into Discord through the provider-neutral connector `PUSH` capability.

### Authority and connection boundary

Outbound delivery requires:
- the authenticated 420Mail identity;
- an existing linked Discord connection ID in canonical `discord:{snowflake}` form;
- a Discord connector authority implementing `DiscordDeliveryAuthority`.

The Discord adapter advertises `PUSH` only when that authority is present. A link-only or sync-only Discord adapter continues to fail push requests as unsupported.

Mail never accepts or persists raw Discord access tokens, refresh tokens, client secrets, bot tokens, or provider signing material. Credential use remains inside the Discord delivery authority / secure broker boundary.

### Delivery request

The dedicated Mail API accepts:
- linked `connection_id`;
- destination Discord `channel_id` snowflake;
- message `content` up to 2000 bytes;
- optional `reply_to_message_id` Discord snowflake;
- required caller idempotency key.

The request is normalized and validated before provider authority execution.

### Provider handoff and result validation

Mail delegates the normalized request to `DiscordDeliveryAuthority.DeliverDiscord` with:
- authenticated Mail actor;
- linked Discord user snowflake derived from the connection ID;
- idempotency key;
- normalized delivery message.

The provider result must contain:
- valid Discord message snowflake;
- the exact requested Discord channel ID;
- non-zero accepted timestamp.

The generic connector service then independently verifies provider/connection/external-ID/accepted-state invariants.

### Idempotency

MAIL-2.17 uses the connector framework's required push idempotency key and passes the exact key through to the Discord delivery authority. Provider retries must therefore use the same key rather than generate a second external message.

No second Mail-side outbound queue is introduced in this step; MAIL-2.10 remains the canonical internal Mail delivery queue, while Discord provider retry/idempotency is owned by the external connector authority.

### API and client

Authenticated endpoint:
- `POST /v1/connectors/discord/deliver`

Typed Go client:
- `DeliverDiscord`

The thin UI surfaces **Send to Discord** only when the configured Discord connector declares `PUSH`. The deployment shell supplies a normalized linked connection/destination/content request, while Mail generates the per-action idempotency key.

### Scope boundary

MAIL-2.17 does **not** add:
- Discord wallet verification;
- Discord webhook ingestion;
- raw Discord credential handling;
- public indexing of outbound message content;
- on-chain Discord message bodies;
- a second provider-specific persistence/queue system.

Discord wallet verification remains MAIL-2.18.

## MAIL-2.18 Discord Wallet Verification

MAIL-2.18 binds a linked Discord identity to a canonically verified wallet account without granting Discord or 420Mail signing authority.

### Authority boundary

Discord wallet verification reuses the already-qualified MAIL-2.13 Wallet verification boundary.

- Discord supplies only the linked external identity.
- 420Mail constructs and persists a bounded verification challenge.
- 420 Wallet/Identity remains the sole message-signature preparation and canonical verification authority.
- Discord never becomes a wallet verifier.
- 420Mail never receives a private key, seed phrase, passkey private material, or provider credential.

### Challenge binding

An authenticated user requests a challenge with:

- linked Discord connection ID;
- chain ID;
- wallet account;
- expiry.

The challenge digest is domain-separated with:

`420/MAIL/DISCORD/WALLET-VERIFY/V1`

and binds:

- authenticated 420Mail identity;
- Discord connection ID;
- Discord user snowflake;
- chain ID;
- wallet account;
- expiry.

The digest is passed to the canonical Wallet action service as a `MESSAGE_SIGNATURE` handoff. The wallet handoff must remain non-custodial and require explicit Wallet approval.

Challenge lifetime is bounded to at most ten minutes.

### Durable verification state

Non-secret challenge metadata is persisted in Mail durable storage schema v10:

- wallet handoff ID;
- Mail owner;
- Discord connection/user;
- chain;
- wallet account;
- challenge digest;
- expiry;
- verified state/timestamp;
- version.

Raw signature evidence is **not** persisted.

Durable challenge state prevents restart from detaching a Wallet proof from the Discord identity it was issued for.

### Canonical verification

Verification requires:

- the same authenticated Mail identity;
- the same Discord connection ID;
- the original wallet handoff ID;
- opaque evidence for canonical Wallet verification.

The existing Wallet verification service must return a canonical, verified, non-custodial `SIGNATURE` result for the same handoff and wallet account.

Cross-user, cross-Discord-connection, account-substitution, expired-challenge, non-canonical, or malformed results fail closed.

Once successfully verified, later identical verification requests return the durable verified binding without asking the Wallet authority to verify the same proof again.

### API and client

Authenticated endpoints:

- `POST /v1/connectors/discord/wallet/challenge`
- `POST /v1/connectors/discord/wallet/verify`

Typed client methods:

- `PrepareDiscordWalletVerification`
- `VerifyDiscordWallet`

The Discord connector now advertises `WALLET_VERIFY`. The thin UI shows **Verify Discord wallet** only when that capability is present. The deployment shell provides the linked connection/chain/account selection and invokes the qualified Wallet UX to obtain canonical signature evidence.

### Scope boundary

MAIL-2.18 does not:

- grant Discord transaction/signing authority;
- make Discord evidence canonical by itself;
- persist raw wallet verification evidence;
- expose verification bindings to public 420Search;
- place Discord or wallet proof material on-chain;
- implement Signal or Telegram integrations.

Those remain outside this roadmap step.

## MAIL-2.19 Signal Integration Boundary

MAIL-2.19 establishes the architectural and security boundary for later Signal-related roadmap steps. It does **not** claim a supported Signal messaging transport.

### Boundary status

The canonical boundary reports:

- provider: `signal`
- status: `BOUNDARY_ONLY`
- architecture: `EXTERNAL_SIGNAL_TRANSPORT_ADAPTER`
- transport authority: `SIGNAL_CLIENT_OR_SECURE_BROKER_ONLY`

Signal is intentionally **not** registered as an operational connector during MAIL-2.19 because no stable Signal capability is introduced by this step.

### Credential and identity boundary

420Mail does not:

- own or create the user's Signal identity;
- persist Signal provider credentials;
- accept raw access tokens, refresh tokens, client secrets, Signal registration credentials, phone-number credentials, or verification codes;
- impersonate a Signal client;
- silently bootstrap an unofficial Signal transport.

Any later Signal capability must execute through an external Signal transport adapter, supported client surface, or secure broker boundary and must be qualified in its own roadmap step.

### Capabilities intentionally disabled at this boundary

MAIL-2.19 keeps all operational Signal features disabled:

- account linking;
- outbound notifications;
- share/forward;
- inbound synchronization;
- webhook ingestion;
- deep sync;
- provider registration inside the connector registry.

This prevents the boundary step from silently implementing MAIL-2.20, MAIL-2.21, or MAIL-2.22.

### Deep-sync condition

Signal deep sync remains explicitly conditional on:

`STABLE_SUPPORTED_INTEGRATION_SURFACE_REQUIRED`

MAIL-2.22 may only enable deep synchronization if repository/live integration evidence establishes a stable supported surface. The existence of a third-party or unofficial transport alone is not promoted into canonical support by MAIL-2.19.

### Privacy boundary

Signal boundary metadata is non-secret and contains no message content.

- Signal message bodies are not placed on-chain.
- Signal data is not exposed to public 420Search.
- No Signal inbox state is materialized by this step.

### API and client

Authenticated read-only boundary endpoint:

- `GET /v1/connectors/signal/boundary`

Typed Go client:

- `SignalIntegrationBoundary`

The endpoint is informational and read-only. It does not authorize Signal transport operations.

### Next-step containment

MAIL-2.20 may add **420Mail → Signal Notifications** only after satisfying this boundary. MAIL-2.21 may separately add **Signal Share & Forward**. MAIL-2.22 remains conditional on the stable-surface gate above.

## MAIL-2.20 420Mail → Signal Notifications

MAIL-2.20 adds privacy-minimized outbound Signal notification delivery on top of the MAIL-2.19 boundary.

Signal remains an external notification transport only. It is still not registered as a generic operational connector, does not own Mail identity, and does not gain share/forward or synchronization behavior.

### Notification path

420Mail already emits a non-authoritative `Notification` after successful recipient mailbox materialization when the recipient copy is not muted/quarantined.

MAIL-2.20 adds `SignalNotificationSink`, which can wrap the existing 420Notifications sink and fan the same eligible new-mail event to an external Signal notification authority.

The existing 420Notifications sink is preserved and remains independent. Signal delivery is supplementary and non-authoritative.

### Privacy-minimized payload

The Signal authority receives only:

- deterministic event ID derived from the Mail message ID;
- recipient 420Mail identity;
- notification kind `NEW_MAIL`;
- fixed title `New 420Mail message`;
- deterministic idempotency key bound to recipient + message ID.

The Signal notification request intentionally does **not** contain:

- Mail body;
- subject;
- sender identity;
- source application;
- wallet data;
- Signal credentials.

Recipient-to-Signal destination resolution, Signal consent/opt-in evaluation, and all provider credentials remain inside the external Signal notification authority / secure broker boundary.

### Consent suppression

The Signal authority may return a valid suppressed result when the recipient has not opted in or is otherwise ineligible for Signal notifications.

A suppressed result carries no delivery ID or delivery timestamp.

### Delivery receipt

An accepted result must contain:

- non-empty external delivery ID;
- non-zero accepted timestamp;
- `accepted=true`;
- `suppressed=false`.

Malformed or contradictory provider results fail closed.

### Idempotency

Signal notification idempotency uses the domain:

`420/MAIL/SIGNAL/NOTIFICATION/V1`

and deterministically binds the Mail recipient identity and Mail message ID.

Mail's existing send idempotency means an identical replay of the same successfully-created Mail message does not emit a second notification event.

### Failure semantics

Signal notification delivery is best-effort relative to canonical Mail delivery.

A Signal transport outage does not roll back or invalidate an already-successful Mail send. The existing 420Notifications path remains available independently.

### Boundary advancement

The canonical Signal boundary now reports:

- status: `NOTIFICATIONS_ONLY`;
- `outbound_notifications=true`.

The following remain disabled:

- Signal account linking;
- share/forward;
- inbound sync;
- webhook ingestion;
- deep sync;
- provider registration inside the generic connector registry.

Deep sync remains gated by `STABLE_SUPPORTED_INTEGRATION_SURFACE_REQUIRED`.

### Scope boundary

MAIL-2.20 does **not** implement:

- MAIL-2.21 Signal Share & Forward;
- MAIL-2.22 Signal Deep Sync;
- Signal inbox materialization;
- raw Signal credential handling;
- public indexing of Signal notification data;
- on-chain Signal message content.

## MAIL-2.21 Signal Share & Forward

MAIL-2.21 adds explicit user-initiated sharing and forwarding of an existing 420Mail message to Signal while preserving the external Signal transport boundary.

### Authorization boundary

Signal export requires:

- an authenticated 420Mail actor;
- a live mailbox copy owned by that actor;
- the source Mail message ID;
- an opaque Signal destination reference supplied by the deployment Signal adapter;
- explicit mode `SHARE` or `FORWARD`;
- a caller idempotency key.

The implementation reuses the canonical `ReadBody` authorization path. A foreign, permanently deleted, or otherwise unavailable mailbox copy cannot be exported and never reaches the Signal authority.

### Share vs forward semantics

`SHARE` sends:

- the Mail body;
- optional user note;
- no Mail subject.

`FORWARD` sends:

- the Mail body;
- Mail subject;
- optional user note.

Neither mode automatically adds the original sender identity or source application metadata.

The source message ID is retained as provider-facing provenance/idempotency context but does not become a public index entry.

### Signal authority boundary

420Mail passes the authorized content to `SignalShareAuthority`.

The external Signal authority / secure broker remains responsible for:

- resolving the opaque destination reference;
- Signal recipient/contact selection;
- Signal transport credentials;
- provider retry/delivery behavior;
- provider-side idempotency semantics.

420Mail does not accept:

- Signal phone-number credentials;
- Signal registration/verification codes;
- access or refresh tokens;
- client secrets;
- device/provider signing material.

### Result validation

A successful share/forward requires:

- `accepted=true`;
- non-empty external delivery ID;
- non-zero accepted timestamp.

Incomplete or rejected provider responses fail closed.

### API and client

Authenticated endpoint:

- `POST /v1/connectors/signal/share`

Typed client:

- `ShareToSignal`

The thin UI exposes **Share to Signal** and **Forward to Signal** only as explicit actions on a message the user has opened. The deployment shell supplies only the opaque destination reference and optional note.

### Boundary advancement

The canonical Signal boundary now reports:

- status: `SHARE_FORWARD_ENABLED`;
- `outbound_notifications=true`;
- `share_and_forward=true`.

Still disabled:

- Signal account linking;
- provider registration as a generic connector;
- inbound sync;
- webhook ingestion;
- deep sync.

Deep sync remains gated by `STABLE_SUPPORTED_INTEGRATION_SURFACE_REQUIRED`.

### Scope boundary

MAIL-2.21 does **not** implement:

- automatic Signal forwarding;
- Signal inbox materialization;
- Signal webhook ingestion;
- MAIL-2.22 Signal Deep Sync;
- public indexing of shared Mail content;
- on-chain Signal message bodies.

## MAIL-2.22 Signal Deep Sync

MAIL-2.22 is explicitly conditional on a stable supported Signal integration surface.

Repository inspection found **no qualifying stable supported surface**. The repository contains no supported Signal API/client contract, no stable inbound-sync transport, no account/device binding authority for Signal sync, no committed replay/cursor contract, and no provider lifecycle/rate-limit contract suitable for canonical deep synchronization.

Therefore MAIL-2.22 completes as a **qualified conditional gate outcome**, not as an enabled deep-sync implementation.

### Canonical gate result

- status: `CONDITION_UNSATISFIED`
- enabled: `false`
- condition: `STABLE_SUPPORTED_INTEGRATION_SURFACE_REQUIRED`
- supported surface found: `false`
- inbound sync: `false`
- webhook ingestion: `false`
- operational Signal provider registration: `false`

Missing evidence inventory:

- supported Signal API or client contract;
- stable inbound-sync transport;
- account/device binding authority;
- replay and cursor semantics;
- provider lifecycle and rate-limit contract.

### Safety boundary

MAIL-2.22 does not invent or silently promote an unofficial Signal transport.

It preserves the qualified MAIL-2.19 through MAIL-2.21 capabilities:

- Signal notifications;
- explicit share/forward;
- external Signal transport authority;
- no Mail-owned Signal identity or credentials.

It does **not** add:

- Signal inbox materialization;
- Signal polling;
- Signal webhook ingestion;
- Signal cursor persistence;
- background Signal account/device ownership;
- provider credential persistence;
- deep sync.

### API and client

Authenticated read-only status endpoint:

- `GET /v1/connectors/signal/deep-sync/status`

Typed client:

- `SignalDeepSyncStatus`

The status endpoint exists so operators/UI can distinguish “not implemented because condition is unsatisfied” from an accidental missing route or disabled deployment.

### Future re-entry condition

A future implementation may only enable Signal deep sync after repository evidence establishes the required stable supported surface. That would be a new substantive implementation SHA and must be qualified under the applicable roadmap/audit phase before the gate may be changed.

## MAIL-2.23 Telegram Account Linking

MAIL-2.23 adds Telegram account linking through the provider-neutral connector framework established by MAIL-2.14.

### Authority boundary

420Mail does not verify Telegram credentials itself.

A deployment-provided `TelegramLinkAuthority` receives an opaque authorization reference and is responsible for validating the external Telegram authorization flow and returning a normalized Telegram account.

The authority result must contain:

- a positive decimal Telegram user identifier;
- either a username or first name suitable for display;
- `verified=true`;
- `non_custodial=true`;
- a non-zero link timestamp.

420Mail never accepts or persists raw Telegram bot tokens, access tokens, refresh tokens, client secrets, phone-number credentials, verification codes, or device/provider signing material.

### Connection model

A successful link produces the canonical provider-neutral connection:

- provider: `telegram`;
- connection ID: `telegram:{user-id}`;
- external ID: Telegram user ID;
- identity: authenticated 420Mail actor;
- active: true;
- non-custodial: true.

Display name prefers Telegram first/last name, then falls back to `@username`.

The generic `account_hint` remains non-authoritative; the external Telegram authority result is canonical.

### Unlink

Unlinking requires:

- authenticated Mail actor;
- provider `telegram`;
- valid `telegram:{user-id}` connection ID.

The adapter extracts the Telegram user ID and delegates revocation/unlink cleanup to `TelegramLinkAuthority`.

### Capability containment

MAIL-2.23 advertises **only**:

- `LINK`

It deliberately does not enable:

- `PULL` / Telegram → 420Mail sync;
- `PUSH` / 420Mail → Telegram delivery;
- webhook ingestion;
- Telegram wallet verification.

Those remain MAIL-2.24 and MAIL-2.25 or later roadmap work.

### API, client, and UI

Telegram linking reuses the existing provider-neutral surfaces:

- `GET /v1/connectors/providers`;
- `POST /v1/connectors/link`;
- `POST /v1/connectors/unlink`;
- typed `LinkConnector` / `UnlinkConnector` client methods.

The thin UI already renders any provider advertising `LINK`. A deployment shell may provide `window.__420_CONNECTORS__.telegram.authorize()` returning only an opaque authorization reference and optional non-authoritative account hint.

No Telegram-specific route or raw credential form is introduced.

## MAIL-2.24 Telegram → 420Mail Sync

MAIL-2.24 adds authenticated inbound Telegram synchronization through the provider-neutral `PULL` connector capability introduced by MAIL-2.14 and the Telegram account binding from MAIL-2.23.

### Authority and capability boundary

`TelegramConnectorAdapter` advertises `PULL` only when its configured authority implements `TelegramSyncAuthority`.

The sync authority receives:
- authenticated 420Mail actor;
- Telegram user ID derived from the canonical `telegram:{user-id}` connection;
- durable opaque cursor.

The authority returns a bounded `TelegramSyncPage` containing normalized Telegram messages and the next opaque cursor.

MAIL-2.24 does not enable Telegram `PUSH`, webhook ingestion, or wallet verification. Those remain later roadmap work.

### Telegram message model

Each inbound item binds:
- positive decimal Telegram message ID;
- positive decimal Telegram author user ID;
- signed decimal chat ID (allowing Telegram group/supergroup identifiers);
- optional bounded author username;
- optional bounded chat title;
- private message content;
- non-zero provider timestamp.

The connector item external ID and timestamp must exactly match the decoded Telegram message.

### Private mailbox materialization

New Telegram messages materialize as private recipient Inbox entries:
- sender: `telegram:{author-id}`;
- recipient: authenticated 420Mail identity;
- source: `telegram`;
- visibility: `PRIVATE`;
- private body stored only through the Mail private blob store;
- deterministic message ID;
- deterministic conversation ID bound to Mail owner + Telegram connection + chat ID.

Subject prefers `Telegram · {chat title}`, then `Telegram · @{author username}`, otherwise `Telegram`.

Existing trust controls, filters/rules, spam/phishing protection, thread archive/mute state, and Mail notification behavior are applied before/after materialization exactly as for other inbound Mail sources.

### Durable cursor and replay behavior

Durable Mail store schema advances to **v11** and persists Telegram cursor state keyed by:
- Mail owner;
- Telegram connection ID.

Cursor state survives restart and records last sync time/version.

Replay of an identical Telegram item is idempotent. A reused external identity with mutated content or metadata fails closed with `ErrTelegramSyncConflict`.

A permanently deleted imported message is not resurrected by provider replay.

Provider/dependency failures do not advance the durable cursor.

### API, client, and UI

Authenticated sync endpoint:
- `POST /v1/connectors/telegram/sync`

Typed client:
- `SyncTelegram`

The thin UI shows **Sync Telegram** only when the provider descriptor advertises `PULL`. The deployment shell supplies the canonical linked Telegram connection ID; it does not supply raw provider credentials.

### Credential/privacy boundary

420Mail does not accept or persist Telegram bot tokens, access/refresh tokens, client secrets, phone-number credentials, verification codes, or provider signing/device material.

Telegram message bodies remain private/off-chain and are not exposed to public 420Search.

## MAIL-2.25 420Mail → Telegram Delivery

MAIL-2.25 adds authenticated outbound Telegram delivery through the provider-neutral `PUSH` connector capability.

### Authority boundary

`TelegramConnectorAdapter` advertises `PUSH` only when its configured authority implements `TelegramDeliveryAuthority`.

The delivery authority receives:
- authenticated 420Mail actor;
- Telegram user ID derived from the canonical `telegram:{user-id}` connection;
- caller idempotency key;
- validated Telegram delivery message.

420Mail does not accept or persist Telegram provider credentials.

### Delivery model

A delivery request contains:
- canonical Telegram connection ID;
- signed-decimal Telegram chat ID;
- non-empty content bounded to 4096 bytes;
- optional positive-decimal reply-to message ID;
- required idempotency key.

The provider receipt must contain:
- positive-decimal Telegram message ID;
- the exact requested chat ID;
- non-zero accepted timestamp.

Malformed or contradictory receipts fail closed.

### API, client, and UI

Authenticated endpoint:
- `POST /v1/connectors/telegram/deliver`

Typed client:
- `DeliverTelegram`

The thin UI exposes **Send to Telegram** only when the Telegram descriptor advertises `PUSH`. A deployment connector adapter provides the linked connection ID, destination chat, message content, and optional reply target; raw Telegram credentials never enter Mail.

### Capability containment

MAIL-2.25 preserves qualified Telegram `LINK` and `PULL` behavior while adding `PUSH`.

Still disabled:
- Telegram webhook ingestion;
- Telegram wallet verification.

### Failure and replay boundary

Idempotency is mandatory and is passed through to the external Telegram authority. Provider failure is returned to the caller without fabricating success or altering canonical Mail state.

## MAIL-2.26 Unified Integrations Inbox

MAIL-2.26 adds a single authenticated Inbox view for messages imported from supported external integrations.

### Canonical view model

The unified integrations inbox is a **derived view over canonical Mail mailbox state**. It does not create a second message store, duplicate message bodies, or maintain a parallel read/archive/delete lifecycle.

Current supported inbound integration sources are:

- `discord`;
- `telegram`.

A message appears only when its canonical mailbox state for the authenticated owner is:

- folder `INBOX`;
- not permanently deleted.

Native 420Mail messages, archived messages, junk, trash, deleted records, and another user's mailbox records are not included.

The returned item preserves the full canonical `Message` plus `MailboxState`, so existing read/star/pin/mute/version state remains authoritative.

### Ordering and pagination

Items are ordered deterministically by:

1. message `created_at` descending;
2. message ID ascending as the tie-breaker.

Pagination uses the existing opaque Mail cursor format and occurs **after** the integrations-only filter is applied.

### API and client

Authenticated endpoint:

- `GET /v1/integrations/inbox?cursor=...&limit=...`

Typed client:

- `IntegrationsInbox`

### Scope containment

MAIL-2.26 deliberately does not add provider-specific query filters. Integration-specific filtering remains MAIL-2.28.

The unified view does not expose private message bodies inline. Existing authenticated message-read APIs remain responsible for body access.

## Thin UI

The web UI delegates transaction/signature intent construction and verification-evidence acquisition to a deployment-provided `window.__420_WALLET_ACTIONS__` adapter. It displays the returned handoff for review but performs no local signing or submission.

MAIL-2.13 repository completion does not claim live SmartAccount execution, production Wallet simulation, live transaction submission, live RPC receipt/finality verification, deployed protocol target discovery, or public-testnet wallet action evidence. Those remain live/testnet qualification gates.

## Thin UI handoff

The Mail UI can render passkeys, devices, sessions, recovery state, and alerts returned by `GET /v1/security`. It exposes direct revoke/acknowledge actions and delegates passkey/device/recovery ceremonies to a deployment-provided `window.__420_SECURITY__` adapter.

That browser adapter is responsible for invoking the qualified Wallet/WebAuthn/device/recovery ceremony. Mail receives only the bounded public proof/request material required by the backend authority adapter.

MAIL-2.12 repository completion does not claim live WebAuthn RP configuration, real hardware-authenticator behavior, deployed Wallet session/recovery authority, live notification delivery, or public-testnet security operations. Those remain live deployment/testnet qualification gates.

## Thin UI

`mail/web/index.html` provides onboarding, security management, wallet-action handoffs, connector discovery/link handoffs, inbox, read, compose and draft surfaces. Connector UI is provider-neutral and delegates provider-specific authorization to deployment adapters; Mail never accepts raw provider secrets as normal UI fields. This is repository UI evidence, not live provider/deployment evidence.

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
