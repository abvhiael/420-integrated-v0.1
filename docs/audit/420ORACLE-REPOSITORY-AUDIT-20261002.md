# 420Oracle repository audit — 2026-10-02

## Scope

Application: **Oracle Interface Layer / 420Oracle**

Baseline repository: `abvhiael/420-integrated-v0.1`

Baseline `main`: `edfd0752e825fc5379700851358e8398efb0b9c5`

Audit branch: `audit/oracle-interface-layer-remediation-20261002`

Pull request: **#497**

Normative sources reviewed include the frozen Oracle V1 model, DOC-5.8 infrastructure architecture, randomness/oracle protocol boundary, Genesis dApp map, service ID catalogue, frozen address namespace, Genesis interface-layer freeze/policy, Oracle contracts, tests, Swap TWAP integration, and prior Oracle PR history.

## Canonical purpose and architecture

420Oracle is a provider-neutral external-data interface layer. It owns provider registration, feed configuration, bounded source membership, replay-safe observation intake, freshness/epoch eligibility, deterministic median or exact-quorum aggregation, confidence/deviation policy, and circuit-breaker behavior. It does not own user funds, bridge proofs, generalized randomness, governance decisions, validator authority, arbitrary execution, or application settlement.

Runtime architecture is contract-only. There is no canonical user-facing frontend, database, indexer, or first-party backend required for correctness. Off-chain provider submission infrastructure and credentials are operational dependencies.

## File inventory

| Component | Status | Notes |
|---|---|---|
| Frozen model | COMPLETE | `docs/420-ORACLE-V1-MODEL.md` |
| Infrastructure architecture | COMPLETE | DOC-5.8 |
| Protocol boundary | COMPLETE | randomness/oracle architecture |
| Provider registry | COMPLETE | governance-curated reporting authority |
| Feed registry | COMPLETE | bounded 16-source feed configuration |
| Risk policy | COMPLETE | confidence/deviation/halt |
| Router | COMPLETE | observation intake + canonical reads |
| Runtime `IOracle420` | COMPLETE | `readNumeric/readResult` |
| Source-adapter interface | COMPLETE | read-only normalization |
| Swap TWAP adapter | COMPLETE | fail-closed Swap observation source |
| Randomness boundary | COMPLETE | separate `IRandomnessRouter420` |
| Genesis service ID | COMPLETE | `420/service/oracle/v1` |
| Fixed address | NOT APPLICABLE | Oracle is registry-resolved |
| Deployment manifest | COMPLETE | added by this audit |
| Deployment/Registry binding test | COMPLETE | added by this audit |
| App-specific README | COMPLETE | added by this audit |
| Oracle-specific CI | COMPLETE | added by this audit |
| Audit verifier | COMPLETE | added by this audit |
| Frontend | NOT APPLICABLE | no canonical user UI in frozen model |
| Backend/API/database | NOT APPLICABLE | no canonical service required for chain correctness |
| Provider operator infrastructure | BLOCKED | environment/provider-specific |
| Live deployment evidence | BLOCKED | requires testnet/live chain |

## Material findings

### F1 — incompatible duplicate `IOracle420` surfaces

The repository contains two interfaces named `IOracle420`:

- runtime canonical: `contracts/src/interfaces/IOracle420.sol` with `readNumeric/readResult`;
- frozen Genesis interface-layer v1.0: `contracts/src/interfaces/genesis/IOracle420.sol` with `price/isFresh/isSafe`.

They are ABI-incompatible. The frozen interface-layer rules prohibit silently changing the older ABI as a patch. Remediation therefore preserves the frozen v1.0 file, explicitly classifies it as legacy compatibility authority, and makes the runtime Oracle ABI authoritative for `OracleRouter420`. The audit verifier fails if the router imports the legacy ABI.

Status: **PARTIAL architectural debt, mitigated for runtime V1**. A future interface-layer major-version migration is required if the frozen shared interface itself is to converge on the runtime ABI.

### F2 — deployment/discovery package was incomplete

Before this audit, contracts existed and the address namespace marked `oracle-router` registry-resolved, but there was no Oracle-specific deployment manifest describing constructor order, ProtocolRegistry publication, external dependencies, or testnet blockers.

Remediation: `contracts/config/420oracle-genesis.json` plus a ProtocolRegistry deployment-binding test.

Status: **COMPLETE at repository level; live evidence BLOCKED on testnet**.

### F3 — qualification coverage was distributed, not owned

Oracle unit/risk/epoch tests existed, and Swap qualified the TWAP adapter, but no Oracle-owned exact-head workflow or audit verifier existed.

Remediation: dedicated `420Oracle audit qualification` workflow, repository verifier, hardening tests, and deployment-binding test.

Status: **COMPLETE subject to exact-head CI**.

## Security review

Verified design controls:

