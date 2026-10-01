# 420Identity complete repository audit — 2026-09-30

## Scope and authority

Application: **420Identity**

Repository: `abvhiael/420-integrated-v0.1`

Audit baseline: `main` at `df8f639d8f43b763298c8750ef49d3e5849c597c`

Repository truth, frozen interface/address records, canonical architecture, committed tests and retained qualification evidence control this audit. Conversational history is non-authoritative.

The source audit prompt contained stray references to 420Registry and 420Names. They are treated as copy/paste defects; 420Identity is the audit subject.

## Canonical definition

420Identity is an optional pseudonymous profile and credential protocol/application anchored by `Identity420`. Canonical responsibilities are:

- profile creation, metadata commitment, active state and controller lifecycle;
- optional primary .420 name pointer, with strong Names binding requiring bilateral agreement;
- governance-curated issuer registry and trust classes;
- credential issuance, expiry, revocation and subject rejection;
- dynamic validity based on credential, issuer and subject-profile state;
- public/indexed projection without converting derived views into authority.

Explicit non-authorities include automatic legal identity, wallet ownership, universal reputation/trust, custody, ambient dApp authorization, governance authority or finality.

## Architecture discovered

### Canonical contract

`contracts/src/apps/Identity420.sol` is the canonical domain-state contract.

It stores:

- `Profile`: controller, pending controller, metadata hash, primary name, timestamps, active flag;
- `Issuer`: controller, metadata hash, trust class, active flag;
- `Credential`: issuer, subject profile, type, claim hash, issued/expiry/revocation timestamps, subject rejection.

The contract uses immutable `governanceTimelock` authority through `SystemAccess`. It has no hidden owner and no direct asset custody.

### Derived/integration surfaces

Repository consumers include:

- Names420 bilateral presentation binding;
- 420Indexer protocol events/state views;
- 420Search public Identity resolver;
- Wallet runtime configuration/deployment inventory;
- Travel and other application adapters that explicitly treat Identity as a trust dependency;
- documentation/reference generation.

## Critical finding — frozen interface contradiction

The frozen Genesis interface layer requires `IIdentityCredential420`.

That interface exposes:

- `credential(bytes32) -> CredentialView`
- `hasValidCredential(bytes32 subjectId, bytes32 credentialType) -> bool`
- `Types420.IdentityAssurance`

The canonical `Identity420` implementation does **not** implement that interface. Instead it exposes:

- public `credentials(bytes32)` mapping getter with a different tuple;
- `credentialValid(bytes32 credentialId)`;
- `credentialMeetsTrust(bytes32 credentialId, TrustClass minimumTrust)`;
- `TrustClass`, which is not the frozen `IdentityAssurance` model.

The frozen interface also asks for subject/type lookup semantics that the current contract cannot answer efficiently or unambiguously because credentials are indexed only by credential ID and multiple issuers/credentials may exist for the same subject/type.

**Status: BROKEN / release-blocking.**

This must be resolved by an explicit API/state-model compatibility decision. Do not silently mutate the frozen interface or invent subject/type precedence.

## File inventory

| Component | Current state | Status | Notes |
|---|---|---|---|
| `contracts/src/apps/Identity420.sol` | present | COMPLETE | canonical contract exists |
| `contracts/src/system/SystemAccess.sol` | present | COMPLETE | immutable governance authority |
| `contracts/src/interfaces/genesis/IIdentityCredential420.sol` | present | BROKEN | does not match/fit canonical contract |
| `contracts/config/interfaces/genesis-interface-layer.json` | present/frozen | COMPLETE | explicitly includes Identity credential interface |
| `contracts/config/interfaces/dependency-matrix.json` | present | STALE/PARTIAL | declares broad shared dependencies not implemented by Identity420 |
| `contracts/test/RegistryIdentityNames420.t.sol` | present | PARTIAL | basic Identity lifecycle/trust/Names integration only |
| dedicated Identity adversarial suite | absent at baseline | MISSING | required remediation |
| `contracts/artifacts/Identity420.json` | absent | MISSING | predeploy plan points to missing artifact |
| `contracts/config/predeploy/Identity420-predeploy-state.json` | absent | MISSING | no retained materialized predeploy state |
| predeploy plan entry | `SOURCE_READY` | PARTIAL | not artifact-ready |
| system/frozen address | `0x...0436` | COMPLETE | repository authority reconciled to frozen Step 6.2 map |
| deployment verification | none | BLOCKED | no live code/hash witness |
| Identity app docs | present | PARTIAL | architecture/user/dev/security/troubleshooting exist |
| operator guide | absent at baseline | MISSING | added during audit remediation |
| Wallet runtime binding | config support exists | PARTIAL | address frozen but not live-chain verified |
| Wallet Identity user workflow | not established | MISSING/PARTIAL | no audited complete profile/credential management journey found |
| Indexer projection | present | PARTIAL | event/state support exists; live testnet qualification pending |
| Search public resolver | present | PARTIAL | public profile projection exists; depends on qualified Indexer |

