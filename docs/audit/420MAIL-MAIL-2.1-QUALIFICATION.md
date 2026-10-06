# 420Mail MAIL-2.1 qualification evidence

Step: **MAIL-2.1 — Mailbox State Model**  
Status: **COMPLETE**  
Qualification level: **Level 1 — per-roadmap-step fast qualification**

## Repository identity

- Audit/feature branch: `mail-2-1-mailbox-state-model-20261005`
- PR: **#530 — feat(mail): MAIL-2.1 mailbox state model**
- Reconciliation/base `main` SHA: `f5a0d703ca015962e49e95d075ff582d833a7c33`
- Implementation branch head qualified: `7a1ed93a200300e0df85bcd39134188f4950bd6d`
- Exact GitHub PR merge-candidate SHA tested by CI: `97abef20d8ef823499c4aa2d660f22243e1fd131`
- CI workflow: **420Mail Audit Qualification**
- CI run: **37395896238** (run #13)
- CI job: **112051632363** (`mail-audit`) — PASS

This file is an evidence-only follow-up. It changes no executable code, tests, workflows, dependencies, configuration, interfaces, deployment state, or substantive roadmap requirements. The exact qualified implementation remains the SHA above.

## Canonical definition

The repository previously had no `MAIL-2.*` Phase 2 roadmap. This change materialized `docs/420MAIL-PHASE2-ROADMAP.md` without renumbering or replacing the existing `MAIL-AUDIT-*` live-testnet roadmap.

MAIL-2.1 exit criteria require:

- delivered recipient mail starts in Inbox;
- delivered sender mail starts in Sent;
- Inbox, Sent, Outbox, Drafts, Archive, Junk and Trash are defined;
- Archive/Junk/Trash lifecycle transitions are owner-scoped and authorization-safe;
- Trash has a dedicated restore path;
- permanent delete is owner-scoped and Trash-gated;
- read/unread plus starred/pinned/muted mailbox state is supported;
- Drafts/Outbox are reserved for MAIL-2.9/MAIL-2.10 rather than manual delivered-message destinations;
- legacy inbox/read behavior remains compatible;
- no message body moves on-chain.

## Implementation completed

- Added `MailboxFolder` canonical folder constants.
- Added per-owner `MailboxState` with prior folder, read state, starred/pinned/muted flags, lifecycle timestamps, versioning and permanent-delete marker.
- Successful delivery now atomically materializes recipient `INBOX` and sender `SENT` state in the repository store.
- Added folder-aware mailbox listing/pagination.
- Added recipient lifecycle transitions among Inbox/Archive/Junk/Trash.
- Added sender lifecycle transitions among Sent/Archive/Trash.
- Reserved Drafts and Outbox from generic delivered-message moves.
- Added restore-from-Trash semantics with previous-folder restoration.
- Added owner-scoped, Trash-only permanent deletion.
- Added mailbox read/unread semantics while preserving the message-level first-read receipt.
- Added starred, pinned and muted owner-scoped flags.
- Preserved foreign read authorization semantics from the prior qualified baseline.
- Added HTTP lifecycle routes and typed Go client methods.
- Added service profile mailbox declarations.
- Documented Phase 2 semantics and explicit MAIL-2.2 persistence boundary.
- Extended the Mail-specific verifier and CI with race testing.

## Files changed in the implementation candidate

- `.github/workflows/420mail-audit.yml`
- `config/420mail-service-v1.json`
- `docs/420MAIL.md`
- `docs/420MAIL-PHASE2-ROADMAP.md`
- `mail/client/client.go`
- `mail/http.go`
- `mail/http_test.go`
- `mail/service.go`
- `mail/service_test.go`
- `scripts/verify-420mail-audit.py`

## Level 1 qualification

420Mail Audit Qualification run `37395896238`, job `112051632363`:

- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS

Security/adversarial/boundary coverage includes:

- foreign-principal mailbox state denial;
- legacy foreign body-read authorization behavior;
- recipient/sender transition separation;
- reserved Drafts/Outbox rejection;
- Trash restore-only exit;
- Trash-gated permanent deletion;
- owner-scoped deletion that does not remove the counterparty copy;
- read/unread first-read-receipt preservation;
- mailbox flags;
- mailbox pagination;
- HTTP invalid-transition handling;
- existing spoofed-source, Messenger-policy, idempotency and input-bound regressions;
- race detector coverage of the Mail package.

## Diagnosed qualification failures

Two pre-final runs were not treated as passing evidence:

1. formatting gate failed and was fixed; workflow diagnostics were improved without weakening the gate;
2. unit tests exposed a changed foreign-read error and a Trash-bypass transition; both implementation defects were fixed;
3. static verifier then exposed a case-sensitive roadmap token check; that verifier defect was fixed without changing behavior.

Only final run `37395896238` is completion evidence.

## Milestone status

MAIL-2.1 is an ordinary app-scoped step inside the **Mailbox foundation milestone (MAIL-2.1 through MAIL-2.10)**.

**Level 2:** intentionally deferred until the mailbox foundation milestone, unless a later step materially changes a shared dependency and requires earlier retained Mail integration qualification.

**Level 3:** intentionally deferred to the complete app-phase closeout. No repository-wide Solidity inventory, Genesis full inventory, 420 Integrated global qualification, or global Docs closeout was required for this app-only contract-free step.

## Limitations and blockers

- The mailbox state is still backed by the existing in-memory repository store.
- Restart durability, migrations, transactional persistence and multi-instance/distributed idempotency are intentionally not claimed by MAIL-2.1.
- Draft content/autosave behavior is not implemented here; that belongs to MAIL-2.9.
- Outbox queue/retry/failure delivery behavior is not implemented here; that belongs to MAIL-2.10.
- Live Identity/Messenger/Storage/Notifications/testnet qualification remains under MAIL-AUDIT-7+.
- 420Mail remains outside the frozen Genesis application catalog.

These are downstream roadmap obligations, not MAIL-2.1 exit-criterion failures.

## Completion

**MAIL-2.1 — Mailbox State Model: COMPLETE at Level 1.**

Next canonical roadmap step: **MAIL-2.2 — Durable Mail Storage**.