- governance-only provider/feed/source/risk configuration;
- feed-scoped provider reporting authority;
- global observation-ID replay protection;
- per-provider/feed monotonic observation timestamps;
- feed/provider/source epoch invalidation;
- bounded source enumeration;
- stale/future observation rejection;
- exact-quorum ambiguity rejection;
- minimum-confidence filtering;
- deviation fail-closed behavior;
- per-feed circuit breaker;
- no token custody/value-transfer primitives in Oracle contracts;
- no `delegatecall`, `selfdestruct`, or `tx.origin` in the Oracle source tree;
- bridge proofs and generalized randomness remain separate trust domains.

Accepted design risks:

- external facts remain dependent on configured provider quality and governance source selection;
- provider keys are operational trust roots for the feeds to which they are assigned;
- a governance compromise can reconfigure providers, feeds, and risk policy;
- on-chain aggregation cannot prove arbitrary off-chain computation correct beyond the configured source/verifier semantics.

Unresolved release risk:

- live provider/operator security, key custody, monitoring, incident response, and provider diversity cannot be qualified from repository code alone.

## Requirement matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| Provider-neutral authority | V1 model, DOC-5.8 | provider/source registries | Oracle420 | model + app docs | COMPLETE | none |
| Reporting-only provider authority | ORACLE-INV-001 | operator + source checks | unauthorized-provider test | model | COMPLETE | none |
| Active-provider gating | ORACLE-INV-002 | provider registry + router eligibility | provider-disable test | model | COMPLETE | none |
| Active-feed gating | ORACLE-INV-003 | router feed checks | hardening test | app docs | COMPLETE | none |
| Freshness | ORACLE-INV-004 | heartbeat eligibility | freshness test | model | COMPLETE | none |
| Quorum | ORACLE-INV-005 | minSources | numeric/exact tests | model | COMPLETE | none |
| Replay protection | ORACLE-INV-006 | global observationUsed | replay test | model | COMPLETE | none |
| Monotonic provider timestamps | ORACLE-INV-007 | latest timestamp check | timestamp test | model | COMPLETE | none |
| Deterministic numeric median | ORACLE-INV-008 | bounded in-memory sort | median test | model | COMPLETE | none |
| Exact-result ambiguity fail-closed | ORACLE-INV-009 | quorum selector | ambiguity test | model | COMPLETE | none |
| Maximum 16 sources | ORACLE-INV-010 | MAX_SOURCES | hardening test | model | COMPLETE | none |
| No ordinary-feed randomness | ORACLE-INV-011/018 | separate interface | structural verifier | protocol docs | COMPLETE | none |
| No custody | ORACLE-INV-012 | no transfer/value paths | static scan | model | COMPLETE | none |
| Epoch invalidation | ORACLE-INV-013 | feed/provider/source epochs | Oracle420Epoch | model | COMPLETE | none |
| Minimum confidence | ORACLE-INV-014 | risk filtering | Oracle420Risk | model | COMPLETE | none |
| Deviation limit | ORACLE-INV-015 | spreadBps + risk | Oracle420Risk | model | COMPLETE | none |
| Circuit breaker | ORACLE-INV-016 | risk halt | Oracle420Risk | model | COMPLETE | none |
| Read-only adapters | ORACLE-INV-017 | adapter interface | SwapTWAPOracle420 | model/DOC-5.8 | COMPLETE | none |
| Canonical service ID | ServiceIds420 | ORACLE ID | audit verifier | app docs | COMPLETE | none |
| ProtocolRegistry discovery | address namespace | router registry-resolved | deployment-binding test | deployment config | COMPLETE | live publication evidence |
| Fixed-address policy | address freeze | no Oracle fixed address | audit verifier | deployment config | COMPLETE | none |
| Runtime ABI | V1 model | readNumeric/readResult | Oracle suites | app docs | COMPLETE | none |
| Frozen legacy Oracle ABI | interface-layer v1.0 | retained old ABI | genesis verifier | audit docs | PARTIAL | major-version migration if convergence is required |
| Swap TWAP integration | V1 model / Swap audit | TWAP adapter | SwapTWAPOracle420 | Swap + Oracle docs | COMPLETE | none |
| Automation consumer integration | DOC-5.8 | 420-automation canonical read consumer exists | automation suite outside Oracle scope | architecture | PARTIAL | cross-app exact-head integration qualification |
| Bridge boundary | DOC-5.8 | documented separation | structural | architecture | COMPLETE | no generic Oracle substitution |
| Frontend | frozen model | none intended | N/A | app docs | NOT APPLICABLE | none |
| Backend/database/indexer | frozen model | none required | N/A | app docs | NOT APPLICABLE | none |
| Operator/provider service | DOC-5.8 | external/off-chain | none repository-canonical | architecture | BLOCKED | provision providers, credentials, monitoring |
| Clean build | Foundry config | Solidity 0.8.24/Cancun | dedicated workflow | app docs | PARTIAL | exact-head CI must pass |
| Exact-head qualification | release discipline | workflow added | pending | audit record | BLOCKED | obtain CI run IDs for final SHA |
| Testnet deployment | Genesis intent | deployable graph/config | local binding only | deployment config | BLOCKED | live testnet + addresses + governance |
| Genesis release evidence | Genesis intent | repository package present | no live evidence | audit record | BLOCKED | testnet qualification and retained deployment evidence |
| Production readiness | operator requirements | no live providers/monitoring evidence | none | architecture | BLOCKED | production provider diversity, operations, monitoring, incident drills |

