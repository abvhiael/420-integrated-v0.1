# 420Mail MAIL-2.26 Qualification

## Step

**MAIL-2.26 — Unified Integrations Inbox**

## Completion

- Status: **COMPLETE**
- Qualification level: **Level 1 — app-scoped step qualification**
- Qualified implementation SHA: `142e65d58d898fd8a96d3c36292da6aafe83a4e2`
- Exact qualified PR merge-candidate SHA: `94862edd365a32606f213801c81e4a86f2ea3c52`
- Current `main` / base SHA: `721a7f358e802bce91835851721eb93c4340f501`
- Audit branch: `mail-2-11-email-wallet-onboarding-20261006`
- PR: #537

## Canonical requirement satisfied

MAIL-2.26 adds a single authenticated Inbox view for messages imported from qualified external integrations.

Repository evidence contains no more detailed subordinate specification for MAIL-2.26 beyond the canonical roadmap name. The implementation therefore preserves existing mailbox architecture and creates a derived view rather than inventing a parallel integration mailbox lifecycle.

## Implementation summary

Implemented/updated repository surfaces:

- `mail/integrations_inbox.go`
  - `IntegrationsInboxPage`
  - `Service.IntegrationsInbox`
  - explicit supported integration source classifier
  - deterministic integrations-only pagination
- `mail/integrations_inbox_test.go`
  - Discord/Telegram unification
  - native-message exclusion
  - archive/delete/foreign-owner exclusion
  - canonical mailbox-state preservation
  - pagination after source filtering
  - authentication and invalid-cursor rejection
  - explicit source allowlist boundary
  - HTTP qualification
  - proof MAIL-2.28 provider-specific filtering is not pulled forward
- `mail/http.go`
  - authenticated `GET /v1/integrations/inbox`
- `mail/client/client.go`
  - typed `IntegrationsInbox`
- `mail/web/index.html`
  - thin unified integrations Inbox panel
  - refresh action
  - canonical message-open behavior
- `config/420mail-service-v1.json`
  - explicit derived-view, source, pagination, privacy, and MAIL-2.28 deferral policy
- `docs/420MAIL.md`
  - canonical view semantics, ordering, API/client and scope boundaries
- `scripts/verify-420mail-audit.py`
  - retained MAIL-2.26 config/source/API/client/UI assertions

## Exit criteria / invariants individually verified

### Canonical mailbox state remains authoritative

The integrations Inbox is a derived view over the existing Mail message and mailbox-state stores.

It does not:
- create a duplicate integrations message store;
- duplicate private bodies;
- create a separate read/archive/delete lifecycle;
- mutate message state simply by listing it.

Returned entries preserve their existing `Message` and `MailboxState`.

### Supported inbound sources

Current source allowlist:
- `discord`;
- `telegram`.

Signal is intentionally absent because MAIL-2.22 qualified the Signal deep-sync condition as unsatisfied.

Native `420/service/mail/v1` messages and unknown/future source labels are excluded.

### Inbox/owner isolation

An item appears only when:
- mailbox owner exactly matches the authenticated actor;
- canonical folder is `INBOX`;
- mailbox record is not permanently deleted;
- message source is a qualified supported inbound integration.

Archived, junk, trash, deleted, native, and another user's entries are excluded.

### Mailbox-state preservation

Qualification proves returned items preserve canonical:
- read state;
- starred state;
- mailbox version;
- message source and metadata.

### Ordering and pagination

Ordering is deterministic:
1. `created_at` descending;
2. message ID ascending for ties.

Opaque cursor pagination occurs after the integrations-only view is constructed, so native or excluded mailbox entries do not consume page slots.

### Scope containment

MAIL-2.26 does not implement provider-specific source filtering.

A supplied `source=discord` query does not alter the unified result. Integration-specific filters remain canonical MAIL-2.28 work.

### Privacy boundary

The integrations Inbox does not inline private body content.

Body retrieval continues through existing authenticated message-read handling and private blob storage.

No public indexing or on-chain body exposure is introduced.

## Level 1 qualification

Workflow: **420Mail Audit Qualification**

- Run: **37522596788** (#382)
- Job: **112471508275**
- Qualified implementation SHA: `142e65d58d898fd8a96d3c36292da6aafe83a4e2`
- Exact tested merge candidate: `94862edd365a32606f213801c81e4a86f2ea3c52`
- Current-main parent: `721a7f358e802bce91835851721eb93c4340f501`

Exact checkout evidence:
`HEAD is now at 94862ed Merge 142e65d58d898fd8a96d3c36292da6aafe83a4e2 into 721a7f358e802bce91835851721eb93c4340f501`

Results:
- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS
- verifier explicitly reported:
  `MAIL-2.26 unified integrations inbox: qualified by app-scoped checks`

## Superseded attempt

### Run 37522509638 / job 112471212239

- Exact head — PASS
- Go format — FAIL
- tests/race/vet/verifier skipped
- diagnosis: formatting-only extra blank line in `mail/integrations_inbox_test.go`
- action: exact formatter diff applied

The superseded run is not completion evidence.

## Main reconciliation status

At MAIL-2.26 qualification:
- current `main`: `721a7f358e802bce91835851721eb93c4340f501`
- branch compare status: ahead
- branch behind count: 0
- PR mergeable: true

No additional main reconciliation commit was required during MAIL-2.26.

## Milestone status

MAIL-2.26 is an ordinary step inside the documented **External bridge milestone (MAIL-2.15 through MAIL-2.29)**.

- Level 2: **NOT RUN / NOT DUE**
- prior Mailbox Foundation and Wallet-native identity Level 2 evidence remains valid
- External bridge Level 2 remains deferred to MAIL-2.29 unless a material shared-dependency reason requires it earlier

## Intentionally deferred Level 3

Level 3 remains reserved for complete app-phase closeout.

No deliberate full repository Solidity inventory, duplicate Genesis full Foundry inventory, 420 Integrated/global qualification, Geth/global fault/soak suite, unrelated app audit, or broad repository closeout was run for this ordinary step.

Automatically triggered unrelated workflows are not claimed as MAIL-2.26 evidence.

## Limitations / blockers

No repository-side blocker remains for MAIL-2.26 completion.

The current unified view includes only integrations that currently have qualified inbound synchronization:
- Discord;
- Telegram.

Signal may only enter the unified Inbox after its separately qualified deep-sync gate is legitimately satisfied in a future substantive implementation.

Provider-specific integrations Inbox filtering remains deferred to MAIL-2.28 by design.

## Evidence inheritance

This evidence file and companion roadmap/PR bookkeeping are documentation/evidence-only and inherit qualification from the exact implementation SHA above without recursive requalification.

## Next canonical step

**MAIL-2.27 — Cross-Platform Verified Identity**
