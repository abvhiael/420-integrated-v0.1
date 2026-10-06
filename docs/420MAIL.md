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

MAIL-2.1 intentionally keeps the existing in-memory repository store; durable transactional persistence, restart recovery, migrations, and multi-instance state are MAIL-2.2.

## Thin UI

`mail/web/index.html` provides inbox, read and compose surfaces. It assumes the deployment shell establishes the authenticated 420Identity. This is repository UI evidence, not deployment evidence.

## Security

Applicable shared threats include SPAM, SYBIL, MESSAGING_ABUSE, INDEX_POISONING and WEBHOOK_REPLAY where adapters use callbacks. Repository controls include actor/sender binding, canonical-source enforcement for the user send path, identity resolution, Messenger policy checks before persistence, private body references, input bounds, idempotency conflict detection, recipient-only read acknowledgement, no public list/search route, injected authentication and bounded pagination.

Deployment still requires rate limits, abuse/report operations, attachment policy/scanning if attachments are added, encrypted private storage, secret handling, observability, backup/recovery, retention policy, provider failure behavior and live privacy testing.

## Build and test

```bash
go test ./mail/...
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

The repository baseline does not prove deployed Identity, Messenger, Storage or Notifications integration; provider encryption/key custody; public-testnet operation; production observability; SMTP; attachments; spam operations; or disaster recovery. Those remain release gates.
