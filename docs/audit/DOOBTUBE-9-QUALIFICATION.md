# DoobTube — DOOBTUBE-9 qualification evidence

Roadmap step: **DOOBTUBE-9 — Security, abuse and moderation qualification**
Qualification level: **Level 1 — app-scoped security qualification**
Status: **COMPLETE**
PR: **#553**
Branch: `audit/doobtube-baseline-20261006`

## Implementation summary

DOOBTUBE-9 performs the complete application-specific security, abuse and moderation qualification required after the DOOBTUBE-8 retained Level 2 ecosystem milestone.

The step:

- adds an app-owned abuse/privacy policy package;
- makes authorized mutation throttling actor+operation scoped and concurrency safe;
- preserves exact idempotent replay without consuming a second abuse slot;
- redacts recognized secret/token forms before durable backend job errors are persisted;
- redacts persisted livestream transport exceptions;
- adds secret-like persistence-field rejection helpers;
- adds dedicated security/abuse/privacy tests;
- retains focused 420Media session/moderation/webhook/scanner/rate security qualification;
- records a threat-by-threat disposition for every original DOOBTUBE-9 roadmap category;
- distinguishes closed threats from repository-grounded non-applicable classes;
- reconciles the previously stale audit record to the actual DOOBTUBE-0 through -9 implementation;
- corrects the Level 2 CI policy so the DOOBTUBE-8 retained integration gate is milestone/manual-only rather than rerunning after every ordinary step.

No DoobTube contract, custody, payment, Oracle, Bridge or Arbitration dependency is introduced.

## Files changed

- `doobtube/security/__init__.py`
- `doobtube/security/policy.py`
- `doobtube/tests/test_doobtube_security.py`
- `doobtube/api/service.py`
- `doobtube/media/service.py`
- `docs/DOOBTUBE-SECURITY-ABUSE-MODERATION.md`
- `docs/DOOBTUBE-AUDIT.md`
- `docs/DOOBTUBE-ROADMAP.md`
- `scripts/verify-doobtube-security.py`
- `scripts/verify-doobtube-baseline.py`
- `scripts/verify-doobtube-level2.py`
- `.github/workflows/doobtube-baseline.yml`
- `.github/workflows/doobtube-integration.yml`

## Original threat-category disposition

### Broken access control

**CLOSED.**

Qualified controls include:

- non-empty Wallet authority for application mutations;
- exact chain/network binding;
- explicit capability admission;
- Media expiring-session verification;
- Media actor/body-field cross-checks;
- denial for anonymous, wrong-chain and missing-capability callers.

### Privilege escalation

**CLOSED.**

Qualified controls include:

- distinct DoobTube operator/preference capabilities;
- Media moderator capability and authorizer;
- moderator-action allowlist;
- retained DOOBTUBE-8 canonical-authority substitution rejection.

### Signature / authorization replay

**CLOSED for DoobTube scope.**

- mutation idempotency is actor + operation + key + semantic request hash;
- exact retry returns the stored result;
- changed payload under the same key fails with `IDEMPOTENCY_CONFLICT`;
- exact retry does not consume another abuse-limit slot;
- Media retriable writes retain replay-safe idempotency.

DoobTube accepts no raw signature-verification surface of its own.

### Nonce / domain mistakes

**CLOSED / delegated to canonical Media signing-intent authority.**

Media retains the canonical:

`420/MEDIA/API/SIGNING/V1`

boundary with chain/network/Wallet/action/resource/payload/nonce/expiry checks.

DoobTube creates no second signing domain or nonce namespace.

### Reentrancy / on-chain external-call risk

**NOT APPLICABLE to DoobTube V1.**

Repository evidence confirms:

- no DoobTube Solidity contract;
- no app-owned contract state;
- no app-owned callback;
- no app-owned funds.

External HTTP/provider risk remains applicable and is separately qualified by SSRF, provider, retry, deadline and canonical-state controls.

### Accounting / custody / refund errors

**NOT APPLICABLE to canonical V1.**

DoobTube has no:

- balance ledger;
- escrow;
- paid subscription;
- PPV;
- payout;
- tip flow;
- refund ledger;
- direct Pay client.

420Pay remains Media-transitive.

### Front-running / MEV

**NOT APPLICABLE to current V1 app logic.**

No DoobTube auction, swap, settlement, orderbook or value-ordering contract/action exists.

### Stale Oracle / Bridge risk

**NOT ADOPTED / NOT APPLICABLE.**

Neither Oracle nor Bridge is a DoobTube V1 dependency.

Adopted stale-state risks remain fail-closed through Registry, Media, Rights, Storage, Search and provider evidence checks.

### Content-rights abuse

**CLOSED.**

Public eligibility requires current Rights authorization and no revocation.

A dedicated DOOBTUBE-9 regression proves a READY+PUBLIC projection cannot bypass revoked Rights state.

Moderation cannot rewrite canonical Rights/provenance.

