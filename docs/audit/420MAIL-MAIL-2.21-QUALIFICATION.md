# 420Mail MAIL-2.21 Qualification

## Step

**MAIL-2.21 — Signal Share & Forward**

## Completion

- Status: **COMPLETE**
- Qualification level: **Level 1 — app-scoped step qualification**
- Qualified reconciled implementation SHA: `a70912f5ab6d4f7b3360c9f1e2d7328785d32488`
- Exact qualified PR merge-candidate SHA: `8103a011309cc4f2ee4fdf00e5895ae36047d6a1`
- Reconciliation/current `main` SHA: `721a7f358e802bce91835851721eb93c4340f501`
- Pre-reconciliation MAIL-2.21 implementation SHA: `c5185a76fd616f43ee42250d86aa61208cf2ac6d`
- Audit branch: `mail-2-11-email-wallet-onboarding-20261006`
- PR: #537

## Canonical requirement satisfied

MAIL-2.21 adds explicit authenticated **Signal Share & Forward** for a 420Mail message while preserving the external Signal transport and credential boundary established in MAIL-2.19 and the notifications-only transport work from MAIL-2.20.

MAIL-2.21 does not implement MAIL-2.22 Signal Deep Sync.

## Implementation summary

Implemented/updated repository surfaces:

- `mail/signal_share.go`
  - `SignalShareMode`
  - `SHARE` and `FORWARD` modes
  - `SignalShareRequest`
  - `SignalSharePayload`
  - `SignalShareReceipt`
  - `SignalShareAuthority`
  - `SignalShareService`
  - authenticated live-mailbox authorization via canonical `ReadBody`
  - bounded opaque destination reference, note and idempotency key
  - strict accepted-receipt validation
- `mail/signal_share_test.go`
  - foreign-message export rejection
  - body export only after canonical owner authorization
  - SHARE vs FORWARD payload semantics
  - no implicit original-sender metadata
  - permanent-delete export rejection
  - malformed-input rejection before provider authority
  - invalid provider-receipt rejection
  - dependency-failure propagation without fallback
  - authenticated HTTP share/forward
  - unauthenticated rejection
  - credential-bearing-field rejection
- `mail/http.go`
  - authenticated `POST /v1/connectors/signal/share`
  - strict JSON decoding
- `mail/client/client.go`
  - typed `ShareToSignal`
- `mail/signal_boundary.go`
  - Signal boundary advanced to `SHARE_FORWARD_ENABLED`
  - `outbound_notifications=true`
  - `share_and_forward=true`
  - inbound sync/webhook/deep sync remain disabled
- `mail/signal_boundary_test.go`
  - cumulative boundary expectations updated
  - disabling required share/forward or enabling later sync capabilities fails validation
- `config/420mail-service-v1.json`
  - explicit Signal share/forward policy
  - opaque destination reference and external provider authority boundaries
- `mail/web/index.html`
  - explicit **Share to Signal** and **Forward to Signal** actions shown on an opened message
  - deployment shell supplies only destination reference and optional note
- `docs/420MAIL.md`
  - authorization, payload, authority, receipt and scope boundaries
- `scripts/verify-420mail-audit.py`
  - retained MAIL-2.21 config/source/API/client/UI checks

## Exit criteria / invariants individually verified

### Explicit authenticated action

Signal share/forward is not automatic.

The user must explicitly invoke an authenticated share/forward request for one source Mail message.

### Canonical Mail authorization reused

`SignalShareService` calls the existing `Service.ReadBody` path.

That requires:
- authenticated actor;
- source message exists;
- actor is sender or recipient;
- actor owns a live mailbox copy;
- mailbox copy has not been permanently deleted.

Foreign or deleted source messages fail before the Signal authority is invoked.

### SHARE semantics

`SHARE` exports:
- authorized source Mail body;
- optional user note;
- source message ID for provenance/idempotency context;
- opaque Signal destination reference;
- caller idempotency key.

It does **not** automatically include the Mail subject.

### FORWARD semantics

`FORWARD` exports:
- authorized source Mail body;
- Mail subject;
- optional user note;
- source message ID;
- opaque destination reference;
- caller idempotency key.

Neither mode automatically includes the original Mail sender identity or source application metadata.

### Destination / provider authority

420Mail does not resolve Signal phone numbers/accounts itself.

The request carries only a bounded opaque destination reference. The external `SignalShareAuthority` / secure broker owns:
- Signal recipient/contact resolution;
- provider credential handling;
- transport execution;
- provider-side retry/idempotency semantics.

### Credential boundary

The dedicated HTTP request shape has no Signal:
- phone-number credential;
- registration/verification code;
- access token;
- refresh token;
- client secret;
- device/provider signing material.

Strict JSON decoding rejects unknown credential-bearing fields before provider delegation.

### Bounds

- opaque destination reference: max 512 bytes
- optional note: max 2048 bytes
- idempotency key: required and max 256 bytes
- mode: exactly `SHARE` or `FORWARD`

