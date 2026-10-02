# 420AI complete repository audit — 2026-10-02

## Application
**420AI**

## Audit authority and baseline
Repository: `abvhiael/420-integrated-v0.1`  
Authoritative baseline: `main@b58b09a17e641a42b81d832bad913a83c7caada9`  
Audit branch: `audit/420ai-complete-20261002`

Primary canonical sources reviewed:
- `docs/420-AI-V1-ARCHITECTURE.md` — frozen-for-implementation 420AI V1 architecture and AI-INV-001..032.
- `docs/architecture/infrastructure/420ai-compute-infrastructure.md` — current infrastructure boundary and implementation-state documentation.
- `contracts/config/genesis-dapp-contract-map.json` — Genesis application contract inventory.
- `contracts/config/genesis-canonical-addresses.json` and Genesis address authority — fixed/reserved/registry-resolved address classification.
- `config/ai-genesis.json` — Genesis 420ai role and discovery configuration.
- `docs/apps/ai/**` — application, security and developer manuals.
- current `contracts/src/ai/**`, `contracts/src/compute/**`, AI tests, current CMP qualification artifacts and prior PR history.
- closed PR #348 / branch `ai-compute-recovery-v1` as historical evidence only; it was never merged and is thousands of commits behind current `main`.

## Canonical purpose and trust model
420AI is the native AI workload layer. It owns model/model-version semantics, AI request constraints, privacy/verification policy references, deployment/provider constraints, result commitments and AI-level lifecycle. 420 ComputeMarket owns general compute provider/node/resource identity, offers/matching, execution receipts, verification and settlement entitlement. Model execution remains off-chain. 420AI must not become a second compute market, consensus dependency, custody authority, arbitrary Wallet authority, bridge authority, identity authority or governance authority.

The five fixed Genesis discovery identities are:
- `0x...042f` — `AIProviderRegistry`
- `0x...0430` — `AIModelRegistry`
- `0x...0431` — `AIJobManager`
- `0x...0432` — `AIJobEscrow`
- `0x...0433` — `AIReputationRegistry`

## Repository state discovered
At audit start:
- `main`: `b58b09a17e641a42b81d832bad913a83c7caada9`
- active audit branch created from that exact commit.
- no current open 420AI completion/audit PR was found.
- historical AI recovery PR #348 is closed, unmerged; its head `ffeee5e7...` diverges from current main by 206 commits ahead / 3969 behind and is not a safe merge candidate.
- Genesis address reconciliation PR #365 was merged earlier and preserved the fixed AI addresses.

## Architecture and file inventory

### Present and active
| Component | Current repository state | Status |
|---|---|---|
| `AIProviderRegistry.sol` | hardened provider compatibility/discovery contract | COMPLETE |
| `AIModelRegistry.sol` | canonical model + immutable version semantics, Model420 rights/disclosure hardening | COMPLETE |
| `AIJobManager.sol` | bounded legacy AI job/request compatibility state machine | PARTIAL |
| `AIJobEscrow.sol` | compatibility accounting facade; direct custody disabled | PARTIAL |
| `AIReputationRegistry.sol` | compatibility evidence counters / Trust adapter boundary | PARTIAL |
| `AIIds420.sol` | AI namespaces | COMPLETE |
| AI rewards contribution adapters | source/verifier/adapter + tests | COMPLETE |
| AI docs/manuals | broad documentation package exists | PARTIAL |
| frozen AI Genesis address records | preserved | COMPLETE |

### Canonical V1 modules named by architecture / Genesis contract map
| Component | Current implementation on main | Status |
|---|---|---|
| `AIAuthorization420.sol` | absent | MISSING |
| `AIPolicyRegistry420.sol` | absent | MISSING |
| `AIModelVersionRegistry420.sol` | absent as standalone module; model-version state is intentionally in `AIModelRegistry` | STALE |
| `AIModelDeploymentRegistry420.sol` | absent | MISSING |
| `AIRequestRegistry420.sol` | absent | MISSING |
| `AIResultRegistry420.sol` | absent | MISSING |
| `AIComputeAdapter420.sol` | absent | MISSING |
| `AIRouter420.sol` | absent | MISSING |
| `IAI420.sol` | absent | MISSING |

