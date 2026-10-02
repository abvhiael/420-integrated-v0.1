# 420Pay complete repository-grounded audit — 2026-10-01

## Audit basis

Repository: `abvhiael/420-integrated-v0.1`  
Authoritative baseline: `main` at `27ae1873edcca8fb05dec9f4e70af9832b5dafe2`  
Audit branch: `audit/420pay-complete-20261001-r3`

Repository state, frozen parameter decisions, architecture, source, tests, deployment/address authority, security policy and retained qualification records control this audit. Historical PASS records are historical only; they do not qualify a later remediation SHA.

## Canonical definition

420Pay is canonical economic protocol infrastructure for merchant invoices, deterministic payment identity/lifecycle, bounded payer-authorized settlement, merchant payout metadata, refund/accounting state, optional gas sponsorship and composition with canonical settlement/Swap.

Canonical authority boundaries:
- Pay may define invoices, payment identity/status, bounded settlement authorization and refund/accounting state.
- Pay is not Wallet signing authority, exchange price authority, bridge verifier, arbitrary custody or arbitrary spending authority.
- canonical settlement dependencies are Registry-resolved and fail closed on inactive/code-hash/version/chain/safety/health failures.
- Pay resident contracts have no frozen fixed address under the current address policy; `PaymentRouter420` and `SettlementRouter420` are explicitly Registry-resolved.

### Canonical-source conflict

`config/genesis-applications.json` is frozen but currently omits 420Pay. Other authoritative Genesis records explicitly include 420Pay: the Genesis dApp contract map, Genesis interface implementation order, security suite registry, `config/protocol.json`, frozen Pay Decisions #1–#4 and protocol architecture.

Therefore this audit can establish 420Pay as Genesis protocol infrastructure, but it cannot invent a separate mandatory standalone user application/UI. The catalogue contradiction must be resolved before final Genesis closeout.

## Canonical sources reviewed

- `docs/420PAY-GENESIS-PARAMETERS.md`
- `contracts/config/pay/420pay-parameters.json`
- `contracts/config/pay/420pay-decision-4.json`
- `contracts/config/pay/test-vectors.json`
- `docs/architecture/protocols/pay-token-exchange-bridge.md`
- `docs/architecture/GENESIS-CONTRACT-INTERFACE-LAYER.md`
- `docs/architecture/genesis-architecture.md`
- `docs/architecture/dependency-map.md`
- `contracts/config/interfaces/genesis-interface-layer.json`
- `contracts/config/interfaces/dependency-matrix.json`
- `contracts/config/genesis-dapp-contract-map.json`
- `contracts/config/security/genesis-suite-registry.json`
- `contracts/config/genesis-canonical-addresses.json`
- `contracts/config/genesis-address-namespace.json`
- `contracts/config/420pay-genesis-wiring.json`
- `contracts/config/420pay-genesis-wiring-check.md`
- `config/genesis-applications.json`
- `config/protocol.json`
- `contracts/config/security/audit-policy.json`
- `contracts/config/security/release-gates.json`
- prior 420Pay PRs #20 and #22 and retained implementation/hardening summaries.

## Repository state at audit start

| Field | Value |
|---|---|
| Repository | `abvhiael/420-integrated-v0.1` |
| Baseline | `main@d30c81cfbea7847817654b39491694a23c8701e4` |
| Working branch | `audit/420pay-complete-20261001-r3` |
| Existing open Pay remediation PR | none found |
| Prior Pay PRs | #20 and #22, merged |
| Solidity | 0.8.24 |
| EVM | Cancun |
| Contract build | Foundry |
| Pay deployment identity | Registry-resolved, no fixed Pay predeploy address |
| External audit | not complete |

## Architecture discovered

### Canonical contracts

- `MerchantRegistry420` — merchant/controller, status and versioned payout destination.
- `InvoiceRegistry420` — invoice state, domain-separated signing root, currency/mode/refund/slippage constraints, paid/closed accounting.
- `PaymentRegistry420` — deterministic payment IDs, payment state and refund lifecycle accounting.
- `PaymentRouter420` — payer/governance settlement authorization, safety/replay/fee/health/limit checks.
- `SettlementRouter420` — split validation/calculation and health helper.
- `RefundManager420` — bounded canonical refund accounting.
- `GasSponsor420` — governed sponsorship allowlist/caps/usage accounting.
- `CanonicalSettlementAdapter420` — Pay-to-canonical-Swap execution boundary.
- `CanonicalSwapHealthAdapter420` — settlement health integration.
- `PayIds420`, `ReplayDomainIds420` — component/action/replay identities.
- `AccountingCommitment420` — tax-summary commitment helper.