## Readiness after ORACLE-AUDIT-5 exact-head qualification

- CODE COMPLETE: **YES** for the frozen on-chain V1 scope.
- BUILD COMPLETE: **YES** for the Oracle V1 repository/release graph at qualified implementation SHA `28c61dc020a02b6fa981eecd566d533ca6a6f0f2`.
- CONTRACT COMPLETE: **YES** for the frozen V1 contract boundary.
- TEST COMPLETE: **YES** for ORACLE-AUDIT-5 Level 1 scope: 18/18 retained Oracle tests passed on the exact qualified implementation SHA.
- DOCUMENTATION COMPLETE: **YES** for repository-level V1/deployment/operator boundaries.
- INTEGRATION COMPLETE: **NO** because live ProtocolRegistry publication and cross-app/testnet evidence do not exist.
- SECURITY QUALIFIED: **YES** for ORACLE-AUDIT-5 repository/static scope; live provider/operator security remains outside repository evidence and is deferred to later release stages.
- TESTNET READY: **YES** at repository/package level, but actual deployment is not yet qualified.
- GENESIS READY: **NO**; live testnet deployment/seed/registry evidence is required.
- PRODUCTION READY: **NO**; provider operations, monitoring, credentials, production deployment, and incident evidence are required.

## Non-renumbering remediation roadmap

1. **ORACLE-AUDIT-1 — canonical inventory and architecture reconciliation** — COMPLETE.
2. **ORACLE-AUDIT-2 — contract/adversarial hardening and bounded-source qualification** — COMPLETE; exact-head coverage retained in ORACLE-AUDIT-5 run `37093500837`.
3. **ORACLE-AUDIT-3 — deployment and ProtocolRegistry binding package** — COMPLETE; deployment binding passed on exact qualified implementation SHA.
4. **ORACLE-AUDIT-4 — interface-layer compatibility containment** — COMPLETE for runtime containment; frozen-interface major migration remains explicitly deferred.
5. **ORACLE-AUDIT-5 — exact-head repository qualification and durable evidence** — COMPLETE. Implementation SHA `28c61dc020a02b6fa981eecd566d533ca6a6f0f2`; workflow run `37093500837`; durable evidence commit `67d1e5d8e58e48af4cb08231b56b877dcd8c174c`.
6. **ORACLE-AUDIT-6 — cross-application consumer qualification** — PENDING; verify Automation/Swap and any Pay/Exchange consumers against the canonical runtime ABI.
7. **ORACLE-AUDIT-7 — production-equivalent testnet deployment** — BLOCKED on live testnet, governance addresses, provider/feed/source decisions, and provider operators.
8. **ORACLE-AUDIT-8 — Genesis/production closeout** — BLOCKED on retained testnet evidence, production provider diversity/credentials/monitoring, final deployment approval, and operational incident/recovery evidence.


## ORACLE-AUDIT-5 closeout

Qualification level: **Level 1 — per-roadmap-step fast qualification**.

Authoritative implementation SHA: `28c61dc020a02b6fa981eecd566d533ca6a6f0f2`.

Reconciliation/base `main` SHA: `edfd0752e825fc5379700851358e8398efb0b9c5`. At qualification the audit branch was 10 commits ahead and 0 behind.

Authoritative app-specific CI: **420Oracle audit qualification**, run **37093500837**, **PASS**.

- `audit-state` job **111118614968**: exact-head check PASS; Oracle repository verifier PASS; frozen Genesis interface verifier PASS.
- `oracle-contracts` job **111118614777**: exact-head check PASS; audit-scope format check PASS; Oracle release-graph build PASS; retained Oracle suites PASS; static security scan PASS.
- retained Oracle tests: **18 passed / 0 failed / 0 skipped** across deployment binding, hardening, epoch, risk, and core Oracle suites.

Prior run **37093325288** failed at a workflow formatting gate that swept pre-existing Oracle test formatting. That was diagnosed as a CI-scope defect rather than protocol behavior. The gate was narrowed to the audit-owned formatting surface, the deployment-binding test was corrected to consume the canonical `ProtocolRegistry.Service` return struct, and the resulting new executable/workflow/test head was requalified from scratch.

Durable evidence record: `docs/audit/evidence/oracle-audit-5-20261003.md` at evidence commit `67d1e5d8e58e48af4cb08231b56b877dcd8c174c`.

Level 2 was not required for this ordinary exact-head repository step. Level 3 repository-wide closeout checks remain intentionally deferred to app-phase closeout. Automatically skipped/classifier-only unrelated workflows are not treated as passing evidence.

**ORACLE-AUDIT-5 is COMPLETE.**

Next canonical roadmap step: **ORACLE-AUDIT-6 — cross-application consumer qualification**.
