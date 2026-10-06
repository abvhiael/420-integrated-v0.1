# 420Mail MAIL-2.5 qualification evidence

Step: **MAIL-2.5 — User Filters & Rules Engine**  
Status: **COMPLETE**  
Qualification level: **Level 1 — per-roadmap-step fast qualification**

## Repository identity

- Accumulated Phase 2 PR: **#530 — feat(mail): Phase 2 mailbox foundation (MAIL-2.1–2.5)**
- Audit/feature branch: `mail-2-1-mailbox-state-model-20261005`
- Reconciliation/base `main` SHA: `53f5603520e02a492184a41801de0ad09af59b35`
- Qualified implementation branch SHA: `06a881abe1075a27e6ae31c940326205820e8ba3`
- Exact GitHub PR merge-candidate SHA tested by CI: `69725c08e6e27af9adef60883fd68f33dc6c21d3`
- Roadmap bookkeeping SHA: `539f220f5e002722b3f98d378345fad0b7208043`
- CI workflow: **420Mail Audit Qualification**
- Final implementation CI run: **37410122999** (run #88)
- Final implementation CI job: **112096461977** (`mail-audit`) — PASS

The roadmap closeout and this evidence record are bookkeeping/evidence-only changes. They do not alter executable source, tests, workflows, dependencies, configuration, interfaces, deployment state, or substantive MAIL-2.5 requirements. Under the phase qualification policy they inherit the exact implementation qualification above without recursive qualification.

## Canonical definition

The canonical Phase 2 roadmap defines MAIL-2.5 exactly as:

> **MAIL-2.5 — User Filters & Rules Engine** — Add sender/content/source conditions and automated mailbox actions.

MAIL-2.5 remains an ordinary app-scoped Level 1 step inside the **Mailbox foundation milestone (MAIL-2.1 through MAIL-2.10)**.

## Requirements satisfied

### Sender/content/source conditions — PASS

Rules support the three canonical condition classes:

- `sender_equals`
- `content_contains`
- `source_equals`

When a rule supplies more than one condition, they are ANDed. Content matching is case-insensitive and evaluates subject plus the already-authorized private body available during delivery. The body is not copied into rule storage or public search.

### Automated mailbox actions — PASS

Matching rules may automatically:

- move the recipient mailbox copy to Inbox, Archive, Junk, or Trash;
- add owner-scoped user labels;
- assign or clear an owner-scoped custom folder;
- mark the owner copy read/unread;
- set starred;
- set pinned;
- set muted;
- stop processing lower-priority rules.

Rules cannot move delivered mail into Sent, Drafts, or Outbox and cannot target another owner's labels or custom folders.

Automated `mark_read` updates only the owner mailbox view. It does not fabricate the shared/message-level human read receipt.

### Deterministic rule evaluation — PASS

- Rules are ordered by ascending priority.
- Creation time/ID provides deterministic tie-breaking.
- Disabled rules are skipped.
- Matching rules compose in order unless `stop_processing` is set.
- Recipient rules affect only the recipient mailbox copy; sender Sent state remains independent.

### Atomic delivery integration — PASS

Rule evaluation occurs inside the same transactional store update that materializes the delivered recipient mailbox state.

A valid delivery therefore cannot commit an unfiltered recipient state and then separately fail to apply the rule actions. Rule action validation and owner-target checks fail closed.

Idempotent resend returns the existing logical message before delivery/rule application, so the same send cannot reapply actions or increment mailbox state repeatedly.

### Durable rules — PASS

Durable store schema advanced from v2 to v3.

The durable state now includes owner-scoped rule definitions and migration initializes the rule map for existing v2 stores. Rules survive restart and execute after restart.

### Rule CRUD and isolation — PASS

Authenticated service/HTTP/client surfaces support:

- `GET /v1/rules`
- `POST /v1/rules`
- `PUT /v1/rules/{id}`
- `DELETE /v1/rules/{id}`

Rule names are normalized and case-insensitively unique per owner. Foreign update/delete attempts return not-found rather than crossing the owner boundary.

Returned/created rule structures deep-copy pointer-valued action state. Mutating a caller-owned rule response or list response cannot mutate `MemoryStore` state outside a transaction.

### Bounds and organization consistency — PASS

- maximum 100 user rules per owner;
- maximum rule name length 80 bytes;
- sender/content/source match strings bounded to 256 bytes;
- maximum 20 rule-added labels;
- existing per-message label bound remains enforced after composed rule actions;
- only owner-scoped, non-system labels may be automatically added;
- custom-folder targets must belong to the owner;
- deleting a label/custom folder cleans dependent rule targets;
- a dependent rule is removed if target cleanup would leave it with no mailbox action.

### Privacy / authority — PASS

- rules remain off-chain application metadata;
- private content is evaluated only in the Mail service delivery path;
- rules and match results are not published to public 420Search;
- no Mail-owned smart contract or Genesis authority was introduced;
- existing Identity/Messenger/Storage/Notifications authority boundaries remain unchanged.

## Implementation summary

MAIL-2.5 added or changed:

- `mail/rules.go`
- `mail/rules_test.go`
- `mail/service.go`
- `mail/store.go`
- `mail/organization.go`
- `mail/http.go`
- `mail/http_test.go`
- `mail/client/client.go`
- `config/420mail-service-v1.json`
- `docs/420MAIL.md`
- `scripts/verify-420mail-audit.py`
- `docs/420MAIL-PHASE2-ROADMAP.md` (bookkeeping-only closeout/next-step update)

Previously qualified MAIL-2.1 through MAIL-2.4 behavior remains covered by the retained Mail test suite.

## Security/adversarial/boundary coverage

Qualification includes coverage for:

- sender condition matching;
- body/subject content condition matching;
- source condition matching;
- multi-condition AND semantics;
- deterministic priority and stop-processing behavior;
- disabled-rule behavior;
- recipient-only mutation;
- sender Sent-copy non-interference;
- foreign-label rejection;
- forbidden system-folder target rejection;
- empty-condition rejection;
- empty-action rejection;
- oversized content-condition rejection;
- case-insensitive duplicate rule-name rejection;
- foreign rule update/delete rejection;
- label/custom-folder target cleanup;
- durable restart persistence/execution;
- durable v2 -> v3 migration;
- idempotent resend not reapplying rule actions;
- automated mark-read not emitting a false human read receipt;
- caller/list response mutation not mutating stored rule state;
- strict JSON unknown-field rejection through authenticated HTTP handling;
- retained MAIL-2.1 mailbox lifecycle tests;
- retained MAIL-2.2 durability/distributed-idempotency tests;
- retained MAIL-2.3 organization/system-label tests;
- retained MAIL-2.4 private-search/privacy tests;
- race-detector coverage.

## Qualification history

Non-passing/superseded runs are not completion evidence:

1. Run #81 failed at the fail-closed Go-format gate. Tests correctly did not run; exact formatter output was applied.
2. Run #85 passed formatting and reached tests. The only failure was a test-harness authentication defect in the unknown-field HTTP test: it used `Authorization` instead of the suite's `X-Test-Actor` authentication header. The harness was corrected; protocol behavior was not weakened.
3. Run #86 passed after the harness correction.
4. Final review added an explicit regression proving caller-visible pointer values cannot mutate stored rule state.
5. Run #87 stopped only on the formatter spacing introduced by that new test; the exact formatter-only change was applied.
6. Run #88 is the final authoritative Level 1 implementation qualification.

## Final Level 1 qualification

**420Mail Audit Qualification**  
Run: `37410122999` (#88)  
Job: `112096461977`  
Exact merge candidate: `69725c08e6e27af9adef60883fd68f33dc6c21d3`  
Base main: `53f5603520e02a492184a41801de0ad09af59b35`

Results:

- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS

## Milestone / broader qualification status

**Level 2:** intentionally deferred. MAIL-2.5 is step 5 of the documented **Mailbox foundation milestone**. Retained broader Mail integration qualification remains scheduled for MAIL-2.10 unless a later shared-dependency change requires it sooner.

**Level 3:** intentionally deferred to the complete app-phase closeout.

MAIL-2.5 changed no Mail-owned Solidity contract, Genesis address assignment, frozen-address authority, consensus code, or repository-wide shared authority. Full Solidity inventory, Genesis full inventory, Geth qualification, 420 Integrated global qualification, and global Docs closeout were therefore not required for this ordinary app-scoped step.

## Limitations / downstream blockers

- MAIL-2.5 is a rules engine, not the explicit blocked/trusted identity/phrase/application policy layer; that belongs to MAIL-2.6.
- Spam/reputation/quarantine/phishing classification belongs to MAIL-2.7.
- Integration-specific filters belong to MAIL-2.28.
- Full end-user rules/settings UI belongs to MAIL-2.30/MAIL-2.31.
- Live Identity/Messenger/Storage/Notifications adapters and public-testnet qualification remain downstream MAIL-AUDIT-7+/MAIL-2.37 obligations.
- 420Mail remains outside the frozen Genesis application catalog.

None of these downstream obligations prevents MAIL-2.5 from satisfying its own canonical Level 1 requirement.

## Completion

**MAIL-2.5 — User Filters & Rules Engine: COMPLETE at Level 1.**

Next canonical roadmap step: **MAIL-2.6 — Blocklists, Allowlists & Trust Controls**.
