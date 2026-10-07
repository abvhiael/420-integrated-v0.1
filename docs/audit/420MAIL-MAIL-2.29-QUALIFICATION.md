# 420Mail MAIL-2.29 Qualification

## Step

**MAIL-2.29 — Unified Notification Routing**

## Completion

- Status: **COMPLETE**
- Qualification level: **Level 1 — app-scoped step qualification**
- Qualified feature SHA: `07243b332b6e752475985878049bc84b9b5d952b`
- Exact tested PR merge-candidate SHA: `7d9e4860a8d8c82283dc7bf6c19ba304106bcea5`
- Tested `main` parent: `d1e6dae8cf6cc8ea513ffaf26d1dbad6d3c7f0b4`
- Audit branch: `mail-2-11-email-wallet-onboarding-20261006`
- PR: #537

## Canonical definition

The canonical Phase 2 roadmap defines MAIL-2.29 as **Unified Notification Routing** and places it as the final step of the **External bridge milestone (MAIL-2.15 through MAIL-2.29)**.

Repository evidence provides no more detailed subordinate contract. The implementation therefore unifies only notification transports already qualified as notification transports and does not reinterpret explicit provider message-delivery APIs as notification channels.

## Repository-grounded transport boundary

Qualified notification paths before MAIL-2.29:

- canonical injected `NotificationSink` representing 420Notifications;
- MAIL-2.20 Signal notification authority.

Discord and Telegram currently expose explicit PUSH/message-delivery operations requiring caller-selected provider destinations. They do not provide a qualified automatic notification destination-resolution authority and are therefore not silently promoted into background notification routes.

Signal deep sync remains disabled under the qualified MAIL-2.22 conditional-gate outcome.

## Implementation summary

Added:

- `mail/notification_routing.go`
  - `UnifiedNotificationRouter`
  - canonical route IDs `420notifications` and `signal`
  - deterministic route ordering
  - all-route attempt semantics
  - route-error aggregation preserving `errors.Is`
  - validation before fanout
- `mail/notification_routing_test.go`
  - deterministic route/order coverage
  - route-failure isolation
  - malformed-event fail-closed behavior
  - explicit Discord/Telegram non-promotion
  - no-route optional behavior

Updated:

- `mail/signal_notifications.go`
  - existing `SignalNotificationSink` now delegates to `UnifiedNotificationRouter`
  - existing deployment composition remains source-compatible
- `config/420mail-service-v1.json`
  - explicit unified routing policy and route boundary
- `docs/420MAIL.md`
  - canonical routing semantics, privacy, authority, and exclusions
- `scripts/verify-420mail-audit.py`
  - cumulative MAIL-2.29 retained checks
- `docs/audit/420MAIL-MAIL-2.28-QUALIFICATION.md`
  - corrected historical distinction between feature SHA and exact tested PR merge candidate using workflow log evidence

## Exit criteria / invariants individually verified

### Canonical routes

Current qualified routes are exactly, in deterministic order:

1. `420notifications`
2. `signal`

No new provider authority was invented.

### Route failure isolation

Every configured qualified route is attempted once even when an earlier route fails.

Multiple route errors are retained in `NotificationRoutingError` and remain discoverable through Go error unwrapping.

### Mail delivery isolation

The canonical Mail service continues to treat notification delivery as non-transactional after message persistence.

Notification transport failure therefore does not roll back a successfully delivered Mail message.

### Idempotent replay

Notification routing remains downstream of the canonical Mail creation/idempotency decision.

Replay of an already-created Mail send does not generate a second notification event.

### Mute/quarantine suppression

Existing trust/rules/spam/conversation processing still occurs before the notification sink.

Muted and quarantined recipient copies suppress invocation of all routed notification transports rather than suppressing only one provider.

### Privacy

The unified router receives the existing bounded `Notification` event and does not receive a Mail body or subject.

The Signal route keeps its existing stricter privacy-minimized request.

No private message body is publicly indexed or moved on-chain.

### Discord/Telegram boundary

Discord and Telegram remain explicit message-delivery transports.

MAIL-2.29 does not infer Discord channel IDs or Telegram chat IDs and does not turn their explicit PUSH operations into background notifications.

### Signal boundary

MAIL-2.29 does not require Signal account linking, provider registration, inbound sync, webhook ingestion, or deep sync.

## Level 1 qualification

Workflow: **420Mail Audit Qualification**

- Run: **37526300703** (#401)
- Job: **112484051141**
- Qualified feature SHA: `07243b332b6e752475985878049bc84b9b5d952b`
- Exact tested PR merge candidate: `7d9e4860a8d8c82283dc7bf6c19ba304106bcea5`
- Exact checkout log:
  `HEAD is now at 7d9e486 Merge 07243b332b6e752475985878049bc84b9b5d952b into d1e6dae8cf6cc8ea513ffaf26d1dbad6d3c7f0b4`

Results:

- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS
- verifier output:
  `MAIL-2.29 unified notification routing: qualified by app-scoped checks`

## External bridge milestone

MAIL-2.29 is the documented External bridge milestone boundary.

The exact same run executes the complete retained Mail package, race suite, vet, and cumulative static verifier across all accumulated Mail behavior. It therefore also provides the distinct **Level 2 retained app-integration coverage** for MAIL-2.15 through MAIL-2.29.

A duplicate second execution of the identical suite on the identical SHA is not required and would provide no additional coverage.

Durable Level-2 evidence is recorded separately in:

`docs/audit/420MAIL-EXTERNAL-BRIDGE-MILESTONE-QUALIFICATION.md`

## Intentionally deferred Level 3

Level 3 is **NOT RUN / NOT DUE**.

No complete repository Solidity inventory, Genesis full-inventory Foundry duplication, 420 Integrated/global qualification, Geth/global fault/soak suite, unrelated app audit, or repository-wide phase closeout is claimed here.

## Limitations / blockers

No repository-side blocker remains for MAIL-2.29 or the External bridge milestone.

Live/testnet provider credentials, deployed external adapters, provider outage operations, public-testnet evidence, and production security/operations remain later roadmap/audit gates.

## Evidence inheritance

This evidence file and companion roadmap/PR bookkeeping are evidence-only and inherit qualification from exact tested merge-candidate SHA `7d9e4860a8d8c82283dc7bf6c19ba304106bcea5` without recursive qualification.

## Next canonical step

**MAIL-2.30 — Full Desktop Mail UI**
