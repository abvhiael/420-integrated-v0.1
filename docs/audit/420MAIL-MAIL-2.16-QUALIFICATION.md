# 420Mail MAIL-2.16 Qualification

## Step

**MAIL-2.16 — Discord → 420Mail Sync**

## Completion

- Status: **COMPLETE**
- Qualification level: **Level 1 — app-scoped step qualification**
- Qualified implementation SHA: `f2a4980c9dbdafdc4e8107dea60291afe565f5cc`
- Exact qualified PR merge-candidate SHA: `b15cdf360a8f3d3f8ecde61eb26896e74abece9e`
- Reconciliation/current `main` SHA: `23ebff000a471bfbc4439894f797f3b17a530867`
- Audit branch: `mail-2-11-email-wallet-onboarding-20261006`
- PR: #537

The qualified implementation commit is itself a true reconciliation merge with parents:
- prior accumulated Mail branch head: `2619b20c135b31731604464130f625c75bb829c5`;
- current `main`: `23ebff000a471bfbc4439894f797f3b17a530867`.

GitHub then qualified the exact pull-request merge candidate `b15cdf...` against that same current `main`.

## Canonical requirement satisfied

MAIL-2.16 adds inbound **Discord → 420Mail synchronization** on top of the provider-neutral connector framework and MAIL-2.15 Discord account linking.

It does not implement MAIL-2.17 outbound Discord delivery or MAIL-2.18 Discord wallet verification.

## Implementation summary

Implemented/updated repository surfaces:

- `mail/discord_sync.go`
  - `DiscordInboundMessage`, `DiscordSyncPage`, `DiscordSyncAuthority`;
  - owner/connection-bound `DiscordSyncState`;
  - `DiscordSyncService`;
  - deterministic source ordering;
  - private mailbox materialization;
  - external-ID idempotency and mutation conflict detection;
  - durable cursor handling;
  - deterministic Discord-channel conversation IDs;
  - durable sync-state validation.
- `mail/discord_link.go`
  - Discord adapter advertises `PULL` only when its authority implements `DiscordSyncAuthority`;
  - link-only authorities still fail `PULL` with `ErrConnectorUnsupported` before request validation;
  - normalized Discord messages are emitted through generic connector pull items.
- `mail/store.go`
  - durable Mail store schema advanced from v8 to **v9**;
  - durable `DiscordSync` map added to disk/in-memory representation, clone, normalization, migration and validation paths.
- `mail/discord_sync_test.go`
  - private Inbox materialization;
  - idempotent replay;
  - cursor advancement;
  - external-ID mutation rejection;
  - malformed provider-message rejection;
  - durable restart recovery;
  - dependency failure with no cursor advancement;
  - permanent deletion replay cannot resurrect a deleted message.
- `mail/discord_sync_http_test.go`
  - authenticated sync lifecycle;
  - unauthenticated rejection;
  - strict unknown/secret-field rejection;
  - method boundary;
  - conflict mapping.
- `mail/http.go`
  - authenticated `POST /v1/connectors/discord/sync`.
- `mail/client/client.go`
  - typed `SyncDiscord`.
- `mail/web/index.html`
  - Discord `PULL` capability presents a Sync Discord action;
  - deployment connector resolves the existing linked connection ID;
  - imported count is surfaced and Inbox refreshed.
- `config/420mail-service-v1.json`
  - metadata schema v9;
  - explicit Discord sync policy.
- `docs/420MAIL.md`
  - documented inbound-sync semantics and later-step boundaries.
- `scripts/verify-420mail-audit.py`
  - schema-v9 and MAIL-2.16 retained checks.

## Exit criteria / invariants individually verified

### Existing Discord account link is authoritative

Sync requires:
- authenticated 420Mail identity;
- canonical `discord:{snowflake}` connection ID;
- Discord connector with declared `PULL` capability.

MAIL-2.16 does not create a second link identity model.

### Provider pull is bounded and validated

The Discord sync authority receives:
- Mail actor identity;
- linked Discord user snowflake;
- prior opaque cursor.

Returned messages require:
- message snowflake;
- author snowflake;
- channel snowflake;
- bounded author/channel metadata;
- bounded message body;
- source timestamp.

Generic connector/provider/connection/item validation remains active.

### Private Mail materialization

New Discord messages materialize as:
- recipient: authenticated Mail identity;
- sender: `discord:{author-snowflake}`;
- source: `discord`;
- visibility: `PRIVATE`;
- initial mailbox folder: `INBOX`;
- private body reference/digest, not on-chain body content.

Existing Mail trust controls, spam/phishing protection, incoming rules, conversation archive/mute state, quarantine and notification suppression are reused rather than bypassed.

### Idempotency and immutable external event identity

Idempotency is bound to owner + Discord connection + Discord message ID.

