# 420Mail MAIL-2.24 Qualification

## Step

**MAIL-2.24 — Telegram → 420Mail Sync**

## Completion

- Status: **COMPLETE**
- Qualification level: **Level 1 — app-scoped step qualification**
- Qualified implementation SHA: `71afe4c049488113e1085a57f95de1f496b15897`
- Exact qualified PR merge-candidate SHA: `170a4a7ee65008587ce57fca40bdbab5beb4e21a`
- Current `main` / base SHA: `721a7f358e802bce91835851721eb93c4340f501`
- Audit branch: `mail-2-11-email-wallet-onboarding-20261006`
- PR: #537

## Canonical requirement satisfied

MAIL-2.24 adds authenticated **Telegram → 420Mail inbound synchronization** on top of the provider-neutral connector framework and the qualified Telegram account link from MAIL-2.23.

It does not implement MAIL-2.25 420Mail → Telegram Delivery.

## Implementation summary

Implemented/updated repository surfaces:

- `mail/telegram_sync.go`
  - `TelegramInboundMessage`
  - `TelegramSyncPage`
  - `TelegramSyncAuthority`
  - `TelegramSyncState`
  - `TelegramSyncResult`
  - `TelegramSyncService`
  - deterministic Telegram message fingerprinting
  - deterministic Telegram conversation IDs
  - private Inbox materialization
  - durable cursor state
  - replay/mutation protection
  - trust/rules/spam/thread/notification integration
- `mail/telegram_link.go`
  - conditionally advertises `PULL` only when authority implements `TelegramSyncAuthority`
  - provider-neutral Telegram pull adapter implementation
  - `PUSH` and webhook remain unsupported
- `mail/store.go`
  - durable store schema advanced from v10 to **v11**
  - `TelegramSync` persisted in load/write/init/normalize/clone/validation paths
- `mail/telegram_sync_test.go`
  - private materialization
  - idempotent replay
  - cursor advancement
  - permanent-delete non-resurrection
  - external-ID mutation conflict
  - malformed provider-message rejection
  - restart-safe durable cursor
  - v10→v11 migration/reopen qualification
  - dependency failure does not advance cursor
  - conditional PULL capability advertisement
- `mail/telegram_sync_http_test.go`
  - authenticated sync
  - unauthenticated rejection
  - strict unknown/secret field rejection
  - method rejection
  - conflict mapping
- `mail/http.go`
  - authenticated `POST /v1/connectors/telegram/sync`
  - `TelegramSyncService` handler dependency
- `mail/client/client.go`
  - typed `SyncTelegram`
- `mail/web/index.html`
  - capability-gated **Sync Telegram** action
  - deployment shell supplies only canonical linked connection ID
- `config/420mail-service-v1.json`
  - metadata store schema v11
  - explicit Telegram sync authority/cursor/privacy/replay policy
- `docs/420MAIL.md`
  - Telegram sync lifecycle, durability, privacy and capability boundaries
- `scripts/verify-420mail-audit.py`
  - retained schema-v11 and MAIL-2.24 config/source/API/client/UI assertions

## Exit criteria / invariants individually verified

### Linked Telegram identity boundary

Sync requires:
- authenticated 420Mail actor;
- canonical `telegram:{user-id}` connection ID.

The Telegram user ID is derived from that connection ID before the external sync authority is called.

### Conditional connector capability

Telegram advertises:
- `LINK`
- `PULL` only when configured authority implements `TelegramSyncAuthority`.

It still does **not** advertise:
- `PUSH`;
- webhook;
- wallet verification.

A link-only authority therefore remains link-only.

### Provider message validation

Each inbound Telegram message requires:
- positive decimal message ID;
- positive decimal author ID;
- valid signed-decimal chat ID;
- bounded optional username;
- bounded optional chat title;
- body within Mail body limit;
- non-zero provider timestamp.

Connector item external ID and timestamp must exactly match the decoded provider message.

Malformed provider data fails closed before mailbox materialization.

### Private mailbox materialization

A newly imported Telegram message creates a private recipient Inbox copy with:
- sender `telegram:{author-id}`;
- recipient = authenticated Mail actor;
- source `telegram`;
- visibility `PRIVATE`;
- body stored through private blob storage;
- deterministic message ID;
- deterministic conversation ID bound to owner + connection + Telegram chat.

Subject selection is bounded and deterministic:
- `Telegram · {chat title}` when present;
- otherwise `Telegram · @{username}`;
- otherwise `Telegram`.

### Existing Mail policy integration