The Genesis dApp map therefore overstates implemented 420AI source. This is a real internal-consistency defect, not merely missing documentation.

### Application/service layer
| Component | State | Status |
|---|---|---|
| production AI web client | no current production `ai/` or equivalent client on main | MISSING |
| provider runtime / `420ai` worker service | no current production service on main | MISSING |
| AI read API | no current production API package on main | MISSING |
| AI-specific indexer/read model | no complete dedicated production read surface verified | PARTIAL |
| deployment tooling for complete V1 | no current complete AI V1 deployment/materialization path verified | MISSING |
| production environment/DNS configuration | not materially present for a deployable AI client | MISSING |

Historical PR #348 contained prototypes for provider/API/web and missing V1 contracts, but those files are not authoritative current implementation because that PR was closed without merge and predates the present ComputeMarket design.

## Smart-contract security assessment

### Verified/mitigated behavior in current legacy layer
- model/version identities are separated and model-version material fields are immutable after registration.
- Model420 training rights default deny and are explicitly scoped/revocable/expiry-aware.
- legacy job management uses bounded transitions rather than unrestricted arbitrary status mutation.
- AI escrow design disables direct native custody and is intended to bind settlement to approved external settlement/Vault infrastructure.
- reward contribution publication is capability-gated, evidence-bound and replay protected.

### Accepted/current design risks
- the five frozen contracts are compatibility surfaces and do not by themselves implement the complete mature V1 architecture.
- off-chain inference correctness cannot be inferred from a provider signature; a bound verification profile remains required.
- private AI input/output confidentiality depends on off-chain provider/runtime implementation that is currently absent.

### Unresolved security/readiness gaps
- no current AI-to-CMP adapter exists to prove AI-INV-027 (adaptation narrows but never broadens user constraints).
- no complete current deployment/request/result registries exist to prove authoritative lifecycle, replay, identity and reconstruction properties end-to-end.
- no current provider runtime exists to qualify private payload handling, signing, retries, idempotency, restart recovery or secret isolation.
- no real client exists to qualify wallet/network/transaction/error boundaries.
- no production-equivalent deployment evidence exists for the complete architecture.

No claim is made that the missing layers are secure merely because the legacy contract tests pass.

## Existing tests mapped to current implemented scope
Current main contains focused AI suites including:
- `AIHardening420.t.sol`
- `AIMature420.t.sol`
- `AIModelRegistryHardening420.t.sol`
- `AIModelTrainingRights420.t.sol`
- `AIRewardsIntegration420.t.sol`

These provide meaningful coverage for the present legacy/model/rewards surface but do not test missing V1 deployment/request/result/adapter/router modules, a provider runtime, read API, web client, live Registry publication or end-to-end AI -> current CMP -> Vault settlement.

## Documentation audit
The repository has strong conceptual/user/developer documentation, but documentation is not internally complete because:
1. the Genesis dApp map names source modules that do not exist on current main;
2. architecture documents correctly describe a mature V1 target that current code has not reached;
3. application manuals can describe intended workflows beyond the currently deployable application layer;
4. historical recovery documentation must not be treated as current implementation evidence.

Documentation status: **PARTIAL** until implementation/status pages and Genesis inventory explicitly reconcile these gaps.

## Integration audit
| Dependency | Verified state | Status |
|---|---|---|
| Genesis fixed AI address namespace | fixed 0x042f–0x0433 preserved | COMPLETE |
| 420Registry / ProtocolRegistry | publication model exists; complete AI V1 live publication not evidenced | PARTIAL |
| 420Compute | strong current CMP implementation exists, but no current AI adapter binding | PARTIAL |
| 420Vault / settlement | approved shared custody model exists, but complete AI path not bound/qualified | PARTIAL |
| 420Trust | compatibility/evidence direction documented; complete current AI integration not qualified | PARTIAL |
| 420Wallet | documentation/navigation exists; no complete live AI workflow | PARTIAL |
| 420Identity / Names | no mandatory AI authority dependency found; optional integration only | NOT APPLICABLE |
| 420Rewards | AI contribution adapter/tests exist | COMPLETE |
| Oracle / Bridge | no required direct authority in core AI flow; explicit separation is the intended design | NOT APPLICABLE |

