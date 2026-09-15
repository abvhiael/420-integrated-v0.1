# 420 Developer Hub — DEVHUB-18 Security & Developer Qualification

## Status

DEVHUB-18 implements an evidence-driven security/developer qualification gate for Developer Hub projects and release candidates, including redacted dashboard views and exact-SHA CI evidence handoff.

The qualification layer is **not** a security audit, certification authority, protocol permission system, Registry, Wallet capability issuer, governance decision, or source of canonical state. It evaluates declared evidence against a versioned profile and returns a bounded developer-release result.

## Qualification results

A report returns one of:

- `PASS` — every required applicable check has explicit PASS evidence;
- `FAIL` — at least one required applicable check explicitly failed;
- `BLOCKED` — no required check failed, but required evidence is missing, blocked, or otherwise not PASS.

Environment-inapplicable checks are `NOT_APPLICABLE` and do not weaken checks that do apply. `qualifiedForDeveloperRelease` is true only for `PASS`.

## Profile

`developer-hub/qualification/profile.v1.json` defines the initial required checks:

1. exact network/chain binding;
2. Developer Hub authority boundaries;
3. absence of raw secret material from tracked evidence;
4. Wallet/signing isolation;
5. noncanonical Indexer provenance;
6. off-chain service-auth isolation;
7. automated test qualification evidence;
8. dependency/release review;
9. production HTTPS/WSS policy for mainnet candidates.

The profile explicitly declares `canonicalAuthority: false` and `securityCertification: false`.

## Evidence

Qualification evidence is bound to one profile, project, chain ID, environment, observation timestamp, and set of check results. Unknown and duplicate checks fail closed. Selected-network chain/environment mismatch fails closed.

Evidence may also carry a redacted `provenance` block for CI handoff. GitHub Actions handoff requires:

- provider `github-actions`;
- repository identity;
- an exact lowercase 40-hex candidate commit SHA;
- successful `420 Developer Hub`, `420Docs Qualification`, and `420 Integrated Qualification` runs;
- every required run bound to the same candidate SHA;
- fresh evidence within the configured age limit.

Evidence from another commit, stale evidence, missing workflows, duplicate workflows, or a non-success conclusion fails closed. CI success is release evidence only; it is never protocol authority.

## Secret handling

Evidence is recursively rejected when it contains raw secret-shaped fields including private keys, mnemonics, seed phrases, bearer tokens, API secrets, passwords, raw secrets, or signing keys. Qualification artifacts may reference redacted evidence or secret-digest processes, but they must never become a storage channel for credential material.

## CLI

`420-qualify view [PROFILE_JSON]` displays both the qualification contract and CI handoff requirements.

`420-qualify check EVIDENCE_JSON [MANIFEST_JSON] [PROFILE_JSON]` evaluates evidence against the selected network. It exits with code `3` for a valid report that is not `PASS`.

`420-qualify handoff EVIDENCE_JSON COMMIT_SHA [MANIFEST_JSON] [PROFILE_JSON]` validates the qualification report plus GitHub Actions provenance against one exact candidate SHA. A valid non-release-ready handoff exits with code `3`; malformed or mismatched evidence fails closed.

## Dashboard

The local dashboard exposes GET-only qualification surfaces:

- `/api/qualification/view`
- `/api/qualification/report`
- `/api/qualification/handoff`

The handoff route returns `BLOCKED` when `DEVHUB_CANDIDATE_SHA` is not configured instead of guessing a candidate. `DEVHUB_QUALIFICATION_EVIDENCE` may select a generated evidence file; the checked-in example remains illustrative evidence rather than current-release proof.

The dashboard never provides qualification upload, signing, secret retrieval, release mutation, capability grant, Registry mutation, governance mutation, or transaction-submission routes.

## Authority boundaries

A qualification PASS means only that the supplied evidence satisfied the selected qualification profile at the recorded time. It does not prove code is vulnerability-free, an external security audit occurred, a contract is canonical, a Wallet capability was granted, governance approved an action, 420Identity issued a credential, a transaction settled, a block finalized, or production launch was approved.

## Security invariants

DEVHUB-INV-158 — Qualification reports declare `canonicalAuthority: false`.

DEVHUB-INV-159 — Qualification reports declare `securityCertification: false`; PASS never claims an audit or vulnerability-free system.

DEVHUB-INV-160 — Qualification evidence is bound to an exact selected chain ID and environment; mismatch fails closed.

DEVHUB-INV-161 — Missing required applicable evidence yields `BLOCKED`, never implicit PASS.

DEVHUB-INV-162 — Any explicit required-check failure yields overall `FAIL`.

DEVHUB-INV-163 — Unknown and duplicate evidence check IDs fail closed.

DEVHUB-INV-164 — Raw private keys, mnemonics, seed phrases, bearer tokens, API secrets, passwords, raw secrets, and signing keys are forbidden in qualification evidence.

DEVHUB-INV-165 — Mainnet qualification requires its production-only transport check; non-production qualification cannot satisfy that gate by implication.

DEVHUB-INV-166 — `qualifiedForDeveloperRelease` is true only when every required applicable check is `PASS`.

DEVHUB-INV-167 — Qualification cannot grant Registry legitimacy, Wallet capability, governance authority, 420Identity credentials, verification authority, or protocol execution rights.

DEVHUB-INV-168 — CI handoff evidence is bound to one exact candidate commit SHA; evidence from another SHA fails closed.

DEVHUB-INV-169 — Required CI workflows must all report explicit success and be bound to the same candidate SHA.

DEVHUB-INV-170 — Stale CI evidence cannot satisfy the release handoff gate.

DEVHUB-INV-171 — Dashboard qualification APIs are read-only and expose no secret, signing, release-mutation, Registry-mutation, governance-mutation, or transaction-submission path.

DEVHUB-INV-172 — A successful CI handoff remains `canonicalAuthority: false` and `securityCertification: false`.

DEVHUB-INV-173 — DEVHUB-19 may consume DEVHUB-18 release evidence but must not reinterpret qualification PASS as production approval.

## Exit gate

DEVHUB-18 is complete when the profile, report engine, secret rejection, hostile-state tests, exact-SHA CI handoff, CLI, redacted dashboard views, documentation, and all Developer Hub/repository qualification workflows are green on the final phase head.

## Next phase

After DEVHUB-18 closes, DEVHUB-19 is the production-launch phase. DEVHUB-19 must consume DEVHUB-18 evidence rather than treating the presence of tooling or CI success as proof of production readiness.
