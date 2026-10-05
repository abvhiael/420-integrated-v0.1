# Dev Compensation Vault complete audit — 2026-10-04

## Scope and authority

This audit treats current `main`, the frozen Application Revenue Policy V1, the Genesis contract map, canonical service IDs, implementation, tests, prior PR history and exact-head CI as authoritative. Historical implementation PR #40 is evidence of origin, not evidence that the current head remains qualified.

## Canonical definition

`DevelopmentCompensationVault420` is the V1 non-custodial router for the lead-developer share of eligible first-party **net protocol revenue**. It is not a general treasury, validator reward path, user-deposit vault, bridge backing vault, escrow, LP-principal holder or generic withdrawal mechanism.

Canonical V1 invariants:

1. maximum developer allocation: 1,000 bps (10%);
2. contribution basis: application-declared eligible net protocol revenue;
3. source authorization: default-deny `CapabilityRegistry420`, source-application scoped and amount-aware;
4. replay domain: source contract + source application ID + revenue reference;
5. policy binding: frozen `420/REVENUE/POLICY/APPLICATION_REVENUE/V1`;
6. native and exact-transfer ERC-20 routing is atomic to the immutable deployment-configured 420 Integrated Labs beneficiary;
7. no arbitrary native deposit and no generic withdrawal path;
8. successful routing emits an indexable `DevelopmentCompensationForwarded` event;
9. canonical Genesis service ID: `420/service/development-compensation/v1`.

## Repository state at audit opening

- repository: `abvhiael/420-integrated-v0.1`
- opening `main`: `f6a426fc386b21f871b1805e00a57b1dad2bf902`
- audit branch: `audit/dev-compensation-vault-20261004`
- audit PR: #519
- historical implementation PR: #40, merged as `1b6799613780274f069d90f077e2a462c4852c6b`

## Architecture discovered

### On-chain
- `contracts/src/revenue/DevelopmentCompensationVault420.sol` — routing, exact split validation, authorization, replay protection, atomic forwarding and event emission.
- `contracts/src/revenue/DevelopmentCompensationIds420.sol` — component/action/beneficiary/policy identifiers and source scope derivation.
- `CapabilityRegistry420` — shared authorization dependency.
- `ProtocolRegistry` / `ServiceIds420` — canonical service identity/discovery layer.

### Policy/configuration
- `contracts/config/application-revenue-policy-v1.json` — frozen V1 economics/trust boundary.
- `contracts/config/genesis-dapp-contract-map.json` — Treasury/Revenue Genesis component ownership.
- `contracts/src/libraries/ServiceIds420.sol` — canonical Genesis service ID.

### Tests
- `contracts/test/DevelopmentCompensationVault420.t.sol`
- `contracts/test/DevelopmentCompensationGenesis420.t.sol`

### Application layer
A standalone frontend, backend, API, worker, database or indexer is **not required by the canonical vault design**. The vault is a protocol primitive. Explorer/Analytics may consume emitted events, while fee-bearing applications invoke the contract.

## Audit findings and remediation

### DEVCOMP-AUDIT-1 — canonical definition/inventory
**COMPLETE.** The purpose, economic boundary, trust model, canonical IDs, contract family, Genesis map entry and prior implementation history are present and mutually recognizable.

### DEVCOMP-AUDIT-2 — policy-reference binding
**REMEDIATED.** Before this audit the contract exposed canonical `policyId` but accepted any non-zero `policyRef`. That allowed successful contributions to emit an arbitrary policy reference even though the vault is specified as Application Revenue Policy V1.

Remediation:
- added `InvalidPolicyReference`;
- `_validateIdentifiers` now requires `policyRef == policyId`;
- existing test policy reference now uses the canonical V1 ID;
- added a wrong-policy fail-closed regression.

### DEVCOMP-AUDIT-3 — arithmetic, custody and replay
**COMPLETE at repository level.**
- 10% ceiling is enforced.
- zero revenue / zero bps fail closed.
- exact contribution amount is recomputed.
- native value is forwarded atomically.
- ERC-20 routing verifies exact source and beneficiary balance deltas.
- replay state is consumed before external transfer and transaction rollback preserves correctness on failure.
- no owner withdrawal or direct native deposit path exists.
- Solidity 0.8 checked arithmetic provides overflow failure semantics.

### DEVCOMP-AUDIT-4 — authorization
**COMPLETE at repository level.**
The vault delegates authorization to `CapabilityRegistry420.isAuthorized` with:
- source contract principal;
- development-compensation component;
- contribute-revenue action;
- source-application-derived scope;
- exact contribution amount.

Live grant creation, authority ownership and revocation still require deployment/testnet evidence.

### DEVCOMP-AUDIT-5 — Genesis identity/integration
**PARTIAL.**
- service ID is canonical and tested;
- Genesis contract map includes the revenue subsystem;
- policy/configuration identifies the vault;
- no repository evidence establishes a live deployed Development Compensation Vault address, immutable beneficiary wallet, exact Capability Registry grant set, or live Protocol Registry publication.

### DEVCOMP-AUDIT-6 — CI/test ownership
**REMEDIATED.**
The generic Solidity workflow classified the initial audit PR but skipped all Foundry jobs, so it could not be counted as vault qualification. This audit adds `.github/workflows/dev-compensation-audit.yml` with exact-head checkout, format/build checks, focused V1/Genesis tests, hardening-profile rerun, forbidden-primitive scan and targeted Slither high-severity gate.

