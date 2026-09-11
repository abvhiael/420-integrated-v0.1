# 420 Developer Hub — DEVHUB-18 Security & Developer Qualification

## Status

DEVHUB-18 foundation implements an evidence-driven security/developer qualification gate for Developer Hub projects and release candidates.

The qualification layer is **not** a security audit, certification authority, protocol permission system, Registry, Wallet capability issuer, governance decision, or source of canonical state. It evaluates declared evidence against a versioned profile and returns a bounded developer-release result.

## Qualification results

A report returns one of:

- `PASS` — every required applicable check has explicit PASS evidence;
- `FAIL` — at least one required applicable check explicitly failed;
- `BLOCKED` — no required check failed, but required evidence is missing, blocked, or otherwise not PASS.

Environment-inapplicable checks are `NOT_APPLICABLE` and do not weaken checks that do apply.

`qualifiedForDeveloperRelease` is true only for `PASS`.

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

The profile explicitly declares:

- `canonicalAuthority: false`;
- `securityCertification: false`.

## Evidence

Qualification evidence is bound to:

- one `profileId`;
- one developer `projectId`;
- one exact chain ID;
- one environment;
- one observation timestamp;
- a set of check IDs, statuses, evidence sources, and optional redacted evidence metadata.

Unknown and duplicate checks fail closed. Selected-network chain/environment mismatch fails closed.

## Secret handling

Evidence is recursively rejected when it contains raw secret-shaped fields including private keys, mnemonics, seed phrases, bearer tokens, API secrets, passwords, raw secrets, or signing keys.

Qualification artifacts may reference redacted evidence or secret-digest processes, but they must never become a storage channel for credential material.

## CLI

`420-qualify view [PROFILE_JSON]` displays the qualification contract and required checks.

`420-qualify check EVIDENCE_JSON [MANIFEST_JSON] [PROFILE_JSON]` evaluates evidence against the selected network. It exits with code `3` for a valid report that is not `PASS`, separating a failed/blocked release gate from malformed-input/runtime errors.

## Authority boundaries

A qualification PASS means only that the supplied evidence satisfied the selected qualification profile at the recorded time. It does not prove that:

- code is vulnerability-free;
- an external security audit occurred;
- a contract is canonical or Registry-approved;
- a Wallet capability was granted;
- governance approved an action;
- 420Identity issued a credential;
- a transaction settled or a block finalized;
- production launch has been approved.

Those claims remain with their canonical or specialist authorities.

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

## Current exit gate

The foundation slice is complete when the profile, evidence validator/report generator, hostile-state tests, example evidence, CLI, and documentation qualify in CI.

The remaining DEVHUB-18 integration slice will expose the same redacted qualification contract in the dashboard and tighten CI/release evidence handoff without creating a second qualification authority.

## Next phase

After DEVHUB-18 closes, DEVHUB-19 is the production-launch phase. DEVHUB-19 must consume DEVHUB-18 evidence rather than treating the presence of tooling as proof of production readiness.