## AI-INV-001..032 requirement matrix
| Requirement | Current evidence | Status | Required remediation |
|---|---|---|---|
| AI-INV-001 off-chain AI; no consensus dependency | architecture + Genesis role docs | COMPLETE | preserve |
| AI-INV-002 distinct identities | model/provider/job legacy separation; deployment/request/result modules absent | PARTIAL | implement missing canonical objects |
| AI-INV-003 IDs never reassigned | covered in existing registries where present | PARTIAL | extend to new registries |
| AI-INV-004 immutable model-version semantics | `AIModelRegistry` hardening/tests | COMPLETE | preserve |
| AI-INV-005 model registration grants no broad authority | model registry scope | COMPLETE | preserve |
| AI-INV-006 compute capacity grants no model ownership | architecture; no complete AI/CMP adapter | PARTIAL | end-to-end tests |
| AI-INV-007 requests grant no arbitrary wallet authority | architecture only for mature request layer | PARTIAL | authorization/client tests |
| AI-INV-008 settlement <= user ceiling | no current complete AI/CMP settlement binding | MISSING | adapter + economic tests |
| AI-INV-009 no generic lifecycle setter | legacy job manager bounded | PARTIAL | enforce on canonical request/result flow |
| AI-INV-010 terminal cannot reopen | legacy coverage only | PARTIAL | canonical flow tests |
| AI-INV-011 no arbitrary settlement recipient | legacy escrow hardened direction | PARTIAL | current CMP/Vault beneficiary proof |
| AI-INV-012 beneficiary derived canonically | missing current AI adapter | MISSING | bind deployment/match beneficiary |
| AI-INV-013 unused funds recoverable | no complete AI current settlement route | MISSING | refund/cancel tests |
| AI-INV-014 no plaintext private payload required on-chain | architecture/current contracts use commitments | PARTIAL | provider/client privacy qualification |
| AI-INV-015 commitment != factual truth | documented | COMPLETE | preserve |
| AI-INV-016 provider signature != correctness | documented | COMPLETE | preserve |
| AI-INV-017 explicit versioned verification semantics | CMP has verification machinery; AI binding absent | PARTIAL | request adapter binding |
| AI-INV-018 AI vs compute pricing separable | architecture only at complete AI layer | PARTIAL | implementation/economic evidence |
| AI-INV-019 stake not proof of confidentiality/quality | documented | COMPLETE | preserve |
| AI-INV-020 objective slash evidence | CMP machinery exists; AI integration absent | PARTIAL | bind policy/evidence |
| AI-INV-021 reputation separate from routing/settlement | legacy reputation compatibility direction | PARTIAL | Trust integration qualification |
| AI-INV-022 governance cannot fabricate results | result registry absent | MISSING | result authority tests |
| AI-INV-023 emergency non-confiscatory | architecture; complete path absent | PARTIAL | settlement/emergency tests |
| AI-INV-024 earned entitlements survive suspension | complete AI economic path absent | MISSING | provider suspension tests |
| AI-INV-025 deprecation does not rewrite history | model registry semantics support this | PARTIAL | end-to-end request history tests |
| AI-INV-026 endpoint replacement cannot mutate accepted identity | deployment registry absent | MISSING | immutable snapshot tests |
| AI-INV-027 adapter cannot broaden constraints | adapter absent | MISSING | implement + adversarial tests |
| AI-INV-028 CMP remains general-purpose | current CMP is separate/general | COMPLETE | preserve |
| AI-INV-029 frozen predeploy identities preserved | Genesis address authority | COMPLETE | preserve |
| AI-INV-030 reputation not universal mutable score | legacy hardening direction | PARTIAL | Trust evidence integration |
| AI-INV-031 legacy escrow no arbitrary-recipient release | direct custody disabled/hardened | PARTIAL | current settlement-route proof |
| AI-INV-032 history reconstructable | missing canonical request/result/deployment + read path | MISSING | registries + indexer/API |

