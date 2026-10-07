# 420Mail MAIL-2.13 Qualification

## Step

**MAIL-2.13 — Wallet Functions Inside Mail — Add non-custodial wallet-aware actions and verification handoffs.**

## Completion

- Status: **COMPLETE**
- Qualification level: **Level 1 — app-scoped step qualification**
- Qualified implementation SHA: `5336ae332699ea3875cfe758ba19064838b770e6`
- Qualified PR merge-candidate SHA: `8c2150519d3638eea48eb651fa3d0da0b28d3608`
- Reconciliation/base `main` SHA: `d86a3810d2901dc1082b65dc9061896c46e1911d`
- Audit branch: `mail-2-11-email-wallet-onboarding-20261006`
- PR: #537

The exact pull-request merge candidate above combined the implementation SHA with the current `main` base and is the authoritative tested state.

## Canonical purpose and authority boundary

MAIL-2.13 adds wallet-aware actions inside 420Mail without transferring Wallet/SmartAccount420 authorization, signing, simulation, submission, nonce, capability/session, or canonical verification authority into Mail.

Mail may:
- construct/validate a bounded unsigned intent;
- hand the intent to canonical Wallet authority;
- display the authority-preserving handoff;
- submit bounded verification evidence to canonical Wallet/RPC/Identity verification authority;
- display the verified result.

Mail may not:
- sign;
- submit transactions/UserOperations;
- accept raw signing secrets;
- choose or bypass canonical nonce/authorization transport;
- treat connection as authorization;
- treat a submission acknowledgement as canonical completion;
- become a protocol contract-address authority.

## Implementation summary

Implemented repository surfaces:

- `mail/wallet_actions.go`
  - bounded `TRANSACTION` and `MESSAGE_SIGNATURE` intent models;
  - canonical `WalletActionAuthority` adapter boundary;
  - strict account/chain/target/value/calldata/digest/explanation/expiry validation;
  - non-custodial and explicit-Wallet-approval result validation;
  - transaction/signature verification handoffs;
  - canonical-result, identity, account, chain and transaction-hash validation;
  - no secret or action persistence.
- `mail/wallet_actions_test.go`
  - transaction/signature intent qualification;
  - malformed/overbroad intent rejection;
  - mutated/custodial authority result rejection;
  - canonical transaction/signature verification;
  - non-canonical result rejection;
  - dependency fail-closed behavior.
- `mail/wallet_actions_http_test.go`
  - authenticated HTTP lifecycle;
  - private-key/seed-field rejection;
  - mutated authority result rejection;
  - transport-only/submission-ack rejection;
  - method/route boundary coverage.
- `mail/http.go`
  - authenticated `POST /v1/wallet/actions`;
  - authenticated `POST /v1/wallet/verifications`.
- `mail/client/client.go`
  - typed `PrepareWalletAction`;
  - typed `VerifyWalletEvidence`.
- `mail/web/index.html`
  - deployment-provided Wallet action/verification adapter;
  - handoff/result presentation;
  - no local signing/submission.
- `config/420mail-service-v1.json`
  - explicit Wallet-only signing/submission/simulation authority;
  - canonical-evidence verification policy;
  - secret/persistence/privacy prohibitions.
- `docs/420MAIL.md`
  - documented wallet-aware action/verification architecture and live boundaries.
- `scripts/verify-420mail-audit.py`
  - retained MAIL-2.13 static qualification and a gofmt-stable authentication injection assertion.

## Original requirement: non-custodial wallet-aware actions — SATISFIED

Two generic, protocol-neutral intent classes are supported:

### TRANSACTION

A transaction intent binds:
- chain ID;
- wallet/Smart Account address;
- exact target;
- unsigned native value;
- exact calldata;
- human-readable explanation;
- explicit expiry.

The canonical authority handoff must preserve those fields exactly and return:
- handoff ID;
- authenticated Mail identity;
- authorization epoch;
- `non_custodial=true`;
- `requires_wallet_approval=true`.

Mail rejects changed chain/account/target/value/calldata/explanation/expiry, custodial results, or handoffs that imply approval is unnecessary.

### MESSAGE_SIGNATURE

A message-signature intent binds:
- chain ID;
- wallet account;
- exact 32-byte payload digest;
- explanation;
- expiry.