Inbound Telegram materialization passes through existing:
- trust policy;
- user rules/filters;
- spam/phishing protection;
- thread archive state;
- thread mute state;
- Mail notification behavior.

No Telegram-specific bypass was introduced.

### Durable cursor and schema migration

Mail durable store schema advances to **v11**.

Telegram sync state persists:
- owner;
- connection ID;
- opaque cursor;
- last sync timestamp;
- version.

Qualification covers:
- fresh durable storage;
- restart recovery;
- v10→v11 migration;
- reopening the migrated v11 store;
- cursor reuse after restart.

### Replay and mutation safety

Provider replay is idempotent.

The same Telegram source identity with changed content or metadata fails closed with `ErrTelegramSyncConflict`.

A Telegram message that was imported and later permanently deleted from the mailbox is not resurrected on replay.

### Failure semantics

A Telegram authority/dependency failure:
- returns failure;
- does not fabricate imported messages;
- does not advance the durable cursor.

### Credential/privacy boundary

MAIL-2.24 does not accept or persist:
- Telegram bot token;
- access token;
- refresh token;
- client secret;
- phone-number credential;
- verification code;
- device/provider signing material.

Telegram message bodies remain private/off-chain and are not exposed to public 420Search.

## Level 1 qualification

Workflow: **420Mail Audit Qualification**

- Run: **37518560097** (#356)
- Job: **112457705148**
- Qualified implementation SHA: `71afe4c049488113e1085a57f95de1f496b15897`
- Exact tested merge candidate: `170a4a7ee65008587ce57fca40bdbab5beb4e21a`
- Current-main parent: `721a7f358e802bce91835851721eb93c4340f501`

Exact checkout evidence:
`HEAD is now at 170a4a7 Merge 71afe4c049488113e1085a57f95de1f496b15897 into 721a7f358e802bce91835851721eb93c4340f501`

Results:
- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS
- verifier explicitly reported:
  `MAIL-2.24 Telegram to 420Mail sync: qualified by app-scoped checks`

## Superseded attempts / diagnosed failures

### Run 37518318313 / job 112456869697

- Exact head — PASS
- Go format — FAIL
- later checks skipped
- diagnosis: formatting-only failure in `mail/telegram_sync_test.go`
- action: exact formatter diff applied

### Run 37518426662 / job 112457248848

- Exact head — PASS
- Go format — PASS
- Go test — FAIL
- race/vet/verifier skipped
- diagnosis: test-harness defect in the v10→v11 migration assertion. The empty `telegram_sync` map is intentionally omitted by JSON `omitempty`, so unmarshalling the raw disk JSON yields nil even though reopening through `OpenDurableStore` correctly normalizes it.
- action: assertion changed to verify persisted schema v11 plus successful reopen/normalization with a non-nil in-memory Telegram sync map.

Neither superseded run is completion evidence.

## Main reconciliation status

At MAIL-2.24 qualification:
- current `main`: `721a7f358e802bce91835851721eb93c4340f501`
- branch compare status: ahead
- branch behind count: 0
- PR mergeable: true

No additional main reconciliation commit was required during MAIL-2.24.

## Milestone status

MAIL-2.24 is an ordinary step inside the documented **External bridge milestone (MAIL-2.15 through MAIL-2.29)**.

- Level 2: **NOT RUN / NOT DUE**
- prior Mailbox Foundation and Wallet-native identity Level 2 evidence remains valid
- External bridge Level 2 remains deferred to the documented milestone boundary or an earlier material shared-dependency reason

## Intentionally deferred Level 3

Level 3 remains reserved for complete app-phase closeout.

No deliberate full repository Solidity inventory, duplicate Genesis full Foundry inventory, 420 Integrated/global qualification, Geth/global fault/soak suite, unrelated app audit, or broad repository closeout was run for this ordinary step.

Automatically triggered unrelated workflows are not claimed as MAIL-2.24 evidence.

## Live/deployment limitations

Repository completion does not claim:
- live Telegram credentials/provider availability;
- production Telegram sync authority implementation;
- live Telegram polling/update transport;
- production provider rate-limit/retry behavior;
- public-testnet Telegram sync qualification;
- Telegram outbound delivery.

Those remain later roadmap/live testnet/security/operations gates.

## Evidence inheritance

This evidence file and companion roadmap/PR bookkeeping are documentation/evidence-only and inherit qualification from the exact implementation SHA above without recursive requalification.

## Next canonical step

**MAIL-2.25 — 420Mail → Telegram Delivery**