## Additional application/readiness requirements
| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| canonical AI V1 contract inventory | architecture + dApp map | incomplete | legacy only | present but inconsistent | PARTIAL | AI-AUDIT-3 |
| current CMP binding | architecture/infrastructure | missing adapter | no current AI E2E | documented | MISSING | AI-AUDIT-4 |
| Vault-backed AI economics | architecture | legacy compatibility only | legacy/indirect | documented | PARTIAL | AI-AUDIT-5 |
| provider runtime | infrastructure | absent | absent | target described | MISSING | AI-AUDIT-6 |
| private payload path | privacy model | absent runtime | absent live/runtime tests | conceptual docs | MISSING | AI-AUDIT-6 |
| read API/indexer | app/developer docs | incomplete | no complete AI surface | manuals exist | PARTIAL | AI-AUDIT-7 |
| production web client | app manual | absent | absent | manual exists | MISSING | AI-AUDIT-8 |
| deployment materialization | Genesis requirements | incomplete | no full exact deployment qualification | partial | MISSING | AI-AUDIT-9 |
| production-equivalent testnet evidence | Genesis/release gate | absent | absent | historical drafts only | BLOCKED | AI-AUDIT-11 |
| production operations | release requirements | absent | absent | incomplete | BLOCKED | AI-AUDIT-12 |

## Files created by this audit
- `docs/audit/420AI-COMPLETE-AUDIT-20261002.md`
- `docs/audit/420AI-AUDIT-REMEDIATION-ROADMAP.md`
- `scripts/verify-420ai-audit-state.py`
- `.github/workflows/420ai-audit.yml`
- `docs/audit/420AI-AUDIT-QUALIFICATION-EVIDENCE.json`

## Outstanding blockers
1. **code** — missing canonical mature AI V1 modules.
2. **protocol dependency** — AI adapter must target current, evolving ComputeMarket interfaces, not stale recovery-branch CMP code.
3. **code/infrastructure** — provider runtime, read API/indexer and user-facing client absent.
4. **testnet** — no production-equivalent end-to-end deployment/settlement/recovery evidence.
5. **production deployment** — no complete live code-hash/ProtocolRegistry publication evidence.
6. **credentials/secrets** — provider/production service credentials are required only at live deployment stage.
7. **human/manual verification** — final security/release review remains required after exact-head technical qualification.

## Readiness state
- **CODE COMPLETE: NO** — canonical V1 modules and application/service layers are missing.
- **BUILD COMPLETE: NO** — the complete intended app cannot be built because several required components do not exist.
- **CONTRACT COMPLETE: NO** — the five frozen compatibility contracts exist, but mature V1 contract inventory is incomplete.
- **TEST COMPLETE: NO** — absent components have no executable coverage.
- **DOCUMENTATION COMPLETE: NO** — substantial docs exist, but implementation/status and dApp map are inconsistent.
- **INTEGRATION COMPLETE: NO** — no current AI-to-current-CMP adapter and full Vault/Trust path.
- **SECURITY QUALIFIED: NO** — implemented legacy surfaces have hardening evidence; the intended complete system does not.
- **TESTNET READY: NO** — missing app/runtime/integration plus no exact release-candidate deployment.
- **GENESIS READY: NO** — fixed compatibility identities are defined, but mature intended 420AI cannot yet be fully deployed/operated.
- **PRODUCTION READY: NO** — testnet, operations, monitoring, client/provider infrastructure and production evidence remain.

## Final determination
420AI on current `main` is **not genuinely complete**. The repository contains a meaningful, hardened Genesis compatibility layer and strong architectural documentation, but the canonical mature V1 architecture and Genesis contract inventory require modules and application/runtime layers that are absent. The previously attempted recovery implementation is stale and unmerged, so it cannot be counted as current implementation.

The dependency-ordered remediation path is `AI-AUDIT-1` through `AI-AUDIT-12` in `docs/audit/420AI-AUDIT-REMEDIATION-ROADMAP.md`. This audit intentionally stops short of copying stale recovery code into current main; the missing AI layer must be implemented against current ComputeMarket/Vault/Registry contracts and then qualified on one exact final head.
