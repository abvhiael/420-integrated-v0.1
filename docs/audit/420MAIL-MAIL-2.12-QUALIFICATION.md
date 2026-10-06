# 420Mail MAIL-2.12 Qualification

## Step

**MAIL-2.12 — Passkey-First Security — Add passkeys, device enrollment, recovery, session revocation, and security alerts.**

## Completion

- Status: **COMPLETE**
- Qualification level: **Level 1 — app-scoped step qualification**
- Qualified implementation SHA: `cdd59f68061e845091e09d10825728663343047f`
- Qualified PR merge-candidate SHA: `1985cb678098ef81aea879e0824b3a488844cd43`
- Reconciliation/base `main` SHA: `d86a3810d2901dc1082b65dc9061896c46e1911d`
- Audit branch: `mail-2-11-email-wallet-onboarding-20261006`
- PR: #537

The exact pull-request merge candidate above combined the implementation SHA with the current `main` base and is the authoritative tested state.

## Canonical purpose and authority boundary

MAIL-2.12 adds a passkey-first security management surface inside 420Mail while preserving 420 Wallet / SmartAccount420 / 420Identity as the canonical account, signing, passkey, device, recovery, authorization-epoch, session and security-alert authority.

420Mail remains a replaceable communication service. It introduces no Mail-owned signer, recovery mechanism, passkey verifier, session-key registry, device authority or security-alert authority.

## Implementation summary

Implemented repository surfaces:

- `mail/security.go`
  - canonical `SecurityAuthority` adapter boundary;
  - owner-bound `SecurityState`;
  - passkey summaries/enrollment/revocation;
  - device summaries/enrollment/revocation;
  - canonical recovery request actions;
  - session summaries/revocation;
  - security-alert projection/acknowledgement;
  - authorization-epoch and authority-result validation;
  - strict no-fallback dependency behavior.
- `mail/security_test.go`
  - authority delegation;
  - authorization/input validation;
  - all canonical recovery action classes;
  - stale/future epoch failure paths;
  - inactive stale-history acceptance;
  - foreign-identity and dependency-failure rejection.
- `mail/security_http_test.go`
  - authenticated owner boundary;
  - HTTP lifecycle for all security actions;
  - unknown secret-field rejection;
  - invalid authority-state rejection;
  - invalid route/method rejection.
- `mail/http.go`
  - authenticated security routes;
  - strict bounded JSON decode for proof/request material.
- `mail/client/client.go`
  - typed methods for snapshot, passkeys, devices, recovery, sessions and alerts.
- `mail/web/index.html`
  - security projection rendering;
  - passkey/device/session revoke controls;
  - alert acknowledgement;
  - deployment-provided `window.__420_SECURITY__` handoff for passkey/device/recovery ceremonies.
- `config/420mail-service-v1.json`
  - explicit passkey-first security authority, epoch, recovery, persistence and privacy policy.
- `docs/420MAIL.md`
  - documented security architecture and live/deployment boundaries.
- `scripts/verify-420mail-audit.py`
  - retained MAIL-2.12 static qualification.

## Original requirements individually satisfied

### 1. Passkeys — SATISFIED

420Mail exposes passkey enrollment and revocation through the canonical Wallet/Identity authority.

Mail accepts only bounded public attestation/request material and non-secret device metadata. Passkey private material is never accepted as a supported field and is not persisted.

Passkey state is authorization-epoch bound:
- future-epoch bindings are rejected;
- stale-epoch bindings may be shown only when inactive;
- stale bindings marked active are rejected.

### 2. Device enrollment — SATISFIED

420Mail exposes device enrollment and revocation through the canonical security authority.

The device proof remains opaque to Mail. The canonical authority is responsible for possession/binding checks and for invalidating dependent authorization when a device is lost or revoked.

Mail creates no parallel durable device registry.

### 3. Recovery — SATISFIED

