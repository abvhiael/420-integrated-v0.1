# 420Media — MEDIA-AUDIT-6 qualification evidence

## Step

**MEDIA-AUDIT-6 — Identity, Rights and ownership/provenance integration**

Status: **COMPLETE**

Qualification level: **Level 1 — app-scoped fast qualification**

## Authoritative implementation

- implementation SHA: `70376d2b1d41659d7d654e41faa5e9d3c992fd66`
- current main/base SHA at qualification: `23ebff000a471bfbc4439894f797f3b17a530867`
- original audit baseline SHA: `d86a3810d2901dc1082b65dc9061896c46e1911d`
- audit branch: `audit/420media-complete-20261006`
- active PR: **#536**

## Canonical requirements

MEDIA-AUDIT-6 requires Media to:

- bind creator/controller actions to scoped 420Identity/Wallet authorization;
- use authoritative 420Rights/provenance checks where publication or reuse is rights-bearing;
- preserve pseudonymous/optional Identity semantics;
- avoid making Media an Identity or Rights authority.

All four requirements are satisfied at repository scope.

## Implementation completed

### Wallet and optional Identity

Added `media/authority` actor authorization:

- wallet address is mandatory base actor authority;
- zero profile ID is a valid pseudonymous wallet-only path;
- supplied profile IDs are read from canonical `Identity420.profiles`;
- supplied profiles must be active;
- supplied profile controller must exactly equal the wallet;
- Identity context can narrow authorization but cannot widen wallet/controller authority;
- Media never receives or stores wallet signing keys.

Livestream now exposes:

- `CreateForActor`
- `StartForActor`
- `StopForActor`
- `StatusForActor`

These apply optional Identity authorization before entering the already-qualified canonical stream-controller flow. Existing wallet-only methods remain the pseudonymous path.

### Canonical Rights/provenance

Added canonical Ethereum readers over the existing Media JSON-RPC abstraction for:

- `RightsAssetRegistry420.subject(subjectId)`;
- `RightsClaimRegistry420.claim(rightId)`;
- `RightsRouter420.isRightEffective(rightId)`;
- `RightsRouter420.canUse(licenseId, actor, scopeHash)`.

No fixed Rights addresses are invented; qualified deployment/Registry configuration supplies addresses/selectors.

### Holder publication

Rights-bearing public projection now has an explicit `AuthorizePublicProjection` gate.

The gate requires:

- local asset state is READY + PUBLIC;
- valid wallet/optional Identity actor;
- nonzero Rights subject/provenance/right binding;
- exact canonical subject provenance-hash match;
- exact claim subject match;
- currently effective right;
- actor wallet is current canonical right holder.

A local `visibility=PUBLIC` value is not treated as Rights authorization.

### Licensed reuse / derivatives

Added `ValidateDerivativeReuse`.

It first enforces the existing Media derivative integrity boundary, then requires:

- valid wallet/optional Identity actor;
- exact canonical subject/provenance match;
- exact right-to-subject match;
- currently effective right;
- nonzero license ID;
- nonzero scope hash;
- exact `RightsRouter420.canUse(licenseId, actor.wallet, scopeHash)` authorization.

A local derivative relationship cannot substitute for a canonical license.

## Authority boundaries preserved

420Media does **not**:

- create or mutate Identity profiles;
- create, supersede or transfer Rights claims;
- grant/revoke/renounce Rights licenses;
- adjudicate external legal ownership;
- infer a missing right/license;
- turn local provenance strings into canonical Rights evidence;
- custody wallet keys.

420Identity remains the canonical optional profile authority.

420Rights remains the canonical claim/license/provenance protocol and does not become external legal adjudication merely because Media reads it.

## Files introduced or changed

- `media/authority/guard.go`
- `media/authority/ethereum.go`
- `media/authority/guard_test.go`
- `media/authority/ethereum_test.go`
- `media/storage/rights.go`
- `media/storage/rights_test.go`
- `media/livestream/identity.go`
- `media/livestream/identity_test.go`
- `docs/420-MEDIA-IDENTITY-RIGHTS.md`
- `scripts/verify-420media-audit.py`
- `.github/workflows/420media-audit.yml`
- `docs/420MEDIA-AUDIT.md`

## Security / adversarial / failure-path coverage

PASS:

- wallet-only pseudonymous actor does not force an Identity lookup;
- malformed/zero wallet authority fails closed;
- supplied inactive Identity profile fails closed;
- supplied profile/controller mismatch fails closed;
- Identity RPC failure does not fall back to local profile state;
- malformed canonical Identity state fails closed;
- public visibility alone cannot bypass the Rights publication gate;
- canonical provenance mismatch fails closed;
- right-to-subject mismatch fails closed;
- ineffective Rights claim fails closed;
- non-holder publication fails closed;
- derivative integrity failure occurs before license authorization;
- missing/invalid rights binding fails closed;
- license denial fails closed;
- canonical Rights RPC failure cannot be replaced by local state;
- exact actor/scope license use is delegated to canonical `RightsRouter420.canUse`;
- Identity-aware livestream failure occurs before transport activation;
- prior Media discovery, Storage, livestream, Phase 1 and Anvil regressions remain green.

## Exact-head Level 1 qualification

Workflow: **420Media audit**

- run: **37507801987**
- run number: **65**
- job: **112420823672**
- exact implementation SHA assertion: **PASS**
- canonical Media audit verifier: **PASS**
- changed-surface gofmt gate: **PASS**
- GEN-SVC feature contract validator: **PASS**
- `go test ./media/... ./cmd/420media-node`: **PASS**
- `go vet ./media/... ./cmd/420media-node`: **PASS**
- Media Solidity build: **PASS**
- retained Media Phase 1 protocol/hardening tests: **PASS**
- Media Anvil integration: **PASS**
- workflow conclusion: **SUCCESS**

## Diagnosed superseded runs

Earlier runs are not qualification evidence.

The first MEDIA-AUDIT-6 candidate reached the changed-surface formatting gate and identified only gofmt drift in newly added authority/Identity files. Those files were normalized without weakening behavior or reducing assertions.

Run #65 is the authoritative passing exact-head evidence.

## Level 2 status

No new Level 2 milestone is documented at MEDIA-AUDIT-6.

The previously completed MEDIA-AUDIT-5 Level 2 milestone remains valid.

MEDIA-AUDIT-6 is therefore correctly closed at Level 1.

## Intentionally deferred Level 3 checks

Deferred until the complete Media app-phase closeout:

- canonical full repository Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- Docs/global reconciliation;
- repository-wide client/service/Indexer/Search/RPC inventories;
- complete Media security/static/deployment/configuration closeout;
- final reconciliation against then-current `main`.

## Limitations / later work

- public `/v1` signed request format and typed SDK remain MEDIA-AUDIT-9;
- frontend wallet/profile selection and transaction/signing UX remain MEDIA-AUDIT-10;
- full content-rights abuse/moderation closeout remains MEDIA-AUDIT-11;
- live deployment addresses, Registry records and production-equivalent Identity/Rights RPC evidence remain MEDIA-AUDIT-12/13;
- repository qualification does not claim that a 420Rights claim proves external legal ownership.

## Blockers

None for MEDIA-AUDIT-6 repository Level 1 completion.

## Next canonical roadmap step

**MEDIA-AUDIT-7 — Pay and Compute integration**