## Smart-contract audit

### Verified behavior

The implementation directly enforces:

- nonzero unique profile IDs;
- controller-only profile updates;
- two-step controller transfer;
- nonzero issuer IDs/controllers;
- governance-only issuer configuration;
- active issuer and issuer-controller checks for issuance;
- subject profile existence before issuance;
- expiry must be zero or future;
- immutable credential ID uniqueness;
- issuer-controller or governance revocation;
- subject-controller credential rejection;
- dynamic invalidation for revoked/rejected/expired credentials, inactive issuer and inactive subject profile;
- bounded trust-class threshold comparison.

No external value transfer or arbitrary external calls exist in the contract, so reentrancy, allowance and fund-accounting exposure are not applicable to current code.

### Gaps requiring qualification

Missing dedicated negative/adversarial coverage at baseline includes:

- zero profile ID;
- duplicate profile;
- unauthorized update/transfer;
- invalid pending-controller transitions;
- unauthorized issuer mutation;
- invalid issuer ID/controller/trust class;
- duplicate credential ID;
- unknown/inactive issuer;
- unauthorized issuer use;
- unknown subject;
- past/current expiry;
- unauthorized revocation;
- duplicate revocation;
- unauthorized subject rejection;
- profile deactivation/reactivation effects;
- issuer controller replacement/revocation semantics;
- credential expiry boundary;
- trust threshold boundaries including NONE/SYSTEM;
- primary-name one-sided/stale binding behavior.

### Design risks

1. **Issuer replacement semantics.** Governance may overwrite issuer controller, metadata, trust class and active status. Existing credential validity follows current issuer state. This is consistent with current docs but deserves explicit invariant tests and operator documentation.
2. **Subject rejection is irreversible.** No unreject path exists. This may be intentional, but it must be documented as policy rather than inferred.
3. **Primary name is a one-sided pointer.** The contract does not verify Names420. Architecture correctly requires consumers to establish bilateral agreement.
4. **No local pause/emergency mode.** Current contract has no pause state. Whether this is acceptable conflicts with the generic dependency matrix that lists PauseRegistry/SystemSafety dependencies.

## Security classification

| Area | Classification |
|---|---|
| access-control base | verified safe behavior within current contract |
| hidden owner/backdoor | none identified |
| reentrancy/external call | not applicable |
| asset custody/accounting | not applicable |
| credential replay/signature replay | not applicable to current direct-call issuance model |
| controller transfer | mitigated by two-step acceptance |
| issuer compromise | accepted design risk subject to governance deactivation/replacement |
| stale cached credential validity | mitigated by canonical recheck requirement in docs |
| interface mismatch | unresolved release vulnerability/integration defect |
| live address spoofing | mitigated in repository config, not live-qualified |

No claim is made that this is an external independent security audit.

## Documentation audit

Present:

- app index;
- getting started;
- user guide;
- architecture;
- developer integration;
- contract semantics;
- event/finality guidance;
- security/privacy;
- troubleshooting;
- cross-protocol Registry/Names/Identity/420-IS architecture.

Missing/partial at baseline:

- operator/admin guide;
- dedicated Identity deployment guide;
- exact interface compatibility decision;
- generated/retained Identity artifact and ABI identity;
- predeploy materialization record;
- exact deployment smoke procedure;
- live monitoring/runbook;
- dedicated Genesis acceptance record.

## Genesis/deployment audit

Canonical frozen address: `0x0000000000000000000000000000000000000436`.

The address namespace is now reconciled in repository authority. However:

- `contracts/config/predeploy/predeploy-plan.json` still marks Identity420 `SOURCE_READY`;
- `contracts/artifacts/Identity420.json` is missing;
- no Identity predeploy-state file exists;
- runtime code hash and materialized immutable constructor value are not retained for Identity;
- no live testnet chain witness proves code at 0x0436;
- Wallet deployment inventory marks Identity420 `FROZEN_SYSTEM_NOT_CHAIN_VERIFIED`;
- official public testnet network manifest/endpoints remain missing.