Shared runtime dependencies are reconciled in `contracts/config/interfaces/420pay-dependency-reconciliation.json`.

### Settlement path

The intended source path is:

`payer/governance -> PaymentRouter420 -> CanonicalSettlementAdapter420 -> CanonicalSwapExecutor420 -> canonical market/pool`.

The audit found that the baseline settlement adapter accepted any contract caller while the Swap executor trusted that adapter. This could bypass Pay’s authorization, payer limits, fee and replay checks. The audit branch fixes this by governance-binding the adapter to the exact `PaymentRouter420` and rejecting every other caller.

### Replay model

The router has local atomic payment-authorization replay state and reads shared replay state. The current Genesis wiring model additionally requires `ReplayProtectionConsumer420` and binds `PAY_SETTLEMENT` to the exact payment router. Live proof of that binding remains a deployment requirement.

## File/component inventory

| Component | Audit status | Notes |
|---|---|---|
| Pay Solidity source family | COMPLETE | substantive implementations present |
| canonical settlement adapter | COMPLETE after audit repair | baseline caller boundary was broken |
| shared replay companion | COMPLETE | source exists; live binding pending |
| focused unit/fuzz/invariant/integration tests | COMPLETE as source | exact-head execution pending |
| frozen Pay parameters/Decision #4 | COMPLETE | present and frozen |
| Pay static verifiers | COMPLETE after audit repair | audit verifier added |
| dedicated Pay audit CI | COMPLETE after audit repair | exact-head workflow added |
| dependency reconciliation | COMPLETE after audit repair | generic matrix narrowed to actual runtime use |
| Indexer Pay protocol classification | COMPLETE after audit repair | baseline omitted Pay contracts |
| Indexer Pay lifecycle semantics | COMPLETE after audit repair | baseline used nonexistent events |
| standalone Pay frontend | NOT APPLICABLE / BLOCKED ON CATALOGUE DECISION | frozen user-app catalogue omits Pay |
| dedicated Pay backend/API | NOT APPLICABLE for canonical authority | no canonical backend authority specified |
| Registry-resolved deployment descriptor/artifact set | MISSING | required before live indexing/deployment |
| deterministic deployment/wiring script | MISSING | wiring requirements exist, executable deployment package does not |
| canonical accounting-export implementation | MISSING | frozen fields exist; only tax-summary hash helper is implemented |
| executable split payout path | PARTIAL | validation/math only, no transfer path |
| GasSponsor execution/paymaster binding | PARTIAL | caps/accounting exist, reimbursement/execution boundary absent |
| offline invoice authorization semantics | COMPLETE after PAY-AUDIT-3 | Decision #4 reconciled as offline presentation/integrity plus merchant-only online canonical acceptance |
| complete payment lifecycle transition surface | COMPLETE after PAY-AUDIT-3 | explicit governed INCLUDED/CERTIFIED/FINALIZED/SETTLED/FAILED paths with invalid-transition rejection |
| production-equivalent testnet evidence | BLOCKED | no live candidate evidence |
| independent external security audit | BLOCKED | mandatory mainnet gate not complete |

## Smart-contract audit

### Verified/mitigated behavior

- resident and dependency Registry code-hash/lifecycle/version checks fail closed;
- governance configuration uses the canonical timelock/authority boundary;
- payer-originated settlement cannot be replaced by arbitrary non-payer contract authority;
- quote freshness, settlement-asset eligibility, market health and canonical fee quote are checked;
- payer maximum input/gas/slippage/tip/conversion/protocol-fee bounds are checked;
- Pay protocol fee is fixed to zero in the current version;
- local settlement replay is consumed before external execution and rolls back atomically on failure;
- settlement adapter quote replay is atomic;
- merchant underpayment and payer overspend are postcondition failures;
- split math conserves value and assigns integer remainder deterministically to the primary recipient;
- refund accounting cannot exceed canonical settlement plus tip;
- GasSponsor enforces operation allowlist and wallet/merchant/global limits;
- no Pay source uses `tx.origin`, `delegatecall` or `selfdestruct`.

### Security finding repaired — adapter authority bypass

