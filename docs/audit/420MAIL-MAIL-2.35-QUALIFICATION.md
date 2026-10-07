# 420Mail MAIL-2.35 Qualification

## Step
**MAIL-2.35 — Abuse Controls**

## Completion
- Status: **COMPLETE**
- Level 1: **PASS — app-scoped step qualification**
- Level 2: **PASS — Product/security milestone closeout using retained app integration coverage**
- Qualified feature SHA: `52a1983894fb3e5c7cc47d07559078fbf56d18d8`
- Exact tested PR merge-candidate SHA: `3352b1d7bb8afed8193e1c1841ca2d1a443eea7b`
- Tested/current `main` parent: `9bf48f473489a2ad9d0a70f45675c644745ddde8`
- Audit branch: `mail-2-11-email-wallet-onboarding-20261006`
- PR: #537

## Canonical gap resolved
MAIL-2.7 explicitly deferred rate limiting to the dedicated abuse-controls roadmap step. Existing repository state already had owner-scoped reputation, abuse reports, quarantine, phishing protection, and Outbox capacity limits, but native sends had no rolling sender/fan-out ceiling and connector Pull/Webhook item arrays had no hard count bound.

## Implementation

### Native sender throughput
Added repository abuse policy:
- maximum 60 successfully materialized native Mail messages per sender per rolling minute;
- maximum 25 distinct recipients per sender per rolling hour.

The policy derives from durable message metadata, so restart does not reset the enforcement window.

### Replay semantics
Idempotent replay is resolved before abuse accounting. Replaying an already-materialized request returns the canonical prior message and does not consume additional quota.

### Transactional recheck
Abuse policy is checked before private-body storage and again inside the final metadata transaction immediately before commit.

The second check prevents concurrent metadata commits from exceeding the accepted Mail limit.

### Recipient fan-out
The distinct-recipient ceiling applies only when contacting a new recipient inside the rolling hour. Continued legitimate mail to a recipient already contacted during the hour remains allowed unless the per-minute message ceiling is reached.

### HTTP boundary
`ErrAbuseRateLimited` maps to:
- HTTP 429;
- code `RATE_LIMITED`.

### Connector amplification bound
Added `MaxConnectorItems = 500`.

Provider-neutral connector Pull/Webhook result validation now rejects arrays above that bound with `ErrConnectorInvalidResult` before downstream materialization.

### Existing abuse model preserved
The step keeps:
- owner-scoped reputation;
- one abuse report per owner/message;
- spam/phishing classification;
- explicit quarantine release;
- false-positive correction;
- MAIL-2.34 impersonation quarantine;
- no automatic global blacklist.

## Files changed
- `mail/service.go`
- `mail/service_test.go`
- `mail/integrations.go`
- `mail/integrations_test.go`
- `mail/http.go`
- `mail/search_test.go`
- `config/420mail-service-v1.json`
- `docs/420MAIL.md`
- `scripts/verify-420mail-audit.py`

## Adversarial / boundary coverage
Tests verify:
- exact per-minute sender ceiling;
- over-limit rejection;
- idempotent replay remains allowed at the ceiling;
- window expiration restores sending;
- exact distinct-recipient fan-out ceiling;
- a new recipient beyond the fan-out ceiling is rejected;
- an already-contacted recipient remains allowed;
- connector result count above 500 is rejected;
- exactly 500 connector items remain valid;
- existing private search scan-bound test retains its original dataset using a synthetic clock that no longer unintentionally triggers abuse throttling.

## Qualification history

### Run #419 — formatting-only defect
- Run: **37535750345**
- Job: **112516086771**
- Exact head — PASS
- Go format — FAIL
- Later gates — correctly SKIPPED
- Cause: ordinary gofmt drift in newly-added abuse-control tests.

### Run #420 — test harness compile defect
- Run: **37535833467**
- Job: **112516371899**
- Exact head — PASS
- Go format — PASS
- Go test — FAIL
- Cause: missing `fmt` import in new connector-bound test.
- Later gates — correctly SKIPPED.

### Run #421 — import-order formatting defect
- Run: **37535958600**
- Job: **112516788541**
- Exact head — PASS
- Go format — FAIL
- Cause: deterministic gofmt import ordering after adding the missing import.

### Run #422 — pre-existing fixture collision
- Run: **37536081858**
- Job: **112517210412**
- Exact head — PASS
- Go format — PASS
- Go test — FAIL
- Cause: `TestPrivateSearchScanBoundHasContinuation` intentionally created more than 60 messages in one synthetic minute. The test is for search scan continuation, not abuse controls.
- Repair: advance only that fixture's synthetic clock by two seconds per generated message so the same search dataset remains intact without accidentally exercising the new rate policy.

### Run #423 — verifier harness defect
- Run: **37536215660**
- Job: **112517691930**
- Exact head — PASS
- Go format — PASS
- Go test — PASS
- Go race — PASS
- Go vet — PASS
- Static verifier — FAIL
- Cause: `connector_src` was referenced by new MAIL-2.35 assertions before its existing later initialization.
- Repair: move source initialization before the new assertions without weakening any checks.

### Final exact-head qualification
Workflow: **420Mail Audit Qualification**
- Run: **37536414170** (#424)
- Job: **112518420053**
- Qualified feature SHA: `52a1983894fb3e5c7cc47d07559078fbf56d18d8`
- Exact tested PR merge candidate: `3352b1d7bb8afed8193e1c1841ca2d1a443eea7b`
- Tested `main` parent: `9bf48f473489a2ad9d0a70f45675c644745ddde8`
- Exact checkout:
  `HEAD is now at 3352b1d Merge 52a1983894fb3e5c7cc47d07559078fbf56d18d8 into 9bf48f473489a2ad9d0a70f45675c644745ddde8`

Results:
- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS
- verifier output: `MAIL-2.35 abuse controls: qualified by app-scoped checks`

## Level 2 milestone result
MAIL-2.35 is the documented boundary of the **Product/security milestone (MAIL-2.30–MAIL-2.35)**.

Run #424 executes the complete retained Mail package, race suite, vet, and cumulative verifier over the accumulated Product/security work on the exact merge candidate. That same exact-head run therefore supplies the milestone Level 2 integration coverage without a duplicate ceremonial run.

Milestone status: **COMPLETE — Level 2 PASS**.

## Security conclusions
- native sender flood rate is bounded;
- recipient fan-out is bounded;
- replay cannot consume extra quota;
- concurrent metadata commits are rechecked;
- connector result amplification is bounded;
- HTTP exposes a distinct 429 rate-limit result;
- owner-scoped reputation/quarantine semantics remain intact;
- no global automatic sender blacklist was introduced;
- no public indexing or on-chain message-body storage was introduced.

## Level 3
**NOT RUN / NOT DUE.**

MAIL-2.35 closes the Product/security milestone, not the complete Phase 2 app closeout. Repository-wide Solidity, Genesis/address-authority, 420 Integrated/global, Docs/global, Geth/global, deployment/config, and complete phase-closeout qualification remain deferred to the applicable closeout step.

## Blockers
No repository-side blocker remains for MAIL-2.35.

Operational distributed/global throttling, multi-instance shared counters beyond durable Mail state, external provider account-level rate contracts, public-testnet traffic behavior, and production abuse-operations tuning remain later release/security concerns.

## Evidence inheritance
This evidence file and companion roadmap/milestone/PR bookkeeping are documentation-only and inherit qualification from exact tested merge-candidate SHA `3352b1d7bb8afed8193e1c1841ca2d1a443eea7b` without recursive requalification.

## Next canonical step
**MAIL-2.36 — Repository Qualification**
