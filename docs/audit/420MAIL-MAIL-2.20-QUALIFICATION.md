# 420Mail MAIL-2.20 Qualification

## Step

**MAIL-2.20 — 420Mail → Signal Notifications**

## Completion

- Status: **COMPLETE**
- Qualification level: **Level 1 — app-scoped step qualification**
- Qualified implementation SHA: `e3b349d9c91ed61cf8c61422d6739a359526a1ae`
- Exact qualified PR merge-candidate SHA: `95e2880048d6ddc1695e90912ab4a5a5736d8ae7`
- Current `main` / base SHA: `23ebff000a471bfbc4439894f797f3b17a530867`
- Audit branch: `mail-2-11-email-wallet-onboarding-20261006`
- PR: #537

## Canonical requirement satisfied

MAIL-2.20 adds privacy-minimized outbound **420Mail → Signal notifications** while preserving the MAIL-2.19 external-transport boundary.

It does not implement MAIL-2.21 Signal Share & Forward or MAIL-2.22 Signal Deep Sync.

## Implementation summary

Implemented/updated repository surfaces:

- `mail/signal_notifications.go`
  - `SignalNotificationRequest`
  - `SignalNotificationReceipt`
  - `SignalNotificationAuthority`
  - `SignalNotificationService`
  - `SignalNotificationSink`
  - deterministic recipient/message idempotency
  - accepted-vs-suppressed provider-result validation
  - privacy-minimized fixed notification payload
- `mail/signal_notifications_test.go`
  - payload minimization
  - deterministic recipient-bound idempotency
  - consent suppression
  - malformed provider-result rejection
  - malformed notification rejection before authority
  - preservation of existing 420Notifications sink
  - existing Mail send-path integration
  - Signal outage does not roll back Mail delivery
  - duplicate Mail send does not emit duplicate Signal notification
  - dependency failure has no insecure fallback
- `mail/signal_boundary.go`
  - Signal boundary advanced from `BOUNDARY_ONLY` to `NOTIFICATIONS_ONLY`
  - `outbound_notifications=true`
  - all later Signal capabilities remain disabled
  - validator requires the notifications-only capability state
- `mail/signal_boundary_test.go`
  - cumulative boundary expectations updated
  - disabling notifications or enabling later capabilities fails validation
- `config/420mail-service-v1.json`
  - explicit Signal notification authority/privacy/idempotency/failure policy
- `mail/web/index.html`
  - thin UI reflects notifications-only Signal boundary
  - no Signal share/forward or sync action exposed
- `docs/420MAIL.md`
  - notification path, privacy, consent, idempotency, failure and scope documentation
- `scripts/verify-420mail-audit.py`
  - retained MAIL-2.20 boundary/config/source/UI checks

## Exit criteria / invariants individually verified

### Existing non-authoritative Mail notification path reused

420Mail already emits `Notification` only after successful recipient mailbox materialization and suppresses it when the recipient copy is muted/quarantined.

MAIL-2.20 reuses that path rather than creating a second mail-delivery lifecycle.

### Existing 420Notifications integration preserved

`SignalNotificationSink` can wrap the existing `NotificationSink`.

The primary 420Notifications sink is still invoked independently, and Signal delivery is supplementary/non-authoritative.

### Privacy-minimized Signal payload

The Signal authority receives only:
- event ID derived from Mail message ID
- recipient 420Mail identity
- notification kind `NEW_MAIL`
- fixed title `New 420Mail message`
- deterministic idempotency key

The request contains no:
- Mail body
- subject
- sender identity
- source application
- wallet data
- Signal credentials

Tests verify both field shape and serialized payload do not expose sender/source/body/subject.

### Destination and consent remain external

420Mail does not store a Signal account mapping or credential.

Recipient-to-Signal destination resolution and notification consent/opt-in evaluation remain inside `SignalNotificationAuthority`.

A consent/ineligibility suppression is a valid terminal result:
- `suppressed=true`
- `accepted=false`
- no delivery ID
- no accepted timestamp

### Accepted provider receipt validation

A successful provider result must contain:
- `accepted=true`
- `suppressed=false`
- non-empty delivery ID
- non-zero accepted timestamp

Contradictory or incomplete results fail closed with `ErrSignalNotificationInvalidResult`.