**Baseline classification: unresolved high-impact authorization boundary.**  
The trusted `CanonicalSettlementAdapter420` required only that the caller contain code. Any unrelated contract could call it directly, reaching the trusted Swap executor without `PaymentRouter420`’s payer/governance authorization, payer limits, fee validation or payment replay boundary.

**Audit remediation:** adapter now stores a governance-configured `paymentRouter`, requires `msg.sender == paymentRouter`, emits binding changes, and has an adversarial direct-call regression test. Genesis wiring checks now require the exact adapter/router relationship.

### Unresolved contract/application gaps

1. **Offline invoice authorization — RESOLVED in PAY-AUDIT-3.** Decision #4's offline creation and online acceptance flags are applied together: the signing root is an offline presentation/integrity commitment, while canonical invoice state is created only by the bound merchant online through `createInvoice`. No unversioned signature/relayer authority is invented.
2. **Payment lifecycle — RESOLVED in PAY-AUDIT-3.** Explicit governed transitions now make INCLUDED, CERTIFIED, SETTLED and FAILED reachable with fail-closed predecessor rules; retained finalization semantics remain compatible and refund states continue through the bounded refund path.
3. **Split settlement — PARTIAL.** `SettlementRouter420` calculates/validates splits only. It never transfers and never emits its declared settlement events.
4. **Gas sponsorship — PARTIAL.** usage/cap accounting exists, but the contract does not itself pay a relayer/paymaster or debit its balance when `recordSponsored` is called. The execution/reimbursement authority must be frozen before implementing it.
5. **Accounting exports — MISSING.** Genesis parameters require export fields; no canonical export DTO/service was found.
6. **Live shared replay — BLOCKED.** source support exists, but exact Registry deployment and domain-consumer binding are not live-verified.

## Integration audit

| Dependency/surface | Status | Evidence/result |
|---|---|---|
| ProtocolRegistry | COMPLETE in source | all residents/dependencies are Registry/code-hash checked |
| Governance | COMPLETE in source | governed configuration through Genesis authority |
| Pause/SystemSafety/ChainContext | COMPLETE in source | fail-closed operational gates |
| canonical asset/capabilities | COMPLETE in source | settlement eligibility required |
| SettlementHealth | COMPLETE in source | asset/market health gates |
| FeeQuote | COMPLETE in source | fee identity/expiry validated |
| ReplayProtection | PARTIAL | read + mutable companion source; live binding pending |
| MetadataCommitment | COMPLETE in source | optional invoice metadata commitment checked |
| 420Swap | COMPLETE in source after audit repair | canonical adapter/executor boundary; live wiring pending |
| 420Bridge | NOT APPLICABLE to Pay authority | no bridge verification authority is delegated to Pay |
| Identity/Names | OPTIONAL presentation/policy inputs | no current runtime authority dependency |
| CapabilityRegistry | NOT APPLICABLE in current Pay authorization | direct payer/governance path |
| CustodyVault | NOT APPLICABLE in current Pay core | Pay records refund/accounting; no arbitrary custody release |
| 420Indexer | COMPLETE after audit repair at source | canonical event model repaired; deployment descriptors pending |
| Wallet | PARTIAL / catalogue-dependent | Wallet signing is external authority; no canonical dedicated Pay UI requirement is frozen |
| Notifications/Analytics/Explorer/Search | PARTIAL derived integration | generic protocol/event surfaces exist; live Pay descriptor/deployment evidence pending |

## Build/test system audit

- Solidity compiler target: 0.8.24.
- EVM target: Cancun.
- Foundry configuration includes deterministic fuzz seeds and invariant profiles.
- generic Solidity PR workflow deliberately skips `audit/*` branches; therefore this audit adds `.github/workflows/420pay-audit.yml`.
- the dedicated workflow verifies the exact checked-out SHA, runs Pay static verifiers, formatting, focused builds, Pay unit/fuzz/invariant/integration suites, forbidden-primitive scan, and Indexer build/tests.
- historical implementation/hardening summaries contain earlier successful Foundry/integrated/Genesis qualification; they are not exact-head evidence for this branch.

## Documentation audit

Present:
- frozen Genesis parameter document;
- protocol architecture including Pay authority and invariants;
- hardening/implementation status documents;
- troubleshooting for payment uncertainty, quote expiry and value-risk retry behavior;
- shared security/audit policy;
- Genesis wiring requirements.

Audit corrections/additions:
- stale implementation/hardening status reconciled;
- wiring document now requires adapter->router binding;
- machine-readable dependency reconciliation added;
- complete audit report and remediation roadmap added;
- exact-head audit CI/verifier added.