- identical replay: no new Mail message;
- same external Discord message ID with changed authoritative payload: `ErrDiscordSyncConflict`;
- permanent Mail deletion remains final: an identical later Discord replay is recognized as consumed and **does not resurrect the deleted mailbox item**.

### Durable cursor / restart recovery

Per-owner/per-connection cursor state is durable in Mail store schema v9.

The cursor advances only after:
1. the provider page validates; and
2. every message in the page is successfully processed.

Provider/dependency/materialization failure therefore does not advance the cursor.

A durable-store restart resumes from the persisted cursor.

### Deterministic ordering and conversation grouping

Inbound messages are processed `created_at ASC, message_id ASC`.

Discord channel conversation IDs are deterministic over owner + linked Discord connection + channel ID.

### Scope containment

MAIL-2.16 does not add:
- 420Mail → Discord delivery;
- required Discord webhook sync;
- Discord wallet verification;
- public 420Search indexing of Discord content;
- on-chain Discord body storage.

## Level 1 qualification

Workflow: **420Mail Audit Qualification**

- Run: **37502791094** (#252)
- Job: **112403775760**
- Qualified implementation SHA: `f2a4980c9dbdafdc4e8107dea60291afe565f5cc`
- Exact tested merge candidate: `b15cdf360a8f3d3f8ecde61eb26896e74abece9e`
- Current-main parent: `23ebff000a471bfbc4439894f797f3b17a530867`

Exact checkout evidence:
`HEAD is now at b15cdf3 Merge f2a4980c9dbdafdc4e8107dea60291afe565f5cc into 23ebff000a471bfbc4439894f797f3b17a530867`

Results:
- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS
- verifier explicitly reported: `MAIL-2.16 Discord to 420Mail sync: qualified by app-scoped checks`

## Superseded attempts / diagnosed failures

### Run 37501721849 / job 112400124598
- Exact head — PASS
- Go format — FAIL
- later checks skipped
- diagnosis: formatting-only candidate failure in new Discord sync/client files.
- action: exact formatter output applied.

### Run 37501837355 / job 112400524097
- Exact head — PASS
- Go format — PASS
- Go test — FAIL at compile
- diagnosis: **test-harness fixture defect**; new tests referenced nonexistent stub names rather than canonical package fixtures.
- action: tests switched to existing `testIDs`, `testPolicy`, `testBlobs`, `testNotify`.

### Run 37501953306 / job 112400915039
- Exact head — PASS
- Go format — PASS
- Go test — FAIL
- diagnoses:
  1. link-only Discord adapter validated pull input before returning unsupported capability;
  2. malformed timestamp was correctly rejected by the generic connector layer, while the test required only the Discord-specific error.
- actions:
  1. capability check moved before request validation for link-only authorities;
  2. test recognizes either valid fail-closed validation layer without weakening production validation.

These runs are superseded and are not completion evidence.

## Main reconciliation

While MAIL-2.16 was in progress, `main` advanced with PuffBuddies work. Repository comparison showed the new main-side files were disjoint from the Mail implementation.

Before final qualification, the Mail branch was explicitly reconciled to current main using a two-parent merge commit:
`f2a4980c9dbdafdc4e8107dea60291afe565f5cc`.

The merge used current-main tree state and overlaid the accumulated Mail PR files, preserving both lines. After reconciliation:
- PR base SHA: `23ebff000a471bfbc4439894f797f3b17a530867`;
- branch behind count: 0;
- PR mergeable: true.

## Milestone status

MAIL-2.16 is an ordinary step inside the documented **External bridge milestone (MAIL-2.15 through MAIL-2.29)**.

- Level 2: **NOT RUN / NOT DUE** at MAIL-2.16.
- Prior Mailbox Foundation and Wallet-native identity Level 2 evidence remains valid.
- External bridge Level 2 remains deferred to the meaningful documented milestone boundary or an earlier material shared-dependency reason.

## Intentionally deferred Level 3

Level 3 remains reserved for complete app-phase closeout.

No full repository Solidity inventory, duplicate Genesis Foundry inventory, 420 Integrated/global qualification, Geth/global fault/soak suite, unrelated app audit, or broad repository Docs qualification was deliberately run for this ordinary step.

Automatically triggered unrelated workflows are not claimed as MAIL-2.16 evidence.

## Live/deployment limitations

Repository completion does not claim:
- live Discord OAuth/provider credentials;
- production Discord API pull behavior;
- real Discord pagination/rate limiting;
- live provider token refresh/revocation;
- production external message edits/deletes;
- public-testnet sync;
- Discord outbound delivery or wallet verification.

Those remain later roadmap/live testnet/security/operations gates.

## Evidence inheritance

This evidence file and the companion roadmap/PR bookkeeping changes are documentation/evidence-only. They do not alter executable code, tests, workflows, dependencies, configuration, interfaces, runtime artifacts or deployment state and therefore inherit qualification from the exact implementation SHA above without recursive requalification.

## Next canonical step

**MAIL-2.17 — 420Mail → Discord Delivery**
