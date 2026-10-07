# 420Mail MAIL-2.11 Qualification

## Step

**MAIL-2.11 — Email-as-a-Wallet Onboarding**

Canonical requirement: add Google, Apple, passkey, and existing-wallet onboarding without custodial signing authority.

## Completion

- Status: **COMPLETE**
- Qualification level: **Level 1 — app-scoped step qualification**
- Qualified implementation SHA: `d33e30ca841516401c6091a6c122bfd96322986a`
- Qualified PR merge-candidate SHA: `00a61d00abc1a3243158ebc7f4ece66a79334af6`
- Reconciliation/base `main` SHA: `d86a3810d2901dc1082b65dc9061896c46e1911d`
- Audit branch: `mail-2-11-email-wallet-onboarding-20261006`
- PR: #537

The implementation SHA was qualified through the GitHub pull-request merge candidate that combined it with the exact current `main` base above.

## Implementation

MAIL-2.11 adds a non-custodial Mail onboarding orchestration boundary while preserving Wallet/420Identity as the canonical authentication, wallet-binding, signing, replay-protection, and session authority.

Implemented repository surfaces:

- `mail/onboarding.go` — Google, Apple, passkey, and existing-wallet onboarding request/result models plus injected `OnboardingAuthority`.
- `mail/onboarding_test.go` — method delegation, malformed input, custodial/invalid result, dependency failure, and normalization tests.
- `mail/onboarding_http_test.go` — public pre-session routes, strict JSON, secret-field rejection, failure mapping, and authentication-boundary tests.
- `mail/http.go` — public pre-session `POST /v1/onboarding/{google,apple,passkey,wallet}` routes.
- `mail/client/client.go` — typed client methods for all four onboarding paths.
- `mail/web/index.html` — thin onboarding UI that delegates ceremonies through `window.__420_ONBOARDING__` and retains the returned session in memory only.
- `config/420mail-service-v1.json` — canonical onboarding policy and Wallet dependency.
- `docs/420MAIL.md` — onboarding architecture/security/deployment boundary.
- `scripts/verify-420mail-audit.py` — retained static qualification for MAIL-2.11.

No Mail-owned contract, signer, key store, seed/recovery store, WebAuthn verifier, OAuth verifier, or parallel identity authority was introduced.

## Requirements individually satisfied

1. **Google onboarding** — public pre-session Mail handoff exists and delegates token verification, subject/provider validation, identity/wallet binding, replay controls, and session issuance to the injected canonical Wallet/Identity authority.
2. **Apple onboarding** — same authority-preserving handoff and validation boundary.
3. **Passkey onboarding** — Mail accepts only an opaque assertion envelope for delegation; passkey private material remains outside Mail.
4. **Existing-wallet onboarding** — Mail accepts a bounded EVM address/challenge/signature handoff; canonical authority verifies ownership/freshness/signature.
5. **No custodial signing authority** — accepted authority results must explicitly be non-custodial; Mail accepts no private-key, seed-phrase, recovery-secret, or passkey-private-material fields.
6. **Canonical identity and wallet binding** — accepted results require non-empty identity, valid EVM wallet address, session token, exact onboarding method, and future expiry.
7. **Fail closed** — malformed, oversized, unknown-field, dependency-failed, custodial, method-mismatched, expired, unbound, or incomplete results are rejected.
8. **No credential persistence/publication** — provider proofs, assertions, challenges, signatures, and session tokens are not added to the durable Mail store, public 420Search, or on-chain state.
9. **Client/UI integration** — typed Go client and thin browser entry surfaces cover all four onboarding methods without moving the security ceremony into Mail.

## Level 1 qualification

Workflow: **420Mail Audit Qualification**

- Run: **37424499126** (#184)
- Job: **112140973502**
- Exact tested merge candidate: `00a61d00abc1a3243158ebc7f4ece66a79334af6`
- Branch implementation parent: `d33e30ca841516401c6091a6c122bfd96322986a`
- Base/current `main` parent: `d86a3810d2901dc1082b65dc9061896c46e1911d`

Results:

- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS
- Static verifier explicitly reported: `MAIL-2.11 email-as-a-wallet onboarding: qualified by app-scoped checks`

## Superseded attempts

- Run **37424059556** / job **112139608617** failed only at Go format on the initial implementation candidate. The exact formatter output was applied before further qualification.
- Run **37424377014** / job **112140593636** passed format, tests, race, and vet but failed the static verifier because the verifier searched for a gofmt-sensitive single-space struct-field literal. The implementation was correct; the verifier assertion was repaired to use the stable semantic token. That run is superseded.

Neither superseded run is completion evidence.

## Security/adversarial results

Repository qualification covers:

- malformed/truncated/oversized onboarding request rejection;
- strict unknown-field rejection, including attempted private-key/seed-phrase fields;
- invalid EVM wallet address rejection before authority invocation;
- canonical authority dependency failure with no insecure fallback;
- custodial authority result rejection;
- identity/wallet/session/method/expiry binding validation;
- normalized result handling;
- pre-session onboarding route isolation from ordinary authenticated Mail APIs;
- no durable credential/session persistence introduced.

## Milestone and broader qualification

MAIL-2.11 is the first step of the documented **Wallet-native identity milestone (MAIL-2.11 through MAIL-2.14)**.

- Level 2: **NOT RUN / NOT DUE**. Retained Wallet-native identity milestone qualification remains due after MAIL-2.14 unless a material shared-dependency change requires it earlier.
- Level 3: **INTENTIONALLY DEFERRED** to the complete app-phase closeout.
- No repository-wide Solidity inventory, 420 Integrated Qualification, global fault/soak qualification, or duplicated broad suite was deliberately run for MAIL-2.11.

Unrelated workflows automatically triggered by PR activity are not claimed as MAIL-2.11 qualification evidence.

## Live/deployment limitations

MAIL-2.11 repository completion does **not** claim live Google/Apple provider credentials, production WebAuthn RP binding, a deployed Wallet/Identity onboarding/session authority, live provider replay behavior, or public-testnet onboarding. Real Wallet/420Identity authentication and identity resolution remain part of the production-equivalent live MAIL-AUDIT qualification gates.

## Evidence inheritance

This evidence file and the companion roadmap status update are documentation/evidence-only changes. They change no executable source, tests, workflow, dependency, configuration, generated/runtime artifact, interface, deployment state, or substantive requirement, so they inherit qualification from the implementation SHA above without recursive requalification.

## Next canonical step

**MAIL-2.12 — Passkey-First Security — Add passkeys, device enrollment, recovery, session revocation, and security alerts.**
