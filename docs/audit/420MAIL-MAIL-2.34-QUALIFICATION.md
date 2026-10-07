# 420Mail MAIL-2.34 Qualification

## Step
**MAIL-2.34 — Phishing & Impersonation Protection**

## Completion
- Status: **COMPLETE**
- Level 1: **PASS — app-scoped step qualification**
- Level 2: **PASS — retained app integration revalidation for shared phishing/external-import protection changes**
- Product/security milestone: **IN PROGRESS; not closed**
- Qualified feature SHA: `3f8ab21de2099cf8abd92dfc5fd2423297b9d122`
- Exact tested PR merge-candidate SHA: `e64f5185e9019b0390206975c7b4b7f92e743249`
- Tested/current `main` parent: `87f18a9809fe4f80040bfaa42c52e2509166d97f`
- Audit branch: `mail-2-11-email-wallet-onboarding-20261006`
- PR: #537

## Canonical gap resolved
MAIL-2.7 already supplied generic phishing URL/urgency heuristics and quarantine behavior, but repository inspection showed no dedicated impersonation model. Native 420Mail sender identity is already authority-bound, while Discord and Telegram imports retain immutable provider IDs alongside mutable external usernames/display metadata. MAIL-2.34 therefore hardens those presentation and URL surfaces without weakening canonical sender authority.

## Implementation

### Protected external display-name claims
Added provider-aware impersonation scoring for Discord and Telegram external usernames.

Protected normalized identities:
- `420integrated`
- `420mail`
- `420wallet`
- `420identity`
- `420support`
- `420security`
- `420admin`

An external username that normalizes to a protected identity:
- reaches the phishing quarantine threshold;
- records `EXTERNAL_PROTECTED_IDENTITY_CLAIM`;
- is routed to Junk;
- is muted;
- suppresses notification;
- still requires explicit recipient release.

### Unicode confusable handling
Added an impersonation skeleton that maps common Latin-lookalike Cyrillic/Greek characters before protected-identity comparison.

A confusable protected claim records `CONFUSABLE_PROTECTED_IDENTITY_CLAIM`.

Ordinary external usernames remain unaffected.

Native `420/service/mail/v1` sender authority is not subjected to external display-name heuristics.

### Ecosystem-domain lookalikes
Extended phishing URL inspection with protected ecosystem-domain lookalike detection.

Allowed:
- `420integrated.org`
- true subdomains of `420integrated.org`

A different host whose normalized/confusable skeleton uses protected ecosystem identity material contributes the full phishing quarantine threshold and records:
- `LOOKALIKE_ECOSYSTEM_DOMAIN`

Existing URL-userinfo, IP-literal, punycode, insecure-HTTP, and credential/urgency lure signals remain intact.

### MAIL-2.33 invariant preservation
While touching provider import paths, repository inspection found Discord/Telegram sync still called the blob provider directly.

Both paths now use `putPrivateVerified`, preserving MAIL-2.33 digest verification for external message materialization.

## Files changed
Implementation/qualification work touched:
- `mail/spam.go`
- `mail/spam_test.go`
- `mail/discord_sync.go`
- `mail/discord_sync_test.go`
- `mail/telegram_sync.go`
- `mail/telegram_sync_test.go`
- `config/420mail-service-v1.json`
- `docs/420MAIL.md`
- `scripts/verify-420mail-audit.py`

## Negative/adversarial coverage
Tests prove:
- a protected ecosystem lookalike domain is quarantined;
- canonical `420integrated.org` is not falsely flagged;
- canonical subdomains are not falsely flagged;
- Discord protected-name impersonation is quarantined;
- Telegram Unicode-confusable protected-name impersonation is quarantined;
- ordinary external usernames do not over-trigger;
- native canonical sender paths are not treated as external impersonation;
- external-import quarantine evidence is durable through the existing quarantine model;
- MAIL-2.33 verified private-blob writes remain used on Discord/Telegram materialization.

## Qualification history

### Initial formatting-only failure
Workflow: **420Mail Audit Qualification**
- Run: **37534635627** (#416)
- Job: **112512354949**
- Exact head — PASS
- Go format — FAIL
- later required gates — correctly SKIPPED

Diagnosis: ordinary gofmt drift existed only in the newly-added protection tests.

Formatting repair SHA:
`3f8ab21de2099cf8abd92dfc5fd2423297b9d122`

No implementation behavior or assertions were weakened.

### Final exact-head qualification
Workflow: **420Mail Audit Qualification**
- Run: **37534818748** (#417)
- Job: **112512968821**
- Exact checkout:
  `HEAD is now at e64f518 Merge 3f8ab21de2099cf8abd92dfc5fd2423297b9d122 into 87f18a9809fe4f80040bfaa42c52e2509166d97f`

Results:
- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS
- verifier output: `MAIL-2.34 phishing and impersonation protection: qualified by app-scoped checks`

## Level 2 shared-dependency revalidation
MAIL-2.34 changes the shared phishing-protection engine plus Discord and Telegram inbound materialization.

Run #417 already executes the complete retained Mail package, race suite, vet, and cumulative verifier on the exact merge candidate. It therefore also supplies the required app-level shared-dependency revalidation.

A duplicate identical run was not created solely to relabel the same coverage.

This **does not** close the Product/security milestone, which remains defined through MAIL-2.35.

## Security conclusions
- native sender identity authority remains canonical;
- external provider display metadata cannot claim protected ecosystem identities without quarantine;
- common Unicode confusables do not bypass protected-name matching;
- protected ecosystem lookalike domains are quarantined;
- official 420Integrated domain/subdomains are preserved;
- trust state does not bypass impersonation protection;
- quarantine remains owner-scoped and explicitly reviewable;
- external-import private body writes retain MAIL-2.33 integrity verification;
- no provider credential storage, new wallet authority, public indexing, or on-chain message content is introduced.

## Level 3
**NOT RUN / NOT DUE.**

Repository-wide Solidity, Genesis/address-authority, 420 Integrated/global, Docs/global, Geth/global, and complete app-phase closeout qualification remain deferred.

## Blockers
No repository-side blocker remains for MAIL-2.34.

Production anti-phishing feeds, operational protected-name governance, provider-side verified-badge semantics, live moderation response, public-testnet evidence, and production operations remain later release/security concerns.

## Evidence inheritance
This evidence file and roadmap/PR bookkeeping are documentation-only and inherit qualification from exact tested merge-candidate SHA `e64f5185e9019b0390206975c7b4b7f92e743249` without recursive requalification.

## Next canonical step
**MAIL-2.35 — Abuse Controls**