Therefore the app is not testnet-ready or Genesis-ready.

## Requirement matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| optional pseudonymous profile anchor | Identity docs/architecture | Identity420 | basic | yes | COMPLETE | retain |
| profile controller/activity lifecycle | same | implemented | partial | yes | PARTIAL | add adversarial suite |
| two-step controller transfer | same | implemented | basic happy path | yes | PARTIAL | negative/boundary tests |
| primary .420 pointer | same | implemented | bilateral happy path | yes | PARTIAL | stale/one-sided tests |
| governance-curated issuers | same | implemented | partial | yes | PARTIAL | governance negative tests |
| issuer trust classes | same | implemented | basic thresholds | yes | PARTIAL | boundary/current-state tests |
| credential issue/expiry/revoke/reject | same | implemented | partial | yes | PARTIAL | complete lifecycle negatives |
| dynamic validity | same | implemented | issuer suspend/reject | yes | PARTIAL | profile/expiry/controller cases |
| frozen Identity credential interface | Genesis interface layer | incompatible | none | interface exists | BROKEN | explicit API decision + implementation/adapter/migration |
| shared dependency matrix | dependency matrix | not implemented as listed | none | matrix only | STALE | reconcile canonical dependency requirements |
| canonical frozen address | system/canonical address maps | 0x0436 | verifier coverage elsewhere | yes | COMPLETE | retain |
| generated ABI/artifact | predeploy/reference model | missing | none | missing | MISSING | deterministic artifact generation |
| predeploy state | predeploy plan | missing | none | missing | MISSING | materialize immutable/storage state |
| Indexer projection | Indexer | present | existing Indexer tests | docs | PARTIAL | exact Identity event compatibility + live evidence |
| Search projection | Search | present | search tests | docs | PARTIAL | live qualified Indexer evidence |
| Wallet runtime binding | Wallet | config/deployment inventory | config tests | docs | PARTIAL | live-chain code/hash verification |
| Wallet user workflow | app definition | no complete audited journey found | none found | user guide describes it | MISSING | implement/qualify profile & credential UI |
| operator documentation | documentation requirements | absent baseline | n/a | added in audit branch | PARTIAL | retain and expand after deployment tooling |
| testnet qualification | release requirements | no live deployment | none | blocked | BLOCKED | deploy production-equivalent testnet |
| Genesis acceptance | roadmap step 13 | not closed | no exact-head app closeout | no | BLOCKED | complete remediation + reconciliation |

## Readiness state at baseline

- CODE COMPLETE: **NO** — canonical/frozen interface contradiction remains.
- BUILD COMPLETE: **NO** — no fresh clean-checkout execution was possible in this audit environment and the retained Identity artifact is missing.
- CONTRACT COMPLETE: **NO** — implementation exists but interface/dependency contract is unresolved.
- TEST COMPLETE: **NO** — dedicated negative/adversarial coverage is incomplete.
- DOCUMENTATION COMPLETE: **NO** — operator/deployment/acceptance documentation incomplete.
- INTEGRATION COMPLETE: **NO** — frozen interface, Wallet workflow and live dependencies incomplete.
- SECURITY QUALIFIED: **NO** — unresolved interface/trust-model integration issue and incomplete adversarial coverage.
- TESTNET READY: **NO** — missing artifact/predeploy/live-chain evidence.
- GENESIS READY: **NO** — above blockers plus Genesis reconciliation not closed.
- PRODUCTION READY: **NO** — testnet/adversarial/independent launch review remain.

## Audit-environment limitation

The connected GitHub repository was inspectable, but the local sandbox could not resolve github.com and therefore could not clone the repository or independently run Foundry/Node/Go builds. Repository CI evidence may be used as historical evidence only; it is not a substitute for exact-head requalification after remediation.

## Final determination

420Identity is **materially implemented but not complete**.

The core protocol contract is real and coherent with the high-level Identity documentation, but the frozen Genesis interface/state model is incompatible, release artifacts are absent, dedicated qualification is insufficient, Wallet user-facing Identity management is not established, and live testnet deployment evidence does not exist.

Do not mark 420Identity complete until the remediation roadmap is closed against one exact final head.