### Moderation abuse

**CLOSED at repository app scope.**

420Media retains:

- report actor binding;
- actor-keyed report limiter;
- scoped moderator capability;
- moderator authorizer;
- allowed moderation actions;
- report/decision/appeal audit trail;
- appeal history preservation.

Moderation cannot move funds, sign Wallet actions, rewrite Rights or invoke Arbitration automatically.

### Spam / Sybil behavior

**CLOSED to application-authority scope.**

Pseudonymity remains allowed and is not misrepresented as one-person-one-account.

Sensitive DoobTube operations are actor+operation bounded.

A concurrency regression proves the limiter cannot race beyond the configured bound.

Additional Wallets cannot manufacture moderator, Rights, Storage, Search, Pay, Smart Account or protocol authority.

### Malicious uploads

**CLOSED at repository layer by retained DOOBTUBE-6 controls.**

Retained coverage includes:

- video-only metadata;
- upload byte bound;
- digest validation;
- mandatory scanner;
- quarantine/reject fail-closed;
- SSRF denial;
- static processing profiles;
- no requester shell command;
- runtime/memory/CPU/PID bounds;
- provider/result verification;
- output-readiness separation.

### Rate / resource exhaustion

**CLOSED at repository application layer.**

DoobTube now has actor+operation abuse windows for:

- preferences;
- operator rebuild;
- operator metrics.

The limiter is concurrency-safe.

Existing retained bounds include:

- page/cursor size;
- durable job retry/backoff;
- upload size;
- processing resources;
- livestream duration/reconnect;
- Media API request/response/pagination bounds.

Distributed edge/network rate-limit proof remains live deployment evidence, not repository production readiness.

### Webhook replay

**No DoobTube webhook receiver exists in V1.**

Therefore no unsigned DoobTube callback surface exists.

The focused Media dependency suite qualifies its HMAC-SHA256/key/timestamp/event-ID replay verifier.

Any future DoobTube webhook receiver must adopt equivalent signed replay protection before enablement.

### Operator / provider compromise

**CLOSED at repository authority boundary.**

Retained controls include:

- active + verified provider;
- provider/operator identity binding;
- evidence freshness;
- result/job/profile binding;
- deadline checks;
- canonical controller revalidation;
- bounded reconnect;
- canonical-state recovery;
- Registry/authority substitution rejection.

Live credential rotation/suspension/runbook execution remains deployment evidence.

### Secrets / logging / privacy leakage

**CLOSED at repository app scope.**

Controls include:

- no private-key/mnemonic/seed custody;
- secret-like persistence-field rejection helper;
- durable exception redaction for Bearer tokens;
- redaction of `secret://`, `vault://`, `keyring://` references;
- URL username/password redaction;
- token/key/secret/password/signature query-value redaction;
- 500-character durable error bound;
- browser authority-sensitive state remains memory-only;
- PRIVATE/UNLISTED state remains excluded from public projections.

## New application security controls

### Actor/operation abuse limiter

Default repository policy:

- `preferences.write`: 30 / 60 seconds;
- `control.rebuild`: 5 / 60 seconds;
- `operator.metrics`: 120 / 60 seconds.

The limiter:

- rejects empty actors;
- rejects unconfigured sensitive operations;
- resets only after the configured window;
- uses a process-local lock;
- cannot be raced past its configured count in the retained concurrency test.

### Replay-safe limiter placement

The abuse check is executed only inside the first-execution idempotent effect.

Therefore:

- first mutation consumes one abuse slot;
- exact retry returns durable prior response;
- exact retry consumes no second abuse slot;
- changed request/new key remains a new abuse event.

### Durable error redaction

DoobTube backend durable job errors and persisted livestream transport errors pass through `redact_sensitive_text` before storage.

## Security test coverage

New DOOBTUBE-9 security suite:

**9 tests PASS**

Coverage:

- broken access control;
- privilege escalation / wrong capability;
- wrong-chain authority;
- abuse-limit exhaustion/reset;
- exact replay + abuse-limit interaction;
- rebuild spam;
- concurrency race resistance;
- token/secret/credential/query redaction;
- secret-like persistence-field rejection;
- durable job-error redaction;
- Rights revocation/publication negative path.

## Focused Media security dependency qualification

The exact-head workflow runs:

`go test ./media/security ./media/api`

Result:

- `media/security` — PASS
- `media/api` — PASS

This retains the directly applicable upstream protections DoobTube relies on:

- expiring session chain/network/capability checks;
- actor substitution rejection;
- report rate limiting;
- moderator authorization;
- moderation audit trail;
- webhook signature/expiry/replay protection;
- scanner/quarantine behavior;
- SSRF/rate policy;
- secure Media API composition.

## Exact-head Level 1 qualification

Qualified implementation SHA:

`8ff27ec22495e8e63ba56a59c7cab889ddff4bc5`

Workflow: **DoobTube baseline audit**

Run: **37572375344**

