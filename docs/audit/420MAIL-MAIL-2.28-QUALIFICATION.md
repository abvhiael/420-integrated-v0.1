# 420Mail MAIL-2.28 Qualification

## Step

**MAIL-2.28 — Integration-Specific Filters**

## Completion

- Status: **COMPLETE**
- Qualification level: **Level 1 — app-scoped step qualification**
- Qualified implementation SHA: `954d422740142e874ed47bda1083cade6fb9d996`
- Audit branch: `mail-2-11-email-wallet-onboarding-20261006`
- PR: #537

## Canonical requirement satisfied

MAIL-2.28 adds bounded provider-specific filtering to the canonical unified integrations inbox established by MAIL-2.26.

The filter is a derived read concern only. It does not create provider-specific mailbox state, duplicate messages, or alter canonical message/mailbox ownership or lifecycle.

## Implemented filter model

Authenticated callers may optionally select:

- `source=discord`
- `source=telegram`

Omitting `source` preserves the existing unified Discord + Telegram integrations inbox.

The source value is normalized case-insensitively and validated against the already-qualified inbound integration source set. Unsupported sources fail closed with `ErrInvalidInput`.

Signal remains excluded because MAIL-2.22 qualified its deep-sync condition as unsatisfied.

## Implementation summary

Updated repository surfaces:

- `mail/integrations_inbox.go`
  - `IntegrationInboxFilter`
  - `IntegrationsInboxFiltered`
  - `normalizeIntegrationInboxFilter`
  - source selection before pagination
  - backward-compatible unfiltered `IntegrationsInbox`
- `mail/integrations_inbox_test.go`
  - provider filter behavior
  - case/whitespace normalization
  - filter-before-pagination behavior
  - unsupported-provider rejection
  - authenticated HTTP query behavior
- `mail/http.go`
  - authenticated `source` query projection
- `mail/client/client.go`
  - backward-compatible `IntegrationsInbox`
  - typed `IntegrationsInboxFiltered`
- `mail/web/index.html`
  - All integrations / Discord / Telegram selector
- `config/420mail-service-v1.json`
  - explicit allowed source filter values and fail-closed policy
- `docs/420MAIL.md`
  - MAIL-2.28 contract and boundaries
- `scripts/verify-420mail-audit.py`
  - retained MAIL-2.28 config/source/client/UI checks

## Exit criteria / invariants individually verified

### Authentication and owner isolation

The route remains authenticated.

The filter operates only over the authenticated actor's canonical Inbox mailbox index and cannot select another owner's state.

### Qualified source containment

Allowed provider values are exactly:

- `discord`
- `telegram`

Native 420Mail, Signal, SMTP-like, future, or provider-lookalike values are rejected rather than silently promoted.

### Canonical mailbox lifecycle preservation

Filtered items must still be:

- canonical Inbox state;
- not permanently deleted;
- sourced from a qualified inbound integration.

Archive, Junk, Trash, deleted records, native Mail records, and foreign-owner records remain excluded.

### Filter-before-pagination

Provider selection is applied before cursor pagination.

A provider-specific cursor therefore pages across the selected provider view rather than across mixed-provider records that are later discarded.

### Backward compatibility

The pre-existing typed `IntegrationsInbox(ctx, cursor, limit)` surface remains available and delegates to the unfiltered view.

The new typed `IntegrationsInboxFiltered(ctx, source, cursor, limit)` surface adds provider selection without breaking existing callers.

### Security/privacy boundary

MAIL-2.28 does not expose:

- provider credentials;
- access/refresh tokens or client secrets;
- private message bodies inline;
- public identity/message indexing;
- on-chain message bodies.

No new provider authority or transport capability is introduced.

## Level 1 qualification

Workflow: **420Mail Audit Qualification**

- Run: **37524981622** (#398)
- Job: **112479585487**
- Exact qualified SHA: `954d422740142e874ed47bda1083cade6fb9d996`

Results:

- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS
- verifier includes:
  `MAIL-2.28 integration-specific filters: qualified by app-scoped checks`

## Milestone status

MAIL-2.28 is an ordinary step inside the **External bridge milestone (MAIL-2.15 through MAIL-2.29)**.

- Level 2: **NOT RUN / NOT DUE**
- External bridge Level 2 remains due at MAIL-2.29
- no material shared-dependency reason was identified to pull Level 2 forward
- prior Mailbox Foundation and Wallet-native identity Level-2 evidence remains valid

## Intentionally deferred Level 3

Level 3 remains reserved for complete app-phase closeout.

No broad repository/global suite is claimed as MAIL-2.28 evidence.

Automatically triggered unrelated workflows are not qualification evidence for this step.

## Main-branch movement

After the exact MAIL-2.28 qualification run, `main` advanced independently to `ba7b9c2067877bf1ec9093f251928089420350b5`.

That unrelated movement does not invalidate the exact-SHA Level-1 result above. PR reconciliation remains a separate operation and is not performed by this evidence-only closeout.

## Evidence inheritance

This evidence file and companion roadmap/PR bookkeeping are documentation/evidence-only and inherit qualification from exact implementation SHA `954d422740142e874ed47bda1083cade6fb9d996` without recursive requalification.

## Next canonical step

**MAIL-2.29 — Unified Notification Routing**

MAIL-2.29 is also the External bridge milestone Level-2 boundary.
