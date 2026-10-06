# 420Mail MAIL-2.6 qualification evidence

Step: **MAIL-2.6 — Blocklists, Allowlists & Trust Controls**  
Status: **COMPLETE**  
Qualification level: **Level 1 — per-roadmap-step fast qualification**

## Repository identity

- Accumulated Phase 2 PR: **#530 — feat(mail): Phase 2 mailbox foundation (MAIL-2.1–2.6)**
- Audit/feature branch: `mail-2-1-mailbox-state-model-20261005`
- Reconciliation/base `main` SHA: `53f5603520e02a492184a41801de0ad09af59b35`
- Qualified implementation branch SHA: `798d364efb4a12dcbedd20bb9ad6e79059b607fe`
- Exact GitHub PR merge-candidate SHA tested by CI: `04499f9a880dd430d321600285c645132f2f06a5`
- Roadmap bookkeeping SHA: `7163faaad4eb1a72024dc389a3af7457e364ef67`
- CI workflow: **420Mail Audit Qualification**
- Final implementation CI run: **37411373688** (run #107)
- Final implementation CI job: **112100327058** (`mail-audit`) — PASS

The roadmap closeout and this evidence record are bookkeeping/evidence-only changes. They do not alter executable source, tests, workflows, dependencies, configuration, interfaces, deployment state, or substantive MAIL-2.6 requirements. Under the phase qualification policy they inherit the exact implementation qualification above without recursive qualification.

## Canonical definition

The canonical Phase 2 roadmap defines MAIL-2.6 exactly as:

> **MAIL-2.6 — Blocklists, Allowlists & Trust Controls** — Add user-controlled blocked/trusted identities, phrases, applications, and mutes.

MAIL-2.6 remains an ordinary app-scoped Level 1 step inside the **Mailbox foundation milestone (MAIL-2.1 through MAIL-2.10)**.

## Requirements satisfied

### User-controlled trust inventory — PASS

Added durable owner-scoped trust entries with three canonical target kinds:

- `IDENTITY`
- `PHRASE`
- `APPLICATION`

Each entry has one disposition:

- `BLOCK`
- `ALLOW`
- `MUTE`

Entries are normalized case-insensitively, deterministically identified, bounded, and isolated by owner.

### Blocklists — PASS

New logical deliveries are rejected when:

- the recipient explicitly blocks the sender identity;
- the recipient explicitly blocks the source application;
- a blocked phrase matches the subject/body and no trusted identity/application overrides phrase blocking;
- allowlist-only mode is enabled and the delivery is not trusted.

Blocked mail is rejected before private-body storage during normal preflight, so a simple blocked delivery does not create a private blob, mailbox state, or notification.

The trust policy is checked again inside the durable delivery transaction so a concurrent trust-policy change cannot be bypassed between preflight and commit.

### Allowlists / trusted senders — PASS

Owners may trust:

- identities;
- application/source identifiers;
- phrases.

Optional `require_trusted` mode turns those trusted entries into an actual allowlist: unmatched new mail is rejected.

An explicitly trusted sender identity or application may bypass blocked phrase entries. Explicit identity/application blocks retain precedence and cannot be bypassed by trust entries.

Trusted phrase entries can satisfy allowlist-only mode.

### Mutes — PASS

Matching `MUTE` entries:

- keep the delivery;
- set the recipient mailbox copy's `Muted` state;
- suppress the recipient notification.

Trust mute has final precedence over MAIL-2.5 mailbox rules attempting to clear the muted flag on the same incoming copy.

### Idempotency / lifecycle safety — PASS

Trust preflight occurs after sender-scoped idempotency lookup.

Therefore:

- a new send after the recipient blocks the sender is rejected;
- replay of a logical message that was already committed before the later block returns the existing message rather than retroactively failing or reapplying delivery;
- trust enforcement remains rechecked transactionally for new messages.

### Durable storage / migration — PASS

Durable store schema advanced from **v3 to v4**.

The store now persists:

- trust entries;
- trust settings / allowlist-only mode.

Existing v3 durable state migrates to v4 with initialized trust maps/settings. Trust entries/settings survive restart.

Store validation enforces:

- canonical owner/kind/value keys;
- deterministic entry IDs;
- valid kinds/dispositions;
- value size bounds;
- per-owner entry limits;
- trust-settings owner consistency.

### Authenticated API/client surface — PASS

HTTP and typed-client support now includes:

- `GET /v1/trust/entries`
- `PUT /v1/trust/entries`
- `DELETE /v1/trust/entries/{id}`
- `GET /v1/trust/settings`
- `PUT /v1/trust/settings`

Unknown JSON fields fail closed. Foreign deletion returns not-found rather than crossing the owner boundary.

Trust-policy delivery rejection is exposed only as a generic recipient-policy rejection, not the matching private trust entry.

### Privacy / authority boundaries — PASS

- Trust entries/settings remain private off-chain application metadata.
- Phrase evaluation uses the already-authorized private subject/body in the Mail delivery path.
- Trust entries, phrases, decisions, and mute state are not published to public 420Search.
- No Mail-owned smart contract, on-chain trust authority, Genesis address, or frozen application-catalog change was introduced.
- Existing Messenger policy remains an upstream dependency; MAIL-2.6 adds recipient-local Mail policy rather than replacing Messenger authorization.

## Deterministic policy precedence

MAIL-2.6 qualifies the following repository behavior:

1. explicit blocked identity/application rejects the new delivery;
2. explicit allowed identity/application marks the delivery trusted;
3. blocked phrase rejects only when identity/application has not already trusted the delivery;
4. allowed phrase may mark the delivery trusted;
5. matching mute entries suppress notification;
6. `require_trusted` rejects any remaining untrusted delivery.

Phrase matching is case-insensitive and whitespace-normalized so semantically identical phrases do not fail because of casing or repeated whitespace.

## Implementation summary

MAIL-2.6 added or changed:

- `mail/trust.go`
- `mail/trust_test.go`
- `mail/service.go`
- `mail/store.go`
- `mail/http.go`
- `mail/http_test.go`
- `mail/client/client.go`
- `config/420mail-service-v1.json`
- `docs/420MAIL.md`
- `scripts/verify-420mail-audit.py`
- `docs/420MAIL-PHASE2-ROADMAP.md` (bookkeeping-only closeout/next-step update)

Previously qualified MAIL-2.1 through MAIL-2.5 behavior remains covered by the retained Mail test suite.

## Security/adversarial/boundary coverage

Qualification includes coverage for:

- blocked identity rejection;
- blocked application/source rejection;
- blocked phrase matching;
- trusted identity bypass of phrase block;
- explicit application block precedence over trusted identity;
- allowlist-only rejection of untrusted mail;
- trusted application acceptance;
- trusted phrase acceptance;
- whitespace/case-normalized phrase matching;
- mute delivery with notification suppression;
- trust-mute precedence over a rule attempting to unmute;
- blocked delivery not writing private-body storage;
- blocked delivery not materializing inbox state;
- blocked delivery not emitting notification;
- trust-entry update/upsert normalization;
- owner-scoped trust listing;
- foreign trust-entry deletion rejection;
- idempotent replay surviving a later block;
- new sends after a later block being rejected;
- durable restart persistence;
- durable v3 -> v4 migration;
- strict HTTP unknown-field rejection;
- retained MAIL-2.1 mailbox lifecycle tests;
- retained MAIL-2.2 durability/distributed-idempotency tests;
- retained MAIL-2.3 organization/system-label tests;
- retained MAIL-2.4 private-search/privacy tests;
- retained MAIL-2.5 rules-engine tests;
- race-detector coverage.

## Qualification history

Non-passing/superseded runs are not completion evidence:

1. Run #103 failed only at the fail-closed Go-format gate. Tests correctly did not run; exact formatter output was applied.
2. Run #106 passed formatting and reached behavior tests. `TestAllowlistModeAcceptsTrustedApplicationAndPhrase` exposed an implementation defect: stored phrases were whitespace-normalized but incoming subject/body text was not, so `"Approved   Invoice"` failed to match trusted phrase `"approved invoice"`.
3. Phrase evaluation was corrected to normalize whitespace and casing consistently rather than weakening the test.
4. Run #107 is the final authoritative Level 1 implementation qualification.

## Final Level 1 qualification

**420Mail Audit Qualification**  
Run: `37411373688` (#107)  
Job: `112100327058`  
Exact merge candidate: `04499f9a880dd430d321600285c645132f2f06a5`  
Base main: `53f5603520e02a492184a41801de0ad09af59b35`

Results:

- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS

## Milestone / broader qualification status

**Level 2:** intentionally deferred. MAIL-2.6 is step 6 of the documented **Mailbox foundation milestone**. Retained broader Mail integration qualification remains scheduled for MAIL-2.10 unless a later material shared-dependency change requires it sooner.

**Level 3:** intentionally deferred to complete app-phase closeout.

MAIL-2.6 changed no Mail-owned Solidity contract, Genesis address assignment, frozen-address authority, consensus code, or repository-wide shared authority. Full Solidity inventory, Genesis full inventory, Geth qualification, 420 Integrated global qualification, and global Docs closeout were therefore not required for this ordinary app-scoped step.

## Limitations / downstream blockers

- MAIL-2.6 provides explicit user trust policy; automated reputation, abuse classification, quarantine, and phishing detection belong to MAIL-2.7.
- Application trust currently evaluates the Mail message `Source`; ordinary user sends remain restricted to the canonical Mail source until separately qualified signed application-generated mail is introduced.
- Full end-user trust/settings UI belongs to MAIL-2.30/MAIL-2.31.
- Live Identity/Messenger/Storage/Notifications adapters and public-testnet qualification remain downstream MAIL-AUDIT-7+/MAIL-2.37 obligations.
- 420Mail remains outside the frozen Genesis application catalog.

None of these downstream obligations prevents MAIL-2.6 from satisfying its own canonical Level 1 requirement.

## Completion

**MAIL-2.6 — Blocklists, Allowlists & Trust Controls: COMPLETE at Level 1.**

Next canonical roadmap step: **MAIL-2.7 — Spam, Junk & Phishing Protection**.