### DEVCOMP-AUDIT-7 — documentation
**PARTIAL.**
Existing design documentation accurately describes purpose, exclusions, immutable beneficiary, capability authorization, no-custody routing and audit events. This audit report and remediation roadmap add explicit release-state separation. Deployment-time address/grant/registry evidence cannot be completed before the target environment exists.

## Requirement matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| V1 lead-developer revenue router | policy + vault doc | vault contract | focused vault suite | vault doc | COMPLETE | none |
| 10% V1 ceiling | policy JSON | `MAX_COMPENSATION_BPS=1000` | ceiling regression | documented | COMPLETE | none |
| exact V1 policy binding | policy ID + vault `policyId` | exact equality after audit fix | wrong-policy regression | this report | COMPLETE | none |
| source/app-scoped capability authorization | policy JSON | Capability Registry call with source scope + amount | unauthorized regression; exact call path inspected | vault doc | COMPLETE | live grants remain deployment evidence |
| replay protection | policy JSON | source + app + revenueRef contribution ID | replay regression | vault doc | COMPLETE | none |
| native no-custody forwarding | policy JSON | atomic fixed-beneficiary call | native routing + zero custody | vault doc | COMPLETE | live beneficiary test at deployment |
| ERC-20 exact-transfer forwarding | policy JSON | pre/post source and beneficiary deltas | token routing | vault doc | COMPLETE | live token matrix at deployment |
| no direct deposits | policy JSON | receive/fallback revert | regression | vault doc | COMPLETE | none |
| no generic withdrawal | policy JSON | absent | structural inspection | vault doc | COMPLETE | none |
| indexable event | vault doc | event includes source/app/ref/asset/beneficiary/basis/bps/amount/policy | successful paths exercise emission transactionally | vault doc | COMPLETE | indexer live ingestion evidence later |
| canonical Genesis service ID | ServiceIds420 | DEVELOPMENT_COMPENSATION | Genesis registry regression | Genesis map | COMPLETE | live Registry publication later |
| deployment address | deployment requirement | no live address found | none live | beneficiary marked deployment-config-required | BLOCKED | testnet/mainnet deployment |
| immutable beneficiary value | policy/config | constructor immutable | local test | documented | PARTIAL | record actual deployed beneficiary |
| real Capability Registry grants | policy/config | dependency exists | local mock only | semantics documented | BLOCKED | deploy grants and prove revoke/limit behavior live |
| Protocol Registry live publication | service ID | canonical ID exists | local canonical-ID test | service docs | BLOCKED | publish and verify deployed service |
| dedicated exact-head CI | audit requirement | workflow added in PR #519 | exact-head jobs | roadmap/report | PARTIAL | record successful final-head run |
| frontend/backend/API | canonical design | not required | n/a | protocol primitive documented | NOT APPLICABLE | none |

## Security determination

### Verified safe behavior
- fixed immutable beneficiary;
- default-deny external capability check;
- source/application replay domain;
- shared reentrancy guard across routing paths;
- exact token balance conservation;
- no delegatecall/selfdestruct/tx.origin expected in the vault;
- no arbitrary withdrawal/admin redirect;
- zero address / identifier / amount policy failures.

### Mitigated risk
- arbitrary policy-label injection is mitigated by exact V1 policy binding added in this audit.
- fee-on-transfer/non-exact ERC-20 behavior fails closed via balance delta verification.

### Accepted design risk
The originating fee-bearing application remains responsible for correctly determining that `grossProtocolRevenue` is eligible **net protocol revenue**. The vault cannot independently prove upstream economic classification; it bounds callers through capabilities and exact split math.

### Unresolved live risks
Misconfigured deployed beneficiary, over-broad Capability Registry grants, wrong Registry publication, unsupported live-token behavior or operational key compromise can only be qualified against the deployed environment.

## Readiness state

- CODE COMPLETE: **YES**, subject to exact-head CI closeout.
- BUILD COMPLETE: **NO** until the dedicated final-head workflow is recorded successful.
- CONTRACT COMPLETE: **YES** at repository level.
- TEST COMPLETE: **NO** until the dedicated final-head workflow passes; live deployment tests remain separate.
- DOCUMENTATION COMPLETE: **YES** for repository/pre-testnet scope.
- INTEGRATION COMPLETE: **NO** — live Capability Registry grants and Protocol Registry publication are absent.
- SECURITY QUALIFIED: **NO** until the dedicated hardening/Slither jobs pass on the exact final head.
- TESTNET READY: **YES TO DEPLOY** once repository qualification passes; **not live-testnet qualified**.
- GENESIS READY: **NO** — deployment binding, beneficiary, grants, Registry publication and live evidence remain.
- PRODUCTION READY: **NO** — Genesis/live operational evidence remains.

## Final determination

The Dev Compensation Vault is a real and substantially implemented Genesis protocol component, not a shell. The audit found and repaired a policy-binding defect and a dedicated-CI ownership gap. It must not yet be called Genesis/production ready because the repository contains no live deployment binding, immutable beneficiary evidence, live capability grants or Registry publication evidence.
