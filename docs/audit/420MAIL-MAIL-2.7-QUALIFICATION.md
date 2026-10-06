# 420Mail MAIL-2.7 qualification evidence

Step: **MAIL-2.7 — Spam, Junk & Phishing Protection**  
Status: **COMPLETE**  
Qualification level: **Level 1 — per-roadmap-step fast qualification**

## Repository identity

- Accumulated Phase 2 PR: **#530 — feat(mail): Phase 2 mailbox foundation (MAIL-2.1–2.7)**
- Audit/feature branch: `mail-2-1-mailbox-state-model-20261005`
- Reconciliation/base `main` SHA: `f32a9c322e085634e47f20b84861338811198454`
- Current-main reconciliation merge commit before final qualification: `f2f29f1e728761da62998dc4e2752a778a650913`
- Qualified implementation branch SHA: `4d6dd23f568f5bc722741a178c7d99de9e1effc2`
- Exact GitHub PR merge-candidate SHA tested by CI: `5171606d8662c5e3020ec5ce21c43b3c932067fe`
- Roadmap bookkeeping SHA: `d78a9bc94d4f221b78e74e05cce71004ef9fedae`
- CI workflow: **420Mail Audit Qualification**
- Final implementation CI run: **37414723417** (run #118)
- Final implementation CI job: **112110710324** (`mail-audit`) — PASS

The roadmap closeout and this evidence record are bookkeeping/evidence-only changes. They do not alter executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state, or substantive MAIL-2.7 requirements. Under the phase qualification policy they inherit the exact implementation qualification above without recursive Level 1 qualification.

## Canonical definition

The canonical Phase 2 roadmap defines MAIL-2.7 exactly as:

> **MAIL-2.7 — Spam, Junk & Phishing Protection** — Add reputation, abuse, quarantine, and phishing defenses.

MAIL-2.7 is an ordinary app-scoped Level 1 step inside the documented **Mailbox foundation milestone (MAIL-2.1 through MAIL-2.10)**.

The shared Genesis service threat model also makes SPAM and MESSAGING_ABUSE applicable to Mail. Relevant baseline controls include duplicate/fingerprint detection, reputation-sensitive handling, abuse reporting/audit state, identity provenance, block/mute controls and protection against malicious/impersonating message content.

MAIL-2.7 does not silently absorb later dedicated roadmap ownership:
- production network/device rate limiting and broader abuse operations remain MAIL-2.35;
- the later dedicated phishing/impersonation product hardening step remains MAIL-2.34;
- attachment scanning remains deployment/integration work if attachments are introduced.

## Pre-step gap analysis

Before MAIL-2.7:
- Junk existed only as a mailbox folder/state;
- MAIL-2.6 could block/allow/mute explicit identities, phrases and applications;
- there was no durable sender-risk reputation;
- there was no abuse-report record;
- there was no automatic spam quarantine;
- there was no duplicate-content spam signal;
- there was no phishing-link/lure classifier;
- there was no quarantine review/release lifecycle;
- there was no protection-specific API/client surface;
- there was no v5 persistence for protection state.

## Requirements satisfied

### Reputation — PASS

420Mail now maintains **owner-scoped sender reputation**.

The model records:
- deliveries;
- quarantines;
- spam reports;
- phishing reports;
- false-positive releases;
- an effective bounded risk score.

Spam reports add one risk point; phishing reports add two; an explicit false-positive release subtracts one effective point, bounded at zero.

Reputation is recipient/owner scoped. One user's abuse judgment does not become public protocol identity authority or silently alter another user's sender reputation.

### Abuse reporting — PASS

Recipients may report a delivered message as:
- `SPAM`;
- `PHISHING`.

One canonical abuse report exists per owner/message.

Same-class replay is idempotent and returns the existing report without double-counting reputation. Reusing the same owner/message report with a different classification fails closed with `ErrAbuseReportConflict`.

Only the recipient mailbox owner may report recipient-side abuse; the sender cannot report their own Sent copy as recipient abuse.

Reporting a message:
- records durable audit state;
- updates owner-scoped sender reputation;
- creates/updates quarantine evidence;
- moves an ordinary recipient copy to Junk and mutes it;
- does **not** resurrect a message already in Trash.

### Duplicate/fingerprint spam defense — PASS

Accepted deliveries record a normalized SHA-256-derived content fingerprint of subject/body.

Only the fingerprint/count is stored in Mail metadata; private body plaintext remains in the private blob provider.

The fourth repeated normalized content delivery from a sender becomes a spam signal.

Explicitly trusted identity/application entries from MAIL-2.6 bypass reputation and duplicate-content spam signals, preserving the user's explicit trust preference.

### Phishing defense — PASS

Deterministic repository-level phishing signals include:
- URL user-info tricks such as `trusted.example@evil.example`;
- IP-literal links;
- punycode hostnames;
- insecure `http://` links;
- credential/wallet/urgency lure phrases when a link is present.

Phishing signals accumulate to a bounded policy threshold. At or above the threshold, the incoming recipient copy is quarantined.

A trusted sender/application **does not bypass phishing detection**. This prevents explicit trust from disabling phishing quarantine if a trusted identity/application is later compromised.

Ordinary HTTPS links do not trigger the classifier merely for existing. Credential/recovery phrases without a link also do not independently trigger the phishing threshold in the repository baseline.

The current thin UI continues to render private message bodies using DOM `textContent`, not injected HTML, preventing repository-baseline message content from becoming executable/clickable HTML.

### Quarantine — PASS

Automatic spam/phishing quarantine is applied atomically in the delivery transaction.

A quarantined recipient copy:
- is forced to `JUNK`;
- receives a durable quarantine record with reason codes and scores;
- is muted;
- suppresses the recipient notification.

MAIL-2.5 rules execute before the final protection override, so a mailbox rule cannot move an automatically quarantined message back out of Junk.

MAIL-2.6 trust mute remains compatible with quarantine mute.

Generic mailbox movement cannot move an active quarantined message to Inbox/Archive; `ErrQuarantineReview` requires the explicit review/release path. Moving a quarantined message to Trash remains allowed.

Explicit release:
- restores a Junk quarantine to Inbox;
- clears the quarantine mute;
- records a false-positive reputation credit;
- marks the quarantine record `RELEASED` rather than deleting audit history.

### Notification behavior — PASS

Automatically quarantined delivery suppresses the normal recipient notification.

Trusted safe mail continues to notify normally.

Reporting already-delivered mail cannot retroactively retract a notification already sent; this is explicitly distinct from automatic delivery-time quarantine.

### Idempotency / transaction safety — PASS

MAIL-2.6 sender-scoped idempotency remains authoritative.

A replay of an already committed logical send returns the existing message before spam/phishing delivery processing can create a second quarantine or duplicate fingerprint count.

Protection classification and protection metadata are committed inside the same durable delivery transaction as message/mailbox metadata.

### Durable storage / migration — PASS

Durable store schema advanced from **v4 to v5**.

Schema v5 persists:
- owner-scoped sender reputation;
- abuse reports;
- quarantine records;
- duplicate-content fingerprint counts.

The v4 -> v5 migration initializes all protection maps.

Restart qualification proves quarantine and reputation survive durable-service restart.

Store validation covers protection record ownership/keys, deterministic abuse-report IDs, valid abuse classes, quarantine status/reason bounds, message references, fingerprint count bounds and reputation risk consistency.

Private message body plaintext is not written into the durable Mail metadata file.

### Authenticated API/client surface — PASS

HTTP and typed client support now includes:
- `POST /v1/messages/{id}/abuse`;
- `GET /v1/quarantine`;
- `POST /v1/quarantine/{id}/release`;
- `GET /v1/reputation/{sender}`.

HTTP decoding rejects unknown JSON fields.

Authorization tests cover recipient-only abuse reporting.

### Privacy / authority — PASS

MAIL-2.7:
- introduces no Mail-owned smart contract;
- introduces no token/economic/wallet signing authority;
- introduces no public reputation score;
- publishes no protection state to public 420Search;
- stores no message body plaintext in reputation/quarantine metadata;
- preserves canonical Identity/Messenger/Storage/Notifications authority boundaries;
- preserves the frozen Genesis catalog state.

## Implementation summary

MAIL-2.7 introduced or materially changed:

- `mail/spam.go`
- `mail/spam_test.go`
- `mail/service.go`
- `mail/store.go`
- `mail/http.go`
- `mail/http_test.go`
- `mail/client/client.go`
- `config/420mail-service-v1.json`
- `docs/420MAIL.md`
- `scripts/verify-420mail-audit.py`
- `docs/420MAIL-PHASE2-ROADMAP.md` — closeout bookkeeping only after implementation qualification.

Current-main reconciliation intentionally preserved the exact 420Mail artwork/web deployment fix already merged through PR #534 rather than restoring the older branch website asset.

## Security / adversarial / boundary coverage

MAIL-2.7 qualification includes tests for:
- automatic phishing quarantine;
- phishing notification suppression;
- quarantine reason/score evidence;
- trusted sender bypass of duplicate/reputation spam signals;
- trusted sender **not** bypassing phishing quarantine;
- fourth duplicate-content quarantine;
- early duplicates remaining Inbox;
- owner-scoped abuse reputation;
- idempotent same-class abuse report;
- conflicting abuse reclassification rejection;
- sender/foreign abuse-report rejection;
- reputation-driven future quarantine;
- generic mailbox move unable to bypass quarantine;
- explicit quarantine release;
- false-positive risk reduction;
- released quarantine removal from active list;
- reporting trashed mail without resurrection;
- ordinary HTTPS non-trigger boundary;
- URL-userinfo phishing detection;
- credential phrase without URL non-trigger boundary;
- durable v4 -> v5 migration;
- durable quarantine/reputation restart recovery;
- no private body plaintext in durable spam-protection metadata;
- strict HTTP unknown-field rejection;
- retained MAIL-2.1 through MAIL-2.6 regression suites;
- race-detector coverage.

## Qualification history

Non-passing/superseded runs are not completion evidence.

1. **Run #112 / 37414480810 / job 112109943027** — failed at the fail-closed Go-format gate. Behavioral/static checks correctly did not run.
2. Formatter output was applied exactly. Review during that correction also found a genuine v5 persistence defect: load/write paths referenced the new protection maps but the on-disk struct had not declared the corresponding JSON fields. The durable schema definition was corrected rather than weakening validation.
3. **Run #116 / 37414646402 / job 112110467639** — again stopped only at remaining formatter alignment; behavioral/static checks correctly remained skipped.
4. The exact remaining formatter diff was applied.
5. **Run #118 / 37414723417 / job 112110710324** — final authoritative implementation qualification: PASS.

## Final Level 1 qualification

Workflow: **420Mail Audit Qualification**  
Run: `37414723417` (#118)  
Job: `112110710324`  
Qualified branch implementation: `4d6dd23f568f5bc722741a178c7d99de9e1effc2`  
Exact PR merge candidate: `5171606d8662c5e3020ec5ce21c43b3c932067fe`  
Reconciliation base: `f32a9c322e085634e47f20b84861338811198454`

CI checkout explicitly recorded:

`HEAD is now at 5171606 Merge 4d6dd23f568f5bc722741a178c7d99de9e1effc2 into f32a9c322e085634e47f20b84861338811198454`

Results:
- exact head — PASS;
- Go format — PASS;
- `go test ./mail/...` — PASS;
- `go test -race ./mail/...` — PASS;
- `go vet ./mail/...` — PASS;
- `python3 scripts/verify-420mail-audit.py` — PASS.

## Level 2 status

**Intentionally deferred.**

MAIL-2.7 is step 7 of the documented **Mailbox foundation milestone**. The retained broader Mail integration suite remains scheduled for **MAIL-2.10** unless a later shared-dependency change requires it sooner.

## Intentionally deferred Level 3 checks

Level 3 remains deferred to complete app-phase closeout.

MAIL-2.7 changes no Solidity contract, Genesis/frozen address, consensus code, token settlement authority, Indexer public authority or shared on-chain protocol.

Accordingly, repository-wide full Foundry inventory, Genesis full inventory, Geth qualification, 420 Integrated global qualification and global Docs closeout were not repeated for this ordinary app-scoped step.

## Limitations / downstream work

MAIL-2.7 is a deterministic repository protection baseline, not a claim of production anti-abuse operations.

Still downstream:
- production identity/device/network rate limiting and progressive throttling — MAIL-2.35 / deployment operations;
- broader phishing/impersonation UX and provenance protection — MAIL-2.34;
- attachment scanning/metadata policy if attachments are introduced;
- live moderation queues/operator workflows/appeals;
- live provider reputation inputs;
- production observability/alerting;
- public-testnet integration and live abuse/load validation.

None of those later obligations blocks MAIL-2.7 from satisfying its own canonical Level 1 requirement.

## Completion

**MAIL-2.7 — Spam, Junk & Phishing Protection: COMPLETE at Level 1.**

Next canonical roadmap step: **MAIL-2.8 — Threads & Conversations**.
