# 420Mail MAIL-2.3 qualification evidence

Step: **MAIL-2.3 — Labels & Custom Folders**  
Status: **COMPLETE**  
Qualification level: **Level 1 — per-roadmap-step fast qualification**

## Repository identity

- Audit/feature branch: `mail-2-1-mailbox-state-model-20261005`
- Accumulated Phase 2 PR: **#530 — feat(mail): Phase 2 mailbox foundation (MAIL-2.1–2.3)**
- Current reconciliation/base `main` SHA: `ea9994669564d0795e2bcc4a38beea0b01bef274`
- Qualified implementation branch SHA: `13a00fb49e85ef39008bbd3aaa285a6f54a10514`
- Exact GitHub PR merge-candidate SHA tested by CI: `6278f711e62b65f0ec1f25633e25299722c8fb89`
- CI workflow: **420Mail Audit Qualification**
- CI run: **37404433075** (run #49)
- CI job: **112078715874** (`mail-audit`) — PASS

This file and the following roadmap-status closeout are evidence/bookkeeping only. They do not alter executable source, tests, workflows, dependencies, configuration, interfaces, deployment state, or substantive MAIL-2.3 requirements. The exact qualified implementation remains the SHA above.

## Canonical requirement

The canonical Phase 2 roadmap defines MAIL-2.3 exactly as:

> Add user-defined labels, custom organization, bulk assignment, and system labels.

MAIL-2.3 remains an ordinary app-scoped Level 1 step inside the **Mailbox foundation milestone (MAIL-2.1 through MAIL-2.10)**.

## Requirements satisfied

### User-defined labels — PASS

- Added owner-scoped user label definitions with deterministic IDs.
- Names are whitespace-normalized and case-insensitively unique per owner.
- User labels are bounded to 100 per owner and 20 assignments per mailbox copy.
- Cross-owner label assignment is rejected.
- Deleting a user label removes that owner's assignments without deleting messages or counterparty state.

### Custom organization / folders — PASS

- Added owner-scoped custom folders independent of canonical system delivery folders.
- Custom-folder names are normalized and case-insensitively unique per owner.
- System folder names (Inbox, Sent, Outbox, Drafts, Archive, Junk, Trash) are reserved and cannot be shadowed by custom folders.
- Custom folders are bounded to 50 per owner.
- Each mailbox copy may have one custom-folder assignment.
- Deleting a custom folder clears only that owner's assignments.

### Bulk assignment — PASS

- Added transactional bulk organization updates for up to 100 message IDs.
- Bulk updates can add/remove user labels and set/clear a custom folder in one transaction.
- Any missing message, foreign/unknown label, foreign/unknown folder, conflicting add/remove request, or limit violation fails the whole transaction.
- Failed bulk operations do not partially mutate earlier messages.

### System labels — PASS

- Added immutable per-owner system labels: `STARRED`, `PINNED`, `MUTED`, and `UNREAD`.
- System labels cannot be manually assigned or deleted.
- Their message views are functional virtual views derived from owner-scoped mailbox state:
  - STARRED → `MailboxState.Starred`
  - PINNED → `MailboxState.Pinned`
  - MUTED → `MailboxState.Muted`
  - UNREAD → `MailboxState.ReadAt == nil`
- Marking a message read removes it from the UNREAD view; mailbox flag changes immediately affect the corresponding system-label views.

### Durable storage / indexes / migration — PASS

- Durable store schema advanced from v1 to v2.
- Added durable label and custom-folder definitions.
- Added mailbox label/custom-folder assignment persistence.
- Added owner/label and owner/custom-folder secondary indexes.
- Indexes rebuild from canonical mailbox state.
- Existing v1 durable stores migrate to v2 with initialized organization maps/indexes.
- Label/custom-folder assignments survive restart.

### API/client surface — PASS

Added authenticated HTTP and typed-client support for:

- `GET|POST /v1/labels`
- `DELETE /v1/labels/{id}`
- `GET /v1/labels/{id}/messages`
- `GET|POST /v1/custom-folders`
- `DELETE /v1/custom-folders/{id}`
- `GET /v1/custom-folders/{id}/messages`
- `PATCH /v1/messages/{id}/organization`
- `PATCH /v1/organization/bulk`

## Implementation summary

MAIL-2.3 changed or added:

- `mail/organization.go`
- `mail/organization_test.go`
- `mail/service.go`
- `mail/store.go`
- `mail/http.go`
- `mail/http_test.go`
- `mail/client/client.go`
- `config/420mail-service-v1.json`
- `docs/420MAIL.md`
- `scripts/verify-420mail-audit.py`

Previously-qualified MAIL-2.1 and MAIL-2.2 semantics were retained.

## Level 1 qualification

Final authoritative run: **37404433075**, job **112078715874**, against exact PR merge-candidate `6278f711e62b65f0ec1f25633e25299722c8fb89`.

- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS

Security/adversarial/boundary coverage includes:

- cross-owner label assignment rejection;
- owner-scoped listings and definitions;
- immutable system labels;
- case-insensitive duplicate-name rejection;
- system-folder-name reservation;
- atomic bulk rollback on a missing target;
- label/custom-folder deletion cleanup;
- durable restart recovery;
- v1-to-v2 durable migration;
- functional STARRED/PINNED/MUTED/UNREAD system views;
- retained MAIL-2.1 lifecycle/authorization coverage;
- retained MAIL-2.2 durability/distributed-idempotency coverage;
- race-detector coverage.

## Diagnosed non-passing/superseded runs

These runs are not completion evidence:

- Run #43 failed only at the fail-closed Go-format gate. Exact `gofmt` output was applied; tests had correctly been skipped.
- Run #45 passed the implementation as it then existed, but review identified a semantic gap: system labels were definitions only, not functional mailbox views. That candidate was superseded.
- Run #48 failed only at Go formatting after the system-label behavior/test addition; the exact formatter-only spacing change was applied.
- Run #49 is the final authoritative Level 1 qualification.

## Milestone and deferred qualification

**Level 2:** intentionally deferred. MAIL-2.3 is step 3 of the documented **Mailbox foundation milestone**, whose retained app-specific integration qualification occurs at MAIL-2.10 unless a later shared-dependency change requires it sooner.

**Level 3:** intentionally deferred to complete app-phase closeout. MAIL-2.3 changes no Mail-owned Solidity contract, Genesis address authority, chain consensus, frozen-address assignment, or repository-wide shared authority.

No repository-wide Solidity inventory, Genesis full-inventory qualification, Geth qualification, global 420 Integrated suite, or global Docs closeout was required for this app-only step.

## Limitations / downstream blockers

- MAIL-2.3 provides labels/custom folders and organization views; private full-text search belongs to MAIL-2.4.
- Automated label/folder rules belong to MAIL-2.5.
- Spam/reputation classification belongs to MAIL-2.7.
- Full desktop UI management surfaces remain MAIL-2.30/2.31.
- Live Identity/Messenger/Storage/Notifications and public-testnet qualification remain MAIL-AUDIT-7+/MAIL-2.37 obligations.
- 420Mail remains outside the frozen Genesis application catalog.

None of these downstream obligations prevents MAIL-2.3 from satisfying its own canonical Level 1 requirement.

## Completion

**MAIL-2.3 — Labels & Custom Folders: COMPLETE at Level 1.**

Next canonical roadmap step: **MAIL-2.4 — Private Mail Search**.