### Deterministic idempotency

The idempotency domain is:

`420/MAIL/SIGNAL/NOTIFICATION/V1`

The key binds recipient identity + Mail message ID.

Mail's existing send idempotency ensures replay of an already-created message does not re-enter the notification path, and the dedicated regression verifies no second Signal call occurs.

### Signal outage does not roll back Mail

Signal delivery remains best-effort relative to canonical Mail delivery.

A Signal authority outage:
- does not roll back a successful Mail send
- does not remove the recipient Inbox copy
- does not suppress the independent primary 420Notifications sink

### Boundary containment

The canonical Signal boundary now requires:
- status `NOTIFICATIONS_ONLY`
- `outbound_notifications=true`

Still disabled:
- account linking
- provider registration as a generic connector
- share/forward
- inbound sync
- webhook ingestion
- deep sync
- public indexing
- on-chain Signal message bodies

Deep sync remains gated by `STABLE_SUPPORTED_INTEGRATION_SURFACE_REQUIRED`.

## Level 1 qualification

Workflow: **420Mail Audit Qualification**

- Run: **37512212691** (#306)
- Job: **112435977010**
- Qualified implementation SHA: `e3b349d9c91ed61cf8c61422d6739a359526a1ae`
- Exact tested merge candidate: `95e2880048d6ddc1695e90912ab4a5a5736d8ae7`
- Current-main parent: `23ebff000a471bfbc4439894f797f3b17a530867`

Exact checkout evidence:
`HEAD is now at 95e2880 Merge e3b349d9c91ed61cf8c61422d6739a359526a1ae into 23ebff000a471bfbc4439894f797f3b17a530867`

Results:
- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS
- verifier explicitly reported: `MAIL-2.20 420Mail to Signal notifications: qualified by app-scoped checks`

## Superseded attempts / diagnosed failures

### Run 37511987050 / job 112435192374

- Exact head — PASS
- Go format — FAIL
- downstream checks skipped
- diagnosis: formatting-only failure in `mail/signal_notifications_test.go`
- action: exact formatter output applied

### Run 37512086410 / job 112435542405

- Exact head — PASS
- Go format — PASS
- Go test — FAIL
- race/vet/verifier skipped
- diagnosis: genuine production boundary-validator defect; after advancing to `NOTIFICATIONS_ONLY`, the validator did not require `outbound_notifications=true`
- action: production validator fixed to reject contradictory notifications-disabled state

Neither superseded run is completion evidence.

## Main reconciliation status

At MAIL-2.20 qualification:
- current `main`: `23ebff000a471bfbc4439894f797f3b17a530867`
- branch compare status: ahead
- branch behind count: 0
- PR mergeable: true

No additional main reconciliation commit was required because current `main` remained the already-reconciled base throughout MAIL-2.20.

## Milestone status

MAIL-2.20 is an ordinary step inside the documented **External bridge milestone (MAIL-2.15 through MAIL-2.29)**.

- Level 2: **NOT RUN / NOT DUE**
- prior Mailbox Foundation and Wallet-native identity Level 2 evidence remains valid
- External bridge Level 2 remains deferred to the documented milestone boundary or an earlier material shared-dependency reason

## Intentionally deferred Level 3

Level 3 remains reserved for complete app-phase closeout.

No deliberate full repository Solidity inventory, duplicate Genesis full Foundry inventory, 420 Integrated/global qualification, Geth/global fault/soak suite, unrelated app audit, or broad repository closeout was run for this ordinary step.

Automatically triggered unrelated workflows are not claimed as MAIL-2.20 evidence.

## Live/deployment limitations

Repository completion does not claim:
- live Signal credentials or account ownership
- live recipient-to-Signal destination mapping
- production consent/subscription store
- live Signal transport delivery
- production retry/rate-limit behavior
- public-testnet Signal delivery qualification
- Signal share/forward
- Signal deep sync

Those remain later roadmap/live testnet/security/operations gates.

## Evidence inheritance

This evidence file and companion roadmap/PR bookkeeping are documentation/evidence-only and inherit qualification from the exact implementation SHA above without recursive requalification.

## Next canonical step

**MAIL-2.21 — Signal Share & Forward**