MAIL-2.12 supports the canonical SmartAccount420 recovery action classes:

- `SET_AUTHORITY`
- `PROPOSE`
- `CANCEL`
- `FINALIZE`

Mail validates request/address shape and delegates the security transition. It cannot sign, shorten a timelock, override canonical executable time, or locally mark recovery final.

### 4. Session revocation — SATISFIED

The security projection includes Wallet/Identity sessions and provides canonical session revocation.

Sessions are authorization-epoch bound:
- future-epoch sessions are rejected;
- stale sessions may be shown only as inactive history;
- stale sessions marked active are rejected.

A browser disconnect is not promoted to canonical revocation.

### 5. Security alerts — SATISFIED

Owner-scoped security alerts are exposed from the canonical Wallet/Identity authority and may be acknowledged through that authority.

Mail does not persist or publish a second canonical incident ledger, nor expose alerts to public Search/Explorer/on-chain state.

## Security and privacy invariants

- every security route requires the existing authenticated Mail identity;
- returned authority state must match that actor identity;
- passkey/session epochs cannot exceed the canonical authorization epoch;
- active stale-epoch passkeys/sessions fail closed;
- passkey device references must resolve to returned canonical device state;
- malformed or foreign recovery addresses fail closed;
- passkey private material, wallet keys, seed phrases, recovery secrets and session signing secrets are not supported inputs;
- strict JSON rejects unknown secret-bearing fields before authority invocation;
- proof/request material is bounded;
- no security credential/session secret is added to the durable Mail metadata store;
- dependency failure has no insecure local fallback;
- no public indexing or on-chain Mail security state is introduced.

## Level 1 qualification

Workflow: **420Mail Audit Qualification**

- Run: **37493838588** (#197)
- Job: **112373174130**
- Exact tested merge candidate: `1985cb678098ef81aea879e0824b3a488844cd43`
- Branch implementation parent: `cdd59f68061e845091e09d10825728663343047f`
- Base/current `main` parent: `d86a3810d2901dc1082b65dc9061896c46e1911d`

Results:

- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS
- Static verifier explicitly reported: `MAIL-2.12 passkey-first security: qualified by app-scoped checks`

## Superseded qualification attempt

Run **37493721049** / job **112372769074** failed only at Go format before tests executed. CI identified formatting drift in `mail/client/client.go` and `mail/security.go`. The exact formatter output was applied. That run is superseded and is not completion evidence.

## Milestone / deferred qualification

MAIL-2.12 is the second step of the documented **Wallet-native identity milestone (MAIL-2.11 through MAIL-2.14)**.

- Level 2: **NOT RUN / NOT DUE** until MAIL-2.14 unless an earlier material shared-dependency change requires retained integration qualification.
- Level 3: **INTENTIONALLY DEFERRED** to the complete app-phase closeout.
- No canonical full Solidity inventory, 420 Integrated Qualification, Geth qualification, global fault/soak suite or duplicate repository-wide expensive inventory was deliberately run for this ordinary Mail step.

Automatically triggered unrelated repository workflows are not claimed as MAIL-2.12 qualification evidence.

## Live/deployment limitations

Repository completion does not claim:

- production WebAuthn RP/domain configuration;
- real hardware authenticator/device enrollment;
- live Wallet/Identity security-authority deployment;
- public-testnet authorization-epoch behavior;
- live SmartAccount recovery transactions/timelock evidence;
- production session-revocation propagation;
- real security-alert generation/delivery;
- incident response/monitoring operations.

Those remain live testnet/security/operations gates in the existing MAIL-AUDIT path.

## Evidence inheritance

This file and the companion Phase 2 roadmap status update are documentation/evidence-only changes. They do not change executable code, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements and therefore inherit qualification from the exact implementation SHA above without recursive requalification.

## Next canonical step

**MAIL-2.13 — Wallet Functions Inside Mail — Add non-custodial wallet-aware actions and verification handoffs.**