Still missing:
- split execution architecture;
- GasSponsor relayer/paymaster execution model;
- accounting-export implementation/operator reference;
- deterministic deployment/Registry publication runbook and artifacts;
- live testnet operations/recovery evidence;
- external-audit report/remediation record.

## Genesis/deployment readiness

420Pay resident components are intentionally Registry-resolved, not frozen-address predeploys. That policy is internally consistent and must be preserved.

Genesis activation still lacks:
- retained exact runtime artifacts/code hashes for the complete Pay deployment;
- executable deterministic deployment/order/constructor manifest;
- ProtocolRegistry publication descriptors for all deployed Pay components;
- exact adapter->router, adapter->executor, executor trusted-caller and replay-domain live evidence;
- final governance/timelock handoff evidence;
- production-equivalent smoke/reorg/recovery evidence;
- resolution of PAY-AUDIT-4 functional gaps and the Genesis application catalogue contradiction.

## Requirement matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| merchant registry/status/payout versioning | Pay parameters/Decision #4 | implemented | focused tests | architecture | COMPLETE | live deployment evidence |
| invoice currencies/modes/expiry/refund/slippage | frozen Pay parameters | implemented | fuzz/focused | present | COMPLETE | exact-head run |
| domain-separated invoice root | Decision #4 | implemented | root-binding tests | present | COMPLETE | retain |
| offline invoice creation | Decision #4 | merchant-only online canonical acceptance; offline root is presentation/integrity commitment | authority regression | clarified | COMPLETE | retain until versioned authorization change |
| payment ID domain/fields/nonce | Decision #4 | implemented | focused tests | present | COMPLETE | exact-head run |
| payment lifecycle states | protocol architecture | explicit governed transitions implemented | PAY-AUDIT-3 lifecycle regression | present | COMPLETE | Level 1 exact-head qualification |
| payer/governance settlement authorization | authority map | implemented | negative/reentrancy | present | COMPLETE | exact-head run |
| quote lifetime 42s | frozen parameters | implemented | boundary tests | present | COMPLETE | exact-head run |
| max default slippage 42 bps | frozen parameters | implemented | limits/fuzz | present | COMPLETE | exact-head run |
| canonical fee quote/fail-closed health | protocol architecture | implemented | stale/unhealthy tests | present | COMPLETE | exact-head run |
| protocol fee zero | frozen/current architecture | implemented | invariant/unit | present | COMPLETE | retain |
| payment replay protection | interface architecture | local + shared read/mutable companion | replay tests | wiring docs | PARTIAL | live domain binding proof |
| adapter cannot bypass PaymentRouter | authority map | audit fixed | adversarial test added | wiring updated | COMPLETE | exact-head run |
| canonical Swap trusted boundary | Pay/Swap architecture | source implemented | integration tests | present | PARTIAL | live exact-instance wiring proof |
| atomic settlement rollback | protocol architecture | implemented | failure rollback tests | present | COMPLETE | exact-head run |
| payer max spend / merchant minimum | Decision #4/value invariants | implemented | focused/integration | present | COMPLETE | exact-head run |
| split <=8 / 10000 bps / primary remainder | Decision #4 | math/validation implemented | fuzz/invariant | present | COMPLETE | retain |
| executable split payment | frozen split-settlement requirement | no transfer path | none | insufficient | PARTIAL | architecture decision + implementation |
| refund accounting bounded | Pay parameters/authority map | implemented | focused/fuzz | present | COMPLETE | live integration |
| refund arbitrary custody authority prohibited | authority map | no arbitrary custody path | n/a | present | COMPLETE | retain |
| GasSponsor allowlist/caps | Pay parameters | implemented | limit tests | present | COMPLETE | exact-head run |
| GasSponsor actual execution/reimbursement | sponsorship purpose | accounting only | integration accounting only | insufficient | PARTIAL | bind canonical relayer/paymaster execution |
| accounting export fields | frozen parameters | no exporter found | absent | fields listed only | MISSING | schema/exporter/reconciliation |
| Registry discovery/no invented fixed Pay address | address policy | implemented policy | address verifiers | present | COMPLETE | deployment descriptors |
| shared dependency matrix | frozen interface layer | generic row overstates runtime dependencies | audit reconciliation added | audit record | COMPLETE | exact-head verifier |
| Indexer Pay classification | derived-service architecture | audit fixed | regression | audit report | COMPLETE | exact-head run/live descriptor |
| Indexer lifecycle uses real Pay events | contract ABI | audit fixed | regression | audit report | COMPLETE | exact-head run |
| standalone frontend | Genesis app inventory vs other Pay records | canonical requirement contradictory | absent | contradictory | BLOCKED | reconcile frozen catalogue before deciding |
| deterministic deployment package | Genesis release model | not found | absent | wiring prose only | MISSING | PAY-AUDIT-6 |
| production-equivalent testnet | release policy | not deployed/evidenced | absent | blocked | BLOCKED | PAY-AUDIT-7 |
| external independent audit | security policy | not complete | n/a | policy present | BLOCKED | PAY-AUDIT-8 |