Malformed input is rejected before provider authority execution.

### Provider receipt validation

A successful result requires:
- `accepted=true`
- non-empty external delivery ID
- non-zero accepted timestamp

Incomplete or rejected authority results fail closed with `ErrSignalShareInvalidResult`.

### Boundary containment

The canonical Signal boundary now requires:
- status `SHARE_FORWARD_ENABLED`
- `outbound_notifications=true`
- `share_and_forward=true`

Still disabled:
- Signal account linking
- generic Signal connector registration
- inbound sync
- webhook ingestion
- deep sync
- public indexing
- on-chain Signal message bodies

MAIL-2.22 remains conditional on `STABLE_SUPPORTED_INTEGRATION_SURFACE_REQUIRED`.

## Current-main reconciliation

During initial MAIL-2.21 qualification, `main` advanced from `23ebff000a471bfbc4439894f797f3b17a530867` to `721a7f358e802bce91835851721eb93c4340f501`.

The exact first green PR merge candidate `f011456bf30260954abf60593a4e8aec5b420711` already included the newer main, but the audit branch itself became 68 commits behind.

Repository delta inspection from the common base proved:
- current-main changed paths: 60
- Mail branch changed paths: 46
- overlapping changed paths: **0**

A true two-parent reconciliation commit was therefore created:

`a70912f5ab6d4f7b3360c9f1e2d7328785d32488`

Parents:
1. MAIL-2.21 branch head `c5185a76fd616f43ee42250d86aa61208cf2ac6d`
2. current main `721a7f358e802bce91835851721eb93c4340f501`

The merge tree uses current main as its base and overlays only the 46 Mail-changed paths; no main-changed path was discarded.

After reconciliation:
- branch behind current main: 0
- PR mergeable: true

## Final Level 1 qualification

Workflow: **420Mail Audit Qualification**

- Run: **37514809792** (#321)
- Job: **112444884709**
- Qualified reconciled implementation SHA: `a70912f5ab6d4f7b3360c9f1e2d7328785d32488`
- Exact tested merge candidate: `8103a011309cc4f2ee4fdf00e5895ae36047d6a1`
- Current-main parent: `721a7f358e802bce91835851721eb93c4340f501`

Exact checkout evidence:

`HEAD is now at 8103a01 Merge a70912f5ab6d4f7b3360c9f1e2d7328785d32488 into 721a7f358e802bce91835851721eb93c4340f501`

Results:
- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS
- verifier explicitly reported: `MAIL-2.21 Signal share and forward: qualified by app-scoped checks`

## Superseded attempts / diagnosed failures

### Run 37514055550 / job 112442303430

- Exact head — PASS
- Go format — FAIL
- later checks skipped
- diagnosis: formatting-only extra blank line in `mail/client/client.go`
- action: exact formatter diff applied

### Run 37514147057 / job 112442612865

- Exact head — PASS
- Go format — PASS
- Go test — FAIL
- later checks skipped
- diagnosis: test-harness defect; permanent-delete regression attempted to delete directly from Inbox even though the already-qualified Mail lifecycle requires Trash first
- action: test corrected to move the owner copy to Trash before permanent deletion; production semantics were not weakened

### Run 37514295582 / job 112443128963

- Exact head — PASS
- Go format — PASS
- Go test — PASS
- Go race — PASS
- Go vet — PASS
- static verifier — PASS
- exact merge candidate: `f011456bf30260954abf60593a4e8aec5b420711`
- status: **superseded as final closeout evidence because main advanced and the branch required explicit reconciliation**

The final authoritative evidence is run 37514809792 above.

## Milestone status

MAIL-2.21 is an ordinary step inside the documented **External bridge milestone (MAIL-2.15 through MAIL-2.29)**.

- Level 2: **NOT RUN / NOT DUE**
- prior Mailbox Foundation and Wallet-native identity Level 2 evidence remains valid
- External bridge Level 2 remains deferred to the documented milestone boundary or an earlier material shared-dependency reason

## Intentionally deferred Level 3

Level 3 remains reserved for complete app-phase closeout.

No deliberate:
- full repository Solidity inventory
- duplicate Genesis full Foundry inventory
- 420 Integrated/global qualification
- Geth/global fault/soak suite
- unrelated app audit
- repository-wide closeout qualification

was run for this ordinary step.

Automatically triggered unrelated workflows are not claimed as MAIL-2.21 evidence.

## Live/deployment limitations

Repository completion does not claim:
- live Signal credentials/account registration
- live destination-reference resolution
- production Signal transport delivery
- provider retry/rate-limit behavior
- public-testnet Signal share/forward qualification
- Signal inbound/deep synchronization

Those remain later live/testnet/security/operations gates.

## Evidence inheritance

This evidence file and companion roadmap/PR bookkeeping are documentation/evidence-only and inherit qualification from the exact reconciled implementation SHA above without recursive requalification.

## Next canonical step

**MAIL-2.22 — Signal Deep Sync — conditional on a stable supported integration surface.**