Mail does not accept raw private keys, seed phrases, passkey private material or signing secrets.

The signature remains a Wallet authorization action; Mail does not infer protocol-specific authority from the signature before canonical verification.

## Original requirement: verification handoffs — SATISFIED

Verification supports:
- `TRANSACTION`;
- `SIGNATURE`.

Verification evidence is opaque to Mail and delegated to the canonical Wallet/RPC/Identity verification adapter.

Accepted results must:
- match the requested handoff ID and kind;
- belong to the authenticated Mail identity;
- identify a valid wallet account;
- be `verified=true`;
- be `canonical=true`;
- be non-custodial;
- contain a verification timestamp.

Transaction results additionally require:
- nonzero chain ID;
- canonical 32-byte transaction hash.

`finalized` is kept separate from `verified`. A Wallet/provider submission acknowledgement is not accepted as canonical completion.

## Security / adversarial invariants

Qualification covers:

- authentication required for every wallet-action route;
- invalid chain/account/target/value/calldata/digest/expiry rejected before authority invocation;
- unknown private-key and seed-phrase fields rejected by strict JSON;
- authority cannot silently mutate a reviewed intent;
- authority cannot mark the handoff custodial or skip explicit approval;
- foreign identity verification rejected;
- mismatched handoff ID/kind rejected;
- non-canonical/unverified evidence rejected;
- malformed transaction hash/chain result rejected;
- Wallet dependency failure has no local signing/submission fallback;
- Mail metadata store receives no Wallet credentials, action authority or verification evidence;
- no public indexing or on-chain Mail wallet state introduced.

## Level 1 qualification

Workflow: **420Mail Audit Qualification**

- Run: **37495998088** (#209)
- Job: **112380571271**
- Exact tested merge candidate: `8c2150519d3638eea48eb651fa3d0da0b28d3608`
- Branch implementation parent: `5336ae332699ea3875cfe758ba19064838b770e6`
- Base/current `main` parent: `d86a3810d2901dc1082b65dc9061896c46e1911d`

Results:

- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS
- Static verifier explicitly reported: `MAIL-2.13 wallet functions inside mail: qualified by app-scoped checks`

## Superseded qualification attempts

1. Run **37495702137** / job **112379554341** failed only at Go format before tests executed. CI's exact formatter output was applied. That candidate is superseded.
2. Run **37495833381** / job **112380004373** passed format, tests, race and vet but failed the static verifier because its legacy injected-authentication assertion depended on gofmt field spacing (`Authenticate AuthenticateFunc`). Adding the longer `WalletActions` field changed alignment without changing authentication semantics. The verifier was corrected to match the stable `AuthenticateFunc` semantic token. That candidate is superseded.

Neither superseded run is completion evidence.

## Milestone / deferred qualification

MAIL-2.13 is the third step of the documented **Wallet-native identity milestone (MAIL-2.11 through MAIL-2.14)**.

- Level 2: **NOT RUN / NOT DUE**. The retained Wallet-native identity milestone qualification remains due at MAIL-2.14 unless a material shared-dependency change requires it earlier.
- Level 3: **INTENTIONALLY DEFERRED** to the complete app-phase closeout.
- No canonical full Solidity inventory, Genesis duplicate Foundry inventory, 420 Integrated Qualification, Geth qualification, global fault/soak suite or unrelated app qualification was deliberately run for MAIL-2.13.

Automatically triggered unrelated workflows are not claimed as MAIL-2.13 qualification evidence.

## Live/deployment limitations

Repository completion does not claim:

- live 420 Wallet / SmartAccount execution;
- production Wallet simulation/review;
- live signing/submission;
- deployed protocol-specific target discovery;
- production capability/session authorization;
- live RPC receipt/finality verification;
- production signature verification;
- public-testnet transaction evidence.

Those remain production-equivalent testnet/security/operations gates in the existing MAIL-AUDIT path.

## Evidence inheritance

This file and the companion Phase 2 roadmap status update are documentation/evidence-only changes. They change no executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements and therefore inherit qualification from the exact implementation SHA above without recursive requalification.

## Next canonical step

**MAIL-2.14 — External Integrations Framework — Add provider-neutral connector architecture.**