## Security classification

**Verified safe behavior / mitigated:** resident/dependency code-hash gates; governed configuration; payer authorization; quote/health/fee limits; atomic replay; underpayment/overspend checks; refund bounds; split conservation; sponsorship caps; audit-fixed adapter caller boundary.

**Accepted design risk:** governance can reconfigure Pay dependencies under the canonical timelock/authority model; Swap execution depends on the canonical market/pool implementation and allowances/custody policy outside Pay.

**Unresolved:** executable split semantics, actual gas-sponsor reimbursement authority, missing accounting exporter, live exact-instance wiring, and no independent audit of the frozen candidate.

## Readiness state after source-head qualification

- CODE COMPLETE: **NO overall** — PAY-AUDIT-3 is implemented; PAY-AUDIT-4/6 functional/deployment gaps remain.
- BUILD COMPLETE: **YES for the implemented source surface** — exact-head `79e3bc85f3f2de1778e0200b7eb5dc7895e699f8` passed the dedicated Pay build/qualification workflow and generic Solidity workflow. Overall application completion remains NO because PAY-AUDIT-4/6 are unresolved.
- CONTRACT COMPLETE: **NO overall** — PAY-AUDIT-3 invoice/lifecycle semantics are resolved; split/sponsorship/accounting work remains.
- TEST COMPLETE: **NO overall** — the implemented PAY-AUDIT-1/2/5 source surface passed exact-head qualification, but PAY-AUDIT-4/6 functionality remains incomplete or missing and therefore cannot yet be fully tested.
- DOCUMENTATION COMPLETE: **NO** — unresolved semantics and deployment/operator material remain.
- INTEGRATION COMPLETE: **NO** — live Registry/Swap/replay/Indexer deployment binding is absent.
- SECURITY QUALIFIED: **NO overall** — the repaired PAY-AUDIT-2 source boundary passed exact-head CI, but live deployment qualification and the required independent audit remain outstanding.
- TESTNET READY: **NO** — deployment package and live candidate evidence are absent.
- GENESIS READY: **NO** — functional/deployment/catalogue blockers remain.
- PRODUCTION READY: **NO** — testnet, external audit, deployment, monitoring and closeout remain.

## Durable source qualification evidence

The remediation source head `79e3bc85f3f2de1778e0200b7eb5dc7895e699f8` passed both required repository workflows:

- 420Pay audit qualification run #59, run ID `36965952679`: **SUCCESS**.
- Solidity Contracts run #4003, run ID `36965952612`: **SUCCESS**.

The dedicated Pay run passed exact-head verification, static Pay verification, Solidity formatting, the Pay/settlement-boundary build, focused 420Pay Solidity qualification, the forbidden-primitive scan, and the 420Indexer Pay reconciliation build/tests. This evidence qualifies PAY-AUDIT-1, PAY-AUDIT-2 and PAY-AUDIT-5 at the source head. Their durable COMPLETE state is conditioned on the bookkeeping commit carrying this evidence also passing the dedicated exact-head Pay workflow; that run is attached to the commit itself, avoiding a self-referential evidence-SHA mutation.

## Final determination

420Pay is a substantial real protocol implementation, but the baseline was **not genuinely complete**.

This audit repaired two concrete repository defects without changing the frozen architecture:
1. the trusted settlement adapter’s caller-authority bypass; and
2. 420Indexer’s fabricated/stale Pay lifecycle event model.

It also reconciled stale status/dependency/wiring records and added dedicated exact-head qualification.

The remaining gaps are material and must not be converted into green status by documentation alone. The dependency-ordered continuation is `docs/audit/420PAY-AUDIT-REMEDIATION-ROADMAP.md`.
