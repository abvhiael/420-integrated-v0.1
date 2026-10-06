# 420Mail MAIL-2.4 qualification evidence

Step: **MAIL-2.4 — Private Mail Search**  
Status: **COMPLETE**  
Qualification level: **Level 1 — per-roadmap-step fast qualification**

## Repository identity

- Accumulated Phase 2 PR: **#530 — feat(mail): Phase 2 mailbox foundation (MAIL-2.1–2.4)**
- Audit/feature branch: `mail-2-1-mailbox-state-model-20261005`
- Current reconciliation/base `main` SHA: `53f5603520e02a492184a41801de0ad09af59b35`
- Qualified implementation branch SHA: `ed8a87de9b211804c4bbcbee2c620861ee046918`
- Evidence/bookkeeping roadmap SHA qualified against current main: `06fcb9ccb5527dc59399ae89e4770c0c1979ab31`
- Exact GitHub PR merge-candidate SHA tested against current main: `3831c6a10d49c6b92c214933edaf6bf72104219c`
- CI workflow: **420Mail Audit Qualification**
- Final current-main CI run: **37408860945** (run #68)
- Final current-main CI job: **112092511954** (`mail-audit`) — PASS

This evidence file is evidence-only. It changes no executable source, tests, workflows, dependencies, configuration, interfaces, deployment state, or substantive roadmap requirements, so it does not invalidate the exact qualified implementation/merge-candidate SHAs above.

## Canonical definition

The canonical Phase 2 roadmap defines MAIL-2.4 exactly as:

> **MAIL-2.4 — Private Mail Search** — Add private mailbox search without exposing private content to public 420Search.

MAIL-2.4 is an ordinary app-scoped Level 1 step inside the **Mailbox foundation milestone (MAIL-2.1 through MAIL-2.10)**.

## Requirements satisfied

### Private owner-scoped search — PASS

- Added authenticated `POST /v1/search`.
- Search operates only on mailbox copies whose `MailboxState.Owner` equals the authenticated actor.
- Permanently deleted mailbox copies are excluded.
- No public unauthenticated list/search endpoint was introduced.
- Unknown/foreign label and custom-folder identifiers fail closed.

### Searchable private fields — PASS

Search covers:

- sender;
- recipient;
- subject;
- source service;
- canonical system folder;
- assigned user-label names;
- assigned custom-folder names;
- private message body text through on-demand `PrivateBlobStore.GetPrivate`.

Body plaintext is not copied into the durable metadata store, configuration, public index, or search result payload.

### Search filters — PASS

The private search request supports:

- system folder;
- label;
- custom folder;
- sender;
- recipient;
- source;
- unread/read state;
- starred state;
- created-after bound;
- created-before bound;
- opaque continuation cursor;
- bounded page size.

### Privacy / public 420Search boundary — PASS

- `config/420mail-service-v1.json` explicitly records `publicIndexing:false`.
- `public420SearchIntegration:false`.
- Body search is declared as `ON_DEMAND_PRIVATE_BLOB`.
- No 420Search publication or public search index was added.
- Search results return mailbox/message metadata only; body plaintext remains available only through the already-authorized private body path.

### Resource bounds and complete continuation — PASS

- Search query length is bounded to 256 bytes.
- Result page size remains capped at 100.
- Each request scans at most 500 owner-visible mailbox candidates.
- The scan bound does **not** truncate the searchable mailbox: an opaque continuation cursor advances across candidate windows.
- A regression test creates more than one scan window and proves an older matching message remains discoverable on the continuation request.

### Typed client / HTTP API — PASS

- Added `Client.SearchMailbox`.
- Added `POST /v1/search`.
- HTTP request bodies are size bounded and reject unknown JSON fields.
- Existing injected authentication remains mandatory.

## Implementation summary

MAIL-2.4 added or changed:

- `mail/search.go`
- `mail/search_test.go`
- `mail/http.go`
- `mail/http_test.go`
- `mail/client/client.go`
- `config/420mail-service-v1.json`
- `docs/420MAIL.md`
- `scripts/verify-420mail-audit.py`
- `docs/420MAIL-PHASE2-ROADMAP.md` (bookkeeping-only completion/next-step update)

Current-main website assets were also content-reconciled onto the accumulated branch so PR #530 cannot regress the deployed 420Mail branding; those assets do not change MAIL-2.4 protocol semantics.

## Security/adversarial/boundary coverage

Tests and verifier coverage include:

- foreign actor receives no private mailbox search results;
- sender can search only the sender-owned Sent copy;
- private body text can be found without public indexing;
- metadata search works independently of body search;
- owner-label/custom-folder filters work;
- cross-owner/unknown organization identifiers fail closed;
- permanently deleted owner copy is not searchable;
- invalid folder is rejected;
- oversized query is rejected;
- invalid time range is rejected;
- result pagination works;
- bounded scan continuation reaches matches beyond the first 500 candidates;
- HTTP method and input validation;
- all retained MAIL-2.1 mailbox lifecycle tests;
- all retained MAIL-2.2 durability/distributed-idempotency tests;
- all retained MAIL-2.3 organization/system-label tests;
- race-detector coverage of `./mail/...`.

## Qualification history

Non-passing/superseded candidates were diagnosed and are not completion evidence:

1. Run #60 failed only at the fail-closed Go-format gate; tests correctly did not run. Exact formatter changes were committed.
2. Run #62 reached compilation and exposed an unused custom-folder binding in `mail/search.go`; that implementation defect was fixed.
3. Run #63 passed, but review found that the 500-candidate safety limit truncated the searchable mailbox rather than providing continuation. That green candidate was intentionally superseded.
4. The search scan was changed to a bounded **per-request** window with opaque candidate continuation, and a >500-message regression test was added.
5. Run #67 passed the hardened implementation against then-current `main`.
6. `main` advanced by one unrelated Compute-only commit modifying only `scripts/verify-cmp-3-14-closeout.py`. A fresh PR merge candidate was established rather than relying on stale-base evidence.
7. Final run #68 qualified the exact current-main merge candidate `3831c6a10d49c6b92c214933edaf6bf72104219c`.

## Final Level 1 qualification

**420Mail Audit Qualification**  
Run: `37408860945` (#68)  
Job: `112092511954`  
Exact merge candidate: `3831c6a10d49c6b92c214933edaf6bf72104219c`  
Base main: `53f5603520e02a492184a41801de0ad09af59b35`

Results:

- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS

## Milestone / broader qualification status

**Level 2:** intentionally deferred. MAIL-2.4 is step 4 of the documented **Mailbox foundation milestone**, whose retained app-specific integration qualification occurs at MAIL-2.10 unless a later material shared-dependency change requires it sooner.

**Level 3:** intentionally deferred to complete app-phase closeout.

No Mail-owned Solidity contract, Genesis address authority, frozen-address assignment, consensus code, or repository-wide shared authority changed in MAIL-2.4. Therefore full Solidity inventory, Genesis full inventory, Geth qualification, 420 Integrated global qualification, and global Docs closeout were not required for this ordinary app-scoped step.

## Limitations / downstream blockers

- MAIL-2.4 is a private mailbox search service/API foundation; the full desktop search UI belongs to MAIL-2.30.
- Automated sender/content/source routing rules belong to MAIL-2.5.
- Spam/reputation classification belongs to MAIL-2.7.
- Search currently performs on-demand private body reads rather than maintaining a separate encrypted full-text index; this preserves the explicit no-public-index boundary.
- Live Identity/Messenger/Storage/Notifications adapters and public-testnet qualification remain MAIL-AUDIT-7+/MAIL-2.37 obligations.
- 420Mail remains outside the frozen Genesis application catalog.

None of these downstream obligations prevents MAIL-2.4 from satisfying its own canonical Level 1 requirement.

## Completion

**MAIL-2.4 — Private Mail Search: COMPLETE at Level 1.**

Next canonical roadmap step: **MAIL-2.5 — User Filters & Rules Engine**.
