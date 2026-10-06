# 420Mail MAIL-2.10 qualification evidence

Step: **MAIL-2.10 — Outbox & Delivery Queue**  
Status: **COMPLETE**  
Qualification: **Level 1 ordinary-step qualification + Mailbox Foundation Level 2 retained integration milestone**

## Repository identity

- Repository: `abvhiael/420-integrated-v0.1`
- Branch: `mail-2-1-mailbox-state-model-20261005`
- Accumulated PR: **#530**
- Qualified implementation branch SHA: `a8b646134893a9c07a35e1cc998d8d397c449059`
- Exact GitHub PR merge-candidate SHA tested by CI: `c5632c6`
- Current `main` tested by the merge candidate: `c32e5aeb0b0e79643dfdffbbee50096b5fbba1a7`
- Original Phase 2 merge base: `f5fe16414893a1e4bd4f3db22eb36b685a2030f5`
- Workflow: **420Mail Audit Qualification**
- Final authoritative run: **37422199872** (#176)
- Final authoritative job: **112133813986** (`mail-audit`) — PASS

The closeout documents and roadmap status written after this implementation qualification are bookkeeping/evidence-only changes. They do not alter executable Mail code, tests, configuration, workflows, dependencies, interfaces, or runtime artifacts and therefore inherit this exact implementation qualification without recursive requalification.

## Canonical definition

The Phase 2 roadmap defines the step as:

> **MAIL-2.10 — Outbox & Delivery Queue** — Add queued/sending/retrying/delivered/failed/cancelled delivery lifecycle.

MAIL-2.10 closes the documented **Mailbox foundation milestone: MAIL-2.1 through MAIL-2.10**.

## Implemented lifecycle

MAIL-2.10 implements all six canonical states:

- `QUEUED`
- `SENDING`
- `RETRYING`
- `DELIVERED`
- `FAILED`
- `CANCELLED`

Queued delivery is owner-scoped and materializes the sender copy in the system-managed `OUTBOX`. Successful processing reuses the canonical Mail send path, converging the sender copy to `SENT`, materializing the recipient copy through the existing delivery/rules/trust/spam/conversation path, and recording terminal queue delivery evidence.

Retryable failures move to `RETRYING`; processing is bounded to three attempts and exhausted delivery moves to `FAILED`. Eligible queued/retrying/failed items can be cancelled. Sending/delivered items reject cancellation.

## Idempotency and crash recovery

Queue IDs reuse the canonical deterministic message identity derived from sender, recipient, and idempotency key. The queue stores durable request-fingerprint evidence.

A crash after the canonical send transaction but before queue finalization is reprocess-safe: the existing sender-scoped send idempotency record returns the already-created message rather than creating a duplicate delivery or duplicate notification, after which the queue record can converge to `DELIVERED`.

A restart regression exposed and corrected one pre-qualification defect: the request fingerprint was initially omitted from durable JSON. The final implementation persists that non-body idempotency evidence and restart qualification passes.

## Privacy and authority boundaries

- Body plaintext is not stored in Mail durable metadata.
- Queued body content is staged through the private blob provider.
- Successful canonical delivery writes through the existing recipient-private body path.
- Queue metadata is not publicly indexed and creates no on-chain Mail state.
- No Mail-owned smart contract, signing authority, token authority, or Genesis catalog promotion is introduced.
- Identity, Messenger policy, private storage, Notifications, rules, trust/spam protection, and conversation behavior remain delegated to their already-qualified boundaries.

## Durable storage

MAIL-2.10 advances Mail durable metadata schema from v7 to **v8**.

Schema v8 adds owner-scoped delivery records and migration initializes the delivery map for older supported stores. Restart qualification proves queued delivery metadata and private staging references survive reopen.

The obsolete roadmap reservation of `OUTBOX` is removed from canonical configuration. `OUTBOX` and `DRAFTS` are now declared system-managed folders rather than user-move targets.

## Authenticated API / typed client

Repository API:

- `POST /v1/outbox`
- `GET /v1/outbox`
- `GET /v1/outbox/{id}`
- `POST /v1/outbox/{id}/process`
- `POST /v1/outbox/{id}/retry`
- `POST /v1/outbox/{id}/cancel`

Typed Go client methods cover queue/list/get/process/retry/cancel.

## Level 1 coverage

The final exact-head Mail workflow passed:

- exact-head checkout
- Go formatting
- `go test ./mail/...`
- `go test -race ./mail/...`
- `go vet ./mail/...`
- `python3 scripts/verify-420mail-audit.py`

MAIL-2.10-specific coverage includes:

- queued OUTBOX materialization
- successful queue-to-SENT/INBOX delivery
- exactly-once notification under canonical idempotency
- retrying and terminal failed states
- bounded attempts
- cancellation and post-cancel rejection
- owner isolation for read/cancel
- deterministic queue replay
- conflicting idempotency replay rejection
- durable restart recovery
- authenticated HTTP queue/process/get/list behavior
- foreign HTTP read rejection
- v8 durable metadata validation
- static configuration/client/API invariants

## Final Level 1 result

**PASS** on implementation SHA `a8b646134893a9c07a35e1cc998d8d397c449059`.

CI checkout recorded:

`HEAD is now at c5632c6 Merge a8b646134893a9c07a35e1cc998d8d397c449059 into c32e5aeb0b0e79643dfdffbbee50096b5fbba1a7`

The verifier reported:

`420Mail audit qualification PASS`

and explicitly:

`MAIL-2.10 outbox and delivery queue: qualified by app-scoped checks`

## Level 2 Mailbox Foundation milestone

**PASS.**

The same exact-head workflow is the retained 420Mail app-integration suite: it executes the complete `mail/...` test surface, race detector, vet, and cumulative static verifier rather than only the new delivery tests. On the final SHA the verifier explicitly reconfirmed MAIL-2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, and 2.10.

A second identical broad run was intentionally not manufactured merely for ceremony. The required retained integration coverage already ran after MAIL-2.10 implementation on the same exact merge candidate, satisfying the documented Level 2 milestone while avoiding redundant work.

See `docs/audit/420MAIL-MAILBOX-FOUNDATION-MILESTONE-QUALIFICATION.md` for the milestone record.

## Superseded qualification attempts

- Run #171 stopped at Go formatting; behavioral/static checks were correctly skipped.
- Run #173 reached Go tests and exposed missing durable delivery-fingerprint persistence on restart; later gates were correctly skipped.
- Run #174 passed after that defect was repaired but preceded the final canonical config cleanup releasing the stale OUTBOX reservation.
- Run #176 is the final authoritative exact-head result after code, tests, config, verifier, and documentation implementation state were aligned.

## Level 3

**Intentionally deferred.** MAIL-2.10 is not phase closeout. Repository-wide/global Level 3 suites are not required here and were not deliberately rerun.

## Completion

**MAIL-2.10 — Outbox & Delivery Queue: COMPLETE.**

**Mailbox Foundation (MAIL-2.1–MAIL-2.10): COMPLETE at retained Level 2.**

Next canonical step: **MAIL-2.11 — Email-as-a-Wallet Onboarding**.