Job: **baseline / 112633646802**

Result: **PASS**

Exact-head steps passed:

- checkout;
- exact implementation SHA assertion;
- Python setup;
- Node 22 setup;
- Go 1.23 setup from `go.mod`;
- DoobTube package compilation;
- protocol adapter suite — 11 tests PASS;
- backend/control-plane suite — 16 tests PASS;
- media integration/adversarial suite — 13 tests PASS;
- security/abuse/privacy suite — 9 tests PASS;
- focused Media security dependency tests PASS;
- static web structural/security check PASS;
- browser/service fixtures — 7 PASS / 0 fail;
- deterministic static web build PASS;
- dedicated DOOBTUBE-9 security verifier PASS;
- cumulative DOOBTUBE-0 through DOOBTUBE-9 baseline verifier PASS.

No required DOOBTUBE-9 check was skipped, cancelled, missing, stale or silently substituted.

## CI policy correction

DOOBTUBE-8 remains the documented Level 2 milestone and retains its exact previously-qualified implementation evidence.

GitHub pull-request path filters evaluate the full PR diff, which caused the Level 2 workflow to continue firing on later ordinary DoobTube commits even after trigger narrowing.

To restore the canonical qualification policy, `.github/workflows/doobtube-integration.yml` is now:

- retained in-repository;
- available through `workflow_dispatch`;
- no longer automatically invoked for ordinary post-milestone steps.

The Level 2 verifier was also corrected so later audit progress (DOOBTUBE-9 and beyond) does not invalidate the already-completed DOOBTUBE-8 milestone merely because the audit no longer ends at “through DOOBTUBE-8.”

No new Level 2 qualification is required for DOOBTUBE-9.

## Audit reconciliation

The original audit document still contained historical baseline statements such as:

- no DoobTube runtime;
- no tests;
- no frontend/backend;
- security qualification unknown.

Those claims were correct at the original audited main SHA but contradictory after DOOBTUBE-0 through -9 implementation.

`docs/DOOBTUBE-AUDIT.md` is now reconciled into a current-state audit while preserving the original audit base and historical finding.

Current readiness remains intentionally conservative:

- CODE COMPLETE: NO — final repository-phase declaration reserved for DOOBTUBE-11;
- BUILD COMPLETE: NO — exact Level 3 build/deployment/config closeout remains;
- CONTRACT COMPLETE: YES for current V1 scope;
- TEST COMPLETE: NO — Level 3 remains;
- DOCUMENTATION COMPLETE: NO — DOOBTUBE-10 remains;
- INTEGRATION COMPLETE: YES for repository Level 2 scope;
- SECURITY QUALIFIED: YES for current app repository scope;
- TESTNET READY: NO;
- GENESIS READY: NO;
- PRODUCTION READY: NO.

## Repository base

Current `main` / qualification base:

`f674fbed767efc126da253c66800e38d030dc1dd`

The audit branch was **0 commits behind current main** at exact-head qualification.

PR #553 remained open and mergeable.

## Level 2 status

**No new Level 2 run is required for DOOBTUBE-9.**

DOOBTUBE-8 remains the documented and completed retained app integration milestone.

DOOBTUBE-9 introduces app-scoped security controls and directly applicable focused dependency qualification; it does not introduce a new major shared authority/lifecycle dependency that would create another Level 2 milestone.

## Intentionally deferred Level 3 qualification

DOOBTUBE-9 is not the repository phase closeout.

Deferred until **DOOBTUBE-11 — Repository Level 3 exact-head closeout**:

- canonical full repository Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- Docs/global reconciliation;
- complete retained app suites on the final merge candidate;
- affected clients/services/Indexer/Search/RPC/frontend/backend qualification;
- final security/adversarial/invariant/static analysis;
- deployment/config/build/lint/type verification;
- final roadmap/audit/frozen-address/deployment reconciliation.

These checks are intentionally not duplicated here.

## Residual live/deployment requirements

The following remain later operational evidence, not unresolved repository vulnerabilities:

- distributed edge/network rate limiting;
- production secret manager/credential rotation;
- live media scanner behavior;
- egress network policy;
- production codec/container sandbox;
- production TLS/origin/domain;
- live provider/storage/CDN behavior;
- monitoring/alerting;
- backup/restore;
- public-testnet abuse/load/restart/recovery evidence.

They remain DOOBTUBE-10/12/13 work and must not be interpreted as completed production readiness.

## Unresolved vulnerabilities

**None identified within the DOOBTUBE-9 repository application scope.**

No application-authority security risk acceptance is required to close this step.

## Completion state

**DOOBTUBE-9: COMPLETE — Level 1 qualified.**

## Evidence SHA rule

This file is a durable **evidence-only** commit written after exact implementation qualification.

It changes no executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements.

The qualified implementation SHA remains authoritative without recursive qualification.

## Next canonical roadmap step

**DOOBTUBE-10 — Documentation, deployment and operator closeout**
