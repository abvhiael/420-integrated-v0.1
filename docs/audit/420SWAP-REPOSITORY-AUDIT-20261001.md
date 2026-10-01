# 420Swap complete repository audit — 2026-10-01

## Scope and authority

Application: **420Swap**

Repository: `abvhiael/420-integrated-v0.1`

Audit baseline: `main` at `6d2a4025e74fde11c70a141bbc7b17180204cbc4`

Audit branch: `audit/420swap-complete-20261001`

Pull request: **#455**

Repository truth, frozen Genesis application decisions, address/namespace authority, architecture, source, committed tests and exact-head CI evidence control this audit. Conversational history is non-authoritative.

## Canonical definition

The frozen Genesis application catalogue classifies **420 Swap** as `GENESIS_PROTOCOL_AND_USER_APP`, with contracts required, for the purpose **“Canonical native DEX and 420/approved-stable market.”**

Current architecture further defines 420 Swap as the canonical liquidity/execution layer beneath 420 Exchange. Exchange may qualify assets and markets, route bounded trades and provide the user-facing execution experience, but it does not replace Swap's canonical execution semantics.

Canonical Swap responsibilities found in repository authority are therefore:

- canonical market and quote-asset identity;
- canonical pool registration and executable liquidity;
- bounded exact-input swap execution with minimum-output protection;
- shared operational/safety and market-health enforcement;
- protocol-qualified versus permissionless market separation;
- TWAP/reference observation support;
- public batch-auction support associated with the Genesis DEX/distribution system;
- integration with Pay, Exchange, Wallet/authorization, Registry, Bridge/oracle and indexing surfaces;
- Genesis system/predeploy authority where frozen, with registry resolution for the canonical executor.

## Architecture discovered

### Canonical protocol contracts

`contracts/src/swap/` contains:

- `SwapIds420.sol`
- `GenesisDEXFactory.sol`
- `CanonicalMarketRegistry.sol`
- `PermissionlessDEXFactory.sol`
- `TWAPOracle.sol`
- `PublicBatchAuction.sol`
- `ApprovedQuoteAssetRegistry.sol`
- `CanonicalSwapExecutor420.sol`
- `CanonicalConstantProductPool420.sol`

The obsolete `CanonicalPool420.sol` scaffold existed at audit baseline but was superseded by `CanonicalConstantProductPool420.sol`. It has been removed in this audit.

### Execution path

The implemented canonical ERC20/ERC20 path is:

1. a caller/adapter invokes `CanonicalSwapExecutor420`;
2. the executor enforces shared operational state, trusted-caller policy, canonical settlement asset, market health and canonical market identity;
3. it resolves the registered pool through `CanonicalMarketRegistry`;
4. the pool enforces immutable executor-only swap access, exact input pull, minimum output, constant-product pricing, fee application, reserve synchronization and balance-delta checks;
5. the executor rejects accepted results that overspend input or under-deliver settlement.

### User-facing surface

There is no separate `420swap/` web application. The actual repository user surface is integrated into `exchange/web`, including swap quote intake, reviewed execution, wallet/session handling, preflight, browser-wallet execution and live swap qualification.

This is consistent with the architecture that places Exchange above Swap, but the docs should continue to make the distinction explicit: **Swap owns canonical liquidity/execution; Exchange provides the composed trading UX and routing layer.**

### Genesis/address model

Frozen system-address records retain:

- `GenesisDEXFactory` at `0x...042b`
- `PublicBatchAuction` at `0x...042c`
- `TWAPOracle` at `0x...042d`
- `ApprovedQuoteAssetRegistry` at `0x...0439`

`CanonicalSwapExecutor420` is explicitly registry-resolved with no fixed Genesis address.

The production candidate pool is an implementation/deployment component, not a newly frozen discovery-authority address.

## File inventory

| Component | Baseline | Audit state | Status | Notes |
|---|---|---|---|---|
| Swap component/action IDs | present | unchanged | COMPLETE | canonical IDs exist |
| Genesis DEX factory | present | registration-only semantics frozen and tested | COMPLETE | governance registry for already-deployed canonical pools; no CREATE/CREATE2 path |
| canonical market registry | present | unchanged | COMPLETE | canonical market/pair/pool records |
| permissionless factory | present | registration lifecycle hardened | COMPLETE | registration-only; exact pair introspection/codehash provenance; duplicate pool-address rejection; open same-pair variants |
| TWAP oracle | present | canonical cumulative-source TWAP hardened | COMPLETE source-side | canonical pool cumulative pricing, bounded window/freshness, source identity, Exchange reference interface and 420Oracle adapter fail-closed reads |
| public batch auction | present | economic lifecycle completed | COMPLETE source-side | pre-funded native inventory, canonical quote escrow, governed clearing price, deterministic fills/refunds/claims, cancellation recovery and accounting/replay protection |
| approved quote asset registry | present | unchanged | COMPLETE | shared canonical settlement checks applied |
| canonical swap executor | present | unchanged | COMPLETE | shared safety/health/trusted caller/postconditions |
| constant-product pool | present | added to canonical inventory | COMPLETE for V1 ERC20/ERC20 scope | production candidate with dedicated tests |
| old `CanonicalPool420` | stale scaffold | removed | STALE → REMEDIATED | no executable consumer remained |
| Swap interface verifier | stale | strengthened | COMPLETE | now requires production pool and rejects old scaffold |
| Genesis dApp map | stale | reconciled | COMPLETE | production pool now included |
| app-specific docs | present | contract page expanded | PARTIAL | user/developer/security docs exist; deployment/operations still incomplete |
| dedicated Swap CI | absent | added | COMPLETE | contract + Exchange user-surface qualification |
| deterministic deployment artifacts | absent | absent | MISSING | no retained Swap artifacts under `contracts/artifacts/` |
| materialized Swap predeploy state | not found | not found | MISSING | predeploy plan still `SOURCE_READY` |

## Smart-contract audit

### CanonicalConstantProductPool420

Verified design properties from source:

- immutable token pair, executor and fee;
- fee capped at 1%;
- non-reentrant liquidity and swap paths;
- exact-balance pull/push checks reject fee-on-transfer/rebasing behavior;
- initial permanently locked minimum liquidity;
- proportional share accounting;
- executor-only swap entry point;
- exact-input swap semantics;
- caller-provided minimum output;
- actual reserve synchronization after transfers;
- no owner, arbitrary reserve setter, confiscation function or mutable fee.

Known V1 limitations are explicitly documented: no concentrated liquidity, multi-hop aggregation inside the pool, native-value path inside this pool, transferable LP token, mutable fee governance or protocol-fee extraction.

### CanonicalSwapExecutor420

Verified source guarantees:

- shared operational fail-closed check;
- explicit trusted caller allowlist;
- canonical settlement-asset check;
- shared market-health check;
- canonical market registry resolution;
- market/pair match;
- pool code existence;
- payer/recipient and amount validation;
- input overspend rejection;
- settlement under-delivery rejection.

### CanonicalMarketRegistry / ApprovedQuoteAssetRegistry

Governance mutation is routed through shared Genesis governance authorization. Market registration also uses shared operational safety and validates code-bearing pools, nonzero distinct assets and non-NONE roles.

Quote assets must pass the shared canonical-settlement-asset boundary before approval/canonical assignment.

### GenesisDEXFactory

SWAP-AUDIT-2 resolves the prior ambiguity: **GenesisDEXFactory is canonically registration-only**.

Repository history, architecture and integration evidence define governance registration of already-deployed code-bearing pools, and no canonical source defines an on-chain CREATE/CREATE2 lifecycle. The contract now exposes `REGISTRATION_ONLY = true`, documents that `poolImplementation` is the approved deployment/provenance reference rather than a runtime-codehash equality gate, and retains one-shot governance registration under shared operational safety.

Concrete pool deployment therefore belongs to the qualified deployment process. After deployment and verification, Genesis governance registers the exact pool address here; canonical market activation remains a separate `CanonicalMarketRegistry` action.

Introducing CREATE/CREATE2 semantics would add salt, initialization, provenance and upgrade policy not authorized by the frozen Swap architecture and therefore requires a future explicit canonical decision rather than inference from the contract name.

### PermissionlessDEXFactory

SWAP-AUDIT-3 resolves the permissionless lifecycle ambiguity: **permissionless market formation is open to anyone, while the protocol contract is registration-only**.

The frozen `creation: ANYONE` tier policy means any user may deploy a compatible pool outside the factory and then register that existing instance. The factory does not CREATE/CREATE2 pools and does not confer canonical status, oracle eligibility, Wallet-default eligibility, public-distribution eligibility or protocol endorsement.

Registration now:

- requires a nonzero unused `poolId` and a code-bearing pool;
- verifies the submitted token pair against the pool's own `token0()` / `token1()` getters using static introspection;
- re-derives and records the exact current runtime code hash instead of trusting caller-supplied provenance alone;
- rejects a second registration of the same pool address under another ID;
- preserves permissionless same-pair variants by allowing distinct pool addresses for the same token pair;
- remains fail-closed under resident lifecycle, chain-version, pause and shared system-safety controls.

`poolImplementation` and its deployment-time code hash are retained as a reference implementation/provenance anchor, not as a protocol endorsement or runtime equality requirement for every permissionless pool. This is necessary because concrete pools can embed immutable pair/executor/fee values in runtime bytecode.

Registration records are immutable. Promotion into the canonical tier does not occur through this contract; canonical status remains a separate `CanonicalMarketRegistry` governance action.

### TWAPOracle

SWAP-AUDIT-4 replaces arbitrary governance-published price observations with a canonical on-chain cumulative-price TWAP.

`CanonicalConstantProductPool420` now maintains token0/token1 cumulative reserve prices across reserve-changing syncs. `TWAPOracle` resolves the active market through the Registry-backed `CanonicalMarketRegistry`, validates the exact pool/pair/code/metadata source, and derives a normalized quote-per-base Q96 time-weighted price from cumulative deltas.

Governance controls only market policy: minimum observation window, maximum observation window, maximum staleness and enabled state. Governance cannot inject a price. Checkpointing is permissionless because no caller-supplied price exists.

The first checkpoint seeds a baseline. A later checkpoint creates an observation only when the elapsed window is within configured bounds. Overlong gaps reseed and invalidate the old observation. A canonical source identity change immediately invalidates the old observation on security-sensitive reads, even before another checkpoint.

`readObservation` exposes price, timestamp, expiry, explicit window, confidence, source hash and health. It fails closed for disabled, unavailable, stale or source-mismatched state. `referencePrice` exposes the exact provider-neutral interface consumed by `ExchangeOracleGuard420`. `TWAPOracleSourceAdapter420` consumes `readObservation` rather than the raw compatibility getter, so 420Oracle cannot bypass Swap-side freshness/source checks.

The single-pool TWAP intentionally reports confidence `0`; 420Oracle may combine it with independent sources and apply quorum/confidence/deviation policy. Exchange continues to use the reference only as a circuit breaker, never as executable-price authority.

### PublicBatchAuction

SWAP-AUDIT-5 resolves the prior record-only gap as a **real public-distribution economic lifecycle**.

Repository authority does not support reclassifying the frozen `0x...042c` component as a logging-only registry: its frozen purpose is `daily batch auction`, it is paired with `PublicDistributionVault` (`public distribution inventory`), and the architecture states that the canonical gateway-backed stable settlement asset is used by the public-distribution system.

The completed contract:

- cannot mint native 420 and requires inventory to be pre-funded before opening;
- reserves exact native inventory across concurrent auctions and caps one auction at 100,000 native 420, matching the PublicDistributionVault daily release bound;
- permits only a quote asset currently marked `CANONICAL` by `ApprovedQuoteAssetRegistry`;
- replaces governance-recorded synthetic bids with permissionless user escrow through `bid`;
- uses exact quote-token balance-delta checks and rejects non-exact token behavior;
- preserves the repository's existing governance-set clearing-price authority because no canonical price ladder or autonomous clearing algorithm exists to replace it;
- settles undersubscribed auctions only for actual demand and immediately unreserves unsold native inventory;
- settles oversubscribed auctions with deterministic pro-rata native allocation by escrowed quote amount;
- uses pull-based one-shot claims so settlement never loops over an unbounded bidder set;
- conserves each bidder's escrow as exact `quoteSpent + quoteRefund`;
- routes only actual quote proceeds to the declared proceeds recipient;
- provides governance cancellation before settlement, immediately releasing native reservations while preserving complete bidder refunds;
- keeps cancellation/claims available under the shared `SAFE_WHEN_PAUSED` recovery path so emergency controls do not trap escrowed user value;
- releases any final native rounding remainder after the final bidder claim.

The clearing-price decision remains an explicit governance/operations evidence boundary. SWAP-AUDIT-5 does not invent an unsupported on-chain price-discovery algorithm. Live PublicDistributionVault→auction funding provenance and deployed-instance verification remain later deployment/testnet qualification work.

## Integration audit

| Dependency | Repository evidence | Status |
|---|---|---|
| 420Registry | Genesis-resident components resolve shared dependencies; executor is registry-resolved | COMPLETE/PARTIAL deployment |
| shared Genesis interface layer | executor/registries consume canonical asset, health, governance and safety semantics | COMPLETE |
| 420Pay | canonical settlement adapter calls exact Swap executor ABI; integration tests exist | COMPLETE in source/tests; BLOCKED live binding |
| 420Exchange | canonical Swap adapter and full web swap execution surface exist | COMPLETE in source/tests; BLOCKED live deployment |
| 420Wallet / authorization | Exchange web binds execution to wallet review/session/preflight; capability architecture exists above Swap | COMPLETE in client scope; live chain pending |
| 420Bridge | Pay/Swap/Bridge integration test exists; CADC canonical route pending issuer-approved deployment | PARTIAL/BLOCKED external |
| Oracle layer | canonical Swap cumulative TWAP + fail-closed 420Oracle adapter + Exchange reference guard integration | COMPLETE source-side; live deployment qualification pending |
| 420Indexer | Swap/Exchange decoder/ABI surfaces exist | PARTIAL; live chain qualification pending |
| native $420 | Exchange has wrapped/native execution architecture; canonical pool itself is ERC20/ERC20 | PARTIAL by layer; intentional V1 pool limit |

The committed Pay→Swap wiring manifest correctly remains `REMEDIATION_REQUIRED` for deployment binding: source ABI compatibility is verified, but the exact deployed `PaymentRouter → CanonicalSettlementAdapter → CanonicalSwapExecutor` instances and executor trusted-caller relation are not yet live-chain verified.

## Application-layer audit

The user-facing Swap experience is implemented through `exchange/web`, not a duplicate Swap frontend.

Observed components include:

- read-only quote intake/review;
- canonical execution-input binding;
- wallet session and chain/account validation;
- preflight;
- reviewed execution bridge;
- guarded swap orchestration;
- transaction lifecycle/reconciliation;
- browser wallet UI;
- live swap qualification harness;
- runtime configuration;
- dedicated tests.

On audit CI before final closeout, `npm run check` passed and **261/261 Node tests passed**. Production-mode build correctly failed closed without deployment environment; audit qualification uses the repository-supported `EXCHANGE_DEPLOYMENT_MODE=qualification` path instead of inventing production addresses.

No independent Swap backend/database is canonically required for settlement authority. Derived market data, quote services and indexing live in Exchange/indexer/service layers and must not become canonical accounting authority.

## Build and test audit

Baseline relevant suites found:

- `CanonicalConstantProductPool420.t.sol`
- `SwapGenesisIntegration420.t.sol`
- `SwapFuzz420.t.sol`
- `SwapInvariant420.t.sol`
- `SwapTWAPOracle420.t.sol`
- `SwapPublicBatchAuction420.t.sol`
- `PaySwapGenesisIntegration420.t.sol`
- `PaySwapBridgeGenesisIntegration420.t.sol`
- Exchange web swap/security/execution/browser-wallet tests
- repository-wide Solidity workflow

Audit remediation added `.github/workflows/swap-audit.yml` to run app-scoped static verification, targeted Foundry build/tests and the Exchange web check/test/qualification build.

### SWAP-AUDIT-2 retained Level 1 evidence

- roadmap step: **SWAP-AUDIT-2 — GenesisDEXFactory production semantics**
- qualification level: **Level 1 — per-roadmap-step fast qualification**
- canonical decision: **REGISTRATION_ONLY**
- implementation SHA: `bdfd51b13f3182a5d9e9d83ef4f1a1956b67673d`
- current `main` at qualification closeout: `cdd5f58f20a3673bb9a81c6210be2a3019e22380`
- audit PR / branch: **#455** / `audit/420swap-complete-20261001`
- authoritative successful workflow: **420Swap Audit Qualification**, PR run **36927740418**
- contract job **110589128130**: static verification PASS; targeted build PASS; Genesis DEX factory tests PASS; canonical pool PASS; Swap integration PASS; fuzz PASS; invariant PASS; Pay/Swap integration PASS
- user-surface job **110589128277**: `npm run check` PASS; Node tests PASS; qualification build PASS
- diagnosed non-protocol failure: prior run **36927652559** failed because the verifier matched the explanatory word `CREATE2` inside a comment; the verifier was corrected to inspect executable deployment patterns and the exact new SHA was requalified
- security/adversarial coverage: invalid IDs, non-code pools, duplicate registration, shared pause, system-safety denial, governance denial, non-timelock mutation and invalid implementation reference all fail closed
- Level 2: **deferred**; the natural market-formation milestone is after SWAP-AUDIT-3 when Genesis and permissionless lifecycle semantics converge
- Level 3: **intentionally deferred** to complete app-phase closeout; no repository-wide full Foundry/Genesis/global duplication was run for this ordinary step
- blockers for this step: **none**
- completion state: **COMPLETE**
- next canonical roadmap step: **SWAP-AUDIT-3 — permissionless pool lifecycle hardening**

### SWAP-AUDIT-3 retained Level 1 + market-formation Level 2 evidence

- roadmap step: **SWAP-AUDIT-3 — permissionless pool lifecycle hardening**
- qualification level: **Level 1 — per-roadmap-step fast qualification**, plus **Level 2 — market-formation app integration milestone**
- canonical decision: **ANYONE MAY DEPLOY EXTERNALLY; PermissionlessDEXFactory IS REGISTRATION_ONLY**
- implementation SHA: `9e84b2820ba755279c865a1d927ba4011c30ac5e`
- current `main` at qualification closeout: `646555a2e7a52c3fc9e2e6d4adb078474ffd769e`
- audit PR / branch: **#455** / `audit/420swap-complete-20261001`
- authoritative successful workflow: **420Swap Audit Qualification**, PR run **36929040518**
- contract job **110594033574**: static verification PASS; targeted build PASS; Genesis DEX factory PASS; Permissionless DEX factory PASS; canonical pool PASS; Swap integration PASS; fuzz PASS; invariant PASS; Pay/Swap integration PASS
- user-surface job **110594033903**: `npm run check` PASS; Node tests PASS; qualification build PASS
- permissionless lifecycle coverage: exact pair introspection, caller-supplied codehash spoof rejection, non-introspectable pool rejection, duplicate pool-ID rejection, duplicate pool-address rejection, distinct same-pair pool acceptance, pause/system-safety fail-closed behavior, resident lifecycle rejection, invalid identifiers/tokens/non-code pools, and non-governance permissionless caller registration
- configuration/UX reconciliation: frozen `creation: ANYONE` preserved; explicit `DEPLOY_EXTERNALLY_THEN_REGISTER_EXISTING_POOL` lifecycle recorded; warning now distinguishes user deployment/registration from protocol endorsement
- Level 2 milestone: **PASS on the same exact implementation SHA**; SWAP-AUDIT-2 Genesis registration lifecycle and SWAP-AUDIT-3 permissionless lifecycle now converge under the retained full Swap app suite without duplicating CI
- Level 3: **intentionally deferred** to complete app-phase closeout; current-main reconciliation and repository-wide canonical Solidity/Genesis/global qualification are not required for this ordinary milestone
- blockers for this step: **none**
- completion state: **COMPLETE**
- next canonical roadmap step: **SWAP-AUDIT-4 — TWAP/oracle production hardening**

### SWAP-AUDIT-4 retained Level 1 + oracle-integration Level 2 evidence

- roadmap step: **SWAP-AUDIT-4 — TWAP/oracle production hardening**
- qualification level: **Level 1 — per-roadmap-step fast qualification**, plus **Level 2 — oracle-integration app milestone**
- canonical source decision: **TWAP derives from the active canonical Swap pool cumulative price; no arbitrary governance price publication**
- implementation SHA: `030db1088b8bf6fef5af92b7345c2d6472839dd1`
- current `main` at qualification closeout: `98e545225d54379086f0c520afcb84b4d4d97288`
- audit PR / branch: **#455** / `audit/420swap-complete-20261001`
- authoritative successful workflow: **420Swap Audit Qualification**, PR run **36936255486**
- contract job **110617414850**: static verification PASS; targeted build PASS; Genesis factory PASS; permissionless factory PASS; TWAP/oracle integration PASS; canonical pool PASS; Swap integration PASS; fuzz PASS; invariant PASS; Pay/Swap integration PASS
- user-surface job **110617414540**: `npm run check` PASS; Node tests PASS; qualification build PASS
- authoritative source: Registry-resolved active `CanonicalMarketRegistry` market and its exact code-bearing pool/pair/metadata identity
- observation semantics: pool cumulative token0/token1 price accounting; configurable minimum/maximum observation windows; token-decimal normalization; explicit source hash/window/expiry
- publication authority: governance configures policy only; `checkpoint` is permissionless and derives price entirely from canonical on-chain state
- stale/source behavior: stale reads revert; source changes invalidate prior observations immediately; overlong gaps reseed and clear prior observations
- manipulation resistance: TWAP uses cumulative time-weighted reserve prices across reserve changes rather than terminal spot sampling; minimum window is explicit and enforced
- Exchange integration: real `TWAPOracle.referencePrice` satisfies `ExchangeOracleGuard420`; stale and excessive-deviation paths fail closed
- 420Oracle integration: `TWAPOracleSourceAdapter420` consumes fail-closed `readObservation`, includes source/window/expiry in provenance hash and retains explicit confidence `0`
- CI optimization: Swap workflow concurrency now keys push and pull-request runs to the same branch, eliminating duplicate exact-head app qualification
- Level 2 milestone: **PASS on the same exact implementation SHA**; retained Swap + Exchange user-surface qualification and direct 420Oracle adapter integration close the cross-component oracle boundary without repository-wide duplication
- Level 3: **intentionally deferred** to complete app-phase closeout
- blockers for this step: **none**
- completion state: **COMPLETE**
- next canonical roadmap step: **SWAP-AUDIT-5 — PublicBatchAuction completion**

### SWAP-AUDIT-5 retained Level 1 + source-economics Level 2 evidence

- roadmap step: **SWAP-AUDIT-5 — PublicBatchAuction completion**
- qualification level: **Level 1 — per-roadmap-step fast qualification**, plus **Level 2 — source-economics app milestone**
- canonical decision: **REAL PUBLIC-DISTRIBUTION AUCTION; GOVERNANCE-SET CLEARING PRICE RETAINED**
- implementation SHA: `ac109e7fbdc50113e744caecf812d4e7c60f76fb`
- current `main` at qualification closeout: `98e545225d54379086f0c520afcb84b4d4d97288`
- audit PR / branch: **#455** / `audit/420swap-complete-20261001`
- authoritative successful workflow: **420Swap Audit Qualification**, PR run **36940146723**
- contract job **110629941036**: static verification PASS; targeted build PASS; Genesis DEX factory PASS; permissionless DEX factory PASS; TWAP/oracle integration PASS; **Public batch auction PASS**; canonical pool PASS; Swap integration PASS; fuzz PASS; invariant PASS; Pay/Swap integration PASS
- user-surface job **110629941435**: `npm run check` PASS; Node tests PASS; qualification build PASS
- custody/accounting coverage: exact canonical quote escrow, non-exact-token rejection, explicit native reservation, undersubscription unsold release, oversubscription pro-rata fill, exact proceeds, quote refunds, final reservation reconciliation
- replay/failure coverage: early/late bid rejection, early/duplicate settlement rejection, one-shot claims, governance-only settle/cancel, cancellation/full-refund recovery, local-pause bid rejection with safe paused claims
- authority boundaries: auction never mints native 420; PublicDistributionVault remains inventory source authority; ApprovedQuoteAssetRegistry remains canonical quote authority; governance retains only the pre-existing clearing-price decision and cannot bypass settlement accounting
- diagnosed failures before qualification: `d8d6aa...` failed because the new contract omitted its declared `nonReentrant` modifier; `989eec...` then failed only in new test tuple destructuring. Both root causes were fixed before the exact implementation SHA was qualified; skipped downstream tests on failed runs were not treated as evidence
- Level 2 milestone: **PASS on the same exact implementation SHA**; the retained Swap suite now covers the completed market-formation, oracle and public-distribution economics together without repository-wide duplication
- Level 3: **intentionally deferred** to complete app-phase closeout
- limitations intentionally deferred: exact deployed PublicDistributionVault→auction funding provenance, deterministic predeploy materialization, live Registry/Pay/Wallet/Exchange binding, production-equivalent testnet behavior and external release security review
- blockers for this step: **none**
- completion state: **COMPLETE**
- next canonical roadmap step: **SWAP-AUDIT-6 — deterministic artifacts and predeploy state**

Exact-final-head comprehensive Level 3 results remain intentionally deferred until complete app-phase closeout.

## Security classification

| Area | Classification |
|---|---|
| canonical executor access control | verified safe behavior in inspected source/tests |
| minimum-output / overspend postconditions | verified safe behavior |
| constant-product pool reentrancy | mitigated |
| nonstandard ERC20 reserve corruption | mitigated by exact balance-delta checks |
| arbitrary pool execution | mitigated by canonical registry + executor/pool checks |
| user authorization | bounded above Swap through trusted adapter/Wallet/Exchange architecture |
| fee mutability | immutable per pool; accepted V1 design |
| LP share transferability | intentionally absent; accepted V1 limitation |
| excess-ratio liquidity donation | accepted design risk; providers must supply bounded inputs knowingly |
| oracle manipulation/staleness | canonical cumulative TWAP, explicit window/freshness/source identity and Exchange deviation guard qualified source-side; live deployment remains pending |
| batch-auction custody/settlement | source-side lifecycle completed and app-qualified; deployed funding/proceeds bindings remain later qualification |
| live Pay→Swap binding spoof/misconfiguration | mitigated by fail-closed manifest requirement, not live-qualified |
| live address/code identity | repository authority only; not testnet-qualified |
| external independent security audit | required release gate, not satisfied by this repository audit |

No claim is made that this is an external independent security audit.

## Documentation audit

Present:

- Swap index, getting started, user guide, architecture, concepts, fees, permissions, security, FAQ and troubleshooting;
- developer index/API/contracts/events/errors/examples;
- system dependency and value-movement architecture;
- CADC/Swap tier documentation;
- Exchange foundation/hardening/release documentation.

Audit remediation expanded the Swap contract map and clarified registry-resolved executor/address semantics.

Still missing or incomplete:

- dedicated Swap deployment/operator runbook;
- deterministic Swap predeploy materialization record;
- generated retained Swap deployment artifacts/code hashes;
- app-specific Genesis acceptance record after live qualification.

## Genesis and deployment readiness

The source tree is substantially implemented, but repository deployment records are not closed:

- predeploy plan still marks the frozen Swap system contracts `SOURCE_READY`;
- no retained `contracts/artifacts/GenesisDEXFactory.json`, `PublicBatchAuction.json`, `TWAPOracle.json`, `ApprovedQuoteAssetRegistry.json`, `CanonicalSwapExecutor420.json` or `CanonicalConstantProductPool420.json` was present in the audited tree;
- constructor/storage materialization evidence for the Swap predeploys is not retained as an app closeout;
- Pay→Swap deployment binding remains explicitly unverified;
- CADC canonical markets remain blocked on the issuer-approved 420 deployment/path;
- official public testnet live Swap execution evidence is not yet the basis of this audit;
- the repository-wide external-audit/mainnet gate remains open.

## Requirement matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| Genesis protocol + user app | frozen Genesis application catalogue | protocol + Exchange-composed UX | web/contract suites | yes | COMPLETE | retain |
| canonical liquidity execution | Swap/Exchange architecture | executor + production candidate pool | pool/integration/fuzz/invariant | yes | COMPLETE | retain |
| canonical market identity | Swap architecture | CanonicalMarketRegistry | integration | yes | COMPLETE | retain |
| approved quote assets | market-tier/shared interface authority | ApprovedQuoteAssetRegistry | indirect/integration | yes | COMPLETE | retain/add direct negatives later |
| canonical vs permissionless tiers | market-tiers config | Genesis and permissionless registration-only lifecycles frozen; permissionless deployment remains user-managed and noncanonical | dedicated factory + integration/fuzz/invariant coverage | yes | COMPLETE | retain; live deployment qualification remains later |
| production pool | Exchange V4 | CanonicalConstantProductPool420 | dedicated suite | yes | COMPLETE for V1 | retain |
| obsolete scaffold removed | repository consistency | removed in audit | verifier enforces absence | docs updated | COMPLETE | retain |
| native $420 user path | Genesis purpose + Exchange architecture | handled above pool via wrapped/native Exchange path | Exchange tests | yes | PARTIAL | live end-to-end qualification |
| TWAP/reference oracle | Genesis/Swap architecture | canonical pool cumulative TWAP with bounded window/freshness/source identity; direct Exchange + 420Oracle adapter integration | dedicated TWAP/adversarial/integration plus retained regressions | yes | COMPLETE source-side | live deployment/config qualification later |
| public batch auction | frozen dApp/system map + PublicDistributionVault/quote-asset authority | pre-funded native inventory + canonical quote escrow + governed clearing + deterministic fill/refund/claim/cancel lifecycle | dedicated economic/adversarial suite + retained regressions | yes | COMPLETE source-side | retain; qualify deployed funding/binding later |
| Pay integration | Pay/Swap architecture | canonical adapter ABI | PaySwap tests | wiring manifest | PARTIAL | live exact-instance binding |
| Bridge/CADC integration | CADC/Bridge docs | configured pending issuer | bridge integration tests | yes | BLOCKED | issuer-approved route/deployment |
| Exchange user surface | Exchange web | implemented | 261 Node tests plus checks | extensive | COMPLETE source-side | live config/qualification |
| deterministic build | Foundry + web | source builds under CI | dedicated audit workflow | dev docs | COMPLETE source-side | retain exact-head evidence |
| Genesis predeploy artifacts | predeploy plan | absent retained Swap artifacts | n/a | partial | MISSING | generate/pin artifacts and storage state |
| testnet deployment | release requirements | not live-qualified here | harness exists | Exchange testnet docs | BLOCKED | official production-equivalent testnet |
| external security gate | security-suite registry | not external-audited | internal only | policy exists | BLOCKED | independent launch audit |

## Remediation performed in this audit

1. Added `CanonicalConstantProductPool420.sol` to the canonical 420Swap dApp inventory.
2. Removed obsolete `CanonicalPool420.sol`.
3. Hardened `verify-420swap-interface-v1.py` so it:
   - requires the production pool;
   - rejects the old scaffold;
   - checks critical executor/pool properties;
   - requires dedicated pool/Swap/Pay integration tests;
   - verifies canonical dApp inventory.
4. Updated committed Swap interface verification state to `PRODUCTION_CANDIDATE_PRESENT`.
5. Added Swap verification to the shared contract verification entrypoint.
6. Expanded the Genesis dApp verifier's expected Swap source inventory.
7. Expanded Swap developer contract/address documentation.
8. Added dedicated `420Swap Audit Qualification` CI covering targeted Foundry qualification and the Exchange user surface.
9. Froze `GenesisDEXFactory` as registration-only canonical semantics without inventing an unauthorized CREATE/CREATE2 path.
10. Added `SwapGenesisDEXFactory420.t.sol` covering registration mode, invalid/duplicate pools, pause/system-safety fail-closed behavior, governance authorization, timelock caller enforcement and implementation-reference controls.
11. Extended the Swap verifier to require registration-only factory semantics and the dedicated factory test suite.
12. Removed the unnecessary `--force` cold rebuild from app-scoped Swap qualification in accordance with phase qualification policy.
13. Hardened `PermissionlessDEXFactory` as explicit registration-only market formation with pool pair introspection, exact runtime-codehash provenance, reverse pool-address uniqueness and immutable registration records.
14. Added `SwapPermissionlessDEXFactory420.t.sol` covering pair/codehash spoofing, non-introspectable pools, duplicate IDs/addresses, same-pair variants, pause/safety/lifecycle rejection, invalid inputs and true permissionless callers.
15. Reconciled permissionless market-tier and dApp UX configuration to preserve `creation: ANYONE` while explicitly defining external deployment followed by existing-pool registration.
16. Extended the Swap verifier and dedicated CI to retain permissionless lifecycle qualification.
17. Added canonical cumulative Q96 reserve-price accounting to `CanonicalConstantProductPool420`.
18. Reworked `TWAPOracle` to derive observations exclusively from the active canonical market/pool, with explicit minimum/maximum windows, freshness, source provenance, decimal normalization and immediate source-change invalidation.
19. Removed arbitrary governance price publication semantics; governance now configures policy while permissionless checkpoints derive state deterministically on-chain.
20. Added direct `referencePrice` compatibility for `ExchangeOracleGuard420` and hardened `TWAPOracleSourceAdapter420` to consume fail-closed observations.
21. Added `SwapTWAPOracle420.t.sol` covering cumulative manipulation resistance, minimum/maximum windows, staleness, source replacement, pause/inactive market failure, authority separation, Exchange deviation/stale behavior and 420Oracle adapter provenance.
22. Expanded Swap verifier/docs/CI for TWAP semantics and deduplicated push/PR qualification concurrency by audit branch.
23. Replaced PublicBatchAuction's record-only bid bookkeeping with exact canonical quote escrow, native inventory reservation, deterministic fill/refund/proceeds accounting and one-shot pull claims.
24. Bounded public auction inventory at 100,000 native 420, matching the PublicDistributionVault daily release cap, while preserving PublicDistributionVault as the native inventory authority.
25. Preserved the repository's existing governance-set clearing-price boundary rather than inventing an unsupported price-discovery algorithm.
26. Added cancellation/full-refund recovery and SAFE_WHEN_PAUSED claim behavior so emergency controls do not trap escrowed bidder value.
27. Added `SwapPublicBatchAuction420.t.sol` covering canonical quote enforcement, funding bounds, exact escrow, under/oversubscription, pro-rata allocation, refunds, cancellation, timing/replay, fee-on-transfer rejection, pause recovery and governance authority.
28. Extended Swap verifier/docs/dedicated CI to retain PublicBatchAuction economic qualification.

## Outstanding remediation roadmap

The remaining work must preserve these step identities and dependency order:

1. **SWAP-AUDIT-1 — exact-head source/build/test closeout — COMPLETE**  
   Dedicated app qualification closed green on the retained audit branch.

2. **SWAP-AUDIT-2 — GenesisDEXFactory production semantics — COMPLETE**  
   Canonical repository authority resolves the factory as registration-only. The contract, verifier, tests and developer documentation now make that lifecycle explicit and qualified.

3. **SWAP-AUDIT-3 — permissionless pool lifecycle hardening — COMPLETE**  
   Permissionless market formation is now explicitly external-deploy + registration-only. Pair/codehash provenance, duplicate ID/address handling, component lifecycle/safety failure paths and user-facing terminology are hardened and qualified.

4. **SWAP-AUDIT-4 — TWAP/oracle production hardening — COMPLETE**  
   TWAP now derives from canonical pool cumulative state; window/freshness/source identity, publication authority, manipulation resistance, Exchange guard and 420Oracle adapter behavior are explicit, fail-closed and qualified.

5. **SWAP-AUDIT-5 — PublicBatchAuction completion — COMPLETE**  
   PublicBatchAuction is now a real pre-funded public-distribution auction with canonical quote escrow, governed clearing price, deterministic under/oversubscribed fills, proceeds/refunds, replay-safe pull claims and cancellation recovery.

6. **SWAP-AUDIT-6 — deterministic artifacts and predeploy state**  
   Generate pinned compiler artifacts/runtime hashes and materialized constructor/storage state for frozen Swap system contracts; record exact provenance.

7. **SWAP-AUDIT-7 — deployment binding and registry qualification**  
   Deploy/register the canonical executor/pool/market stack and prove exact code identities, Registry entries and Pay→Swap trusted-caller bindings.

8. **SWAP-AUDIT-8 — production-equivalent testnet qualification**  
   Execute live Swap journeys through Wallet/Exchange, including success, slippage, stale quote/oracle, wrong chain, disabled market, replay, reorg/recovery and Pay composition.

9. **SWAP-AUDIT-9 — Genesis closeout and release security gate**  
   Reconcile exact deployed state with frozen address/namespace authority, retain Genesis acceptance evidence, complete independent security review required by release policy, and only then assess production readiness.

## Readiness state

At repository-remediation stage:

- CODE COMPLETE: **YES for repository-side Swap source semantics through SWAP-AUDIT-5.**
- BUILD COMPLETE: **YES for source tree on repository CI; final audit workflow must close on exact final SHA.**
- CONTRACT COMPLETE: **YES source-side through SWAP-AUDIT-5; deterministic deployment/predeploy qualification remains open.**
- TEST COMPLETE: **YES for current app-scoped source/economic qualification; Level 3 and live deployment/testnet qualification remain deferred.**
- DOCUMENTATION COMPLETE: **NO** — deployment/operator/Genesis acceptance records remain.
- INTEGRATION COMPLETE: **NO** — live Pay/Registry/Wallet/Exchange bindings remain unverified.
- SECURITY QUALIFIED: **NO** — internal hardening is not the required external release gate and unresolved components remain.
- TESTNET READY: **NO** — deterministic predeploy/deployment evidence and live binding are incomplete.
- GENESIS READY: **NO** — predeploy artifacts/state and testnet qualification are incomplete.
- PRODUCTION READY: **NO** — Genesis/testnet/security gates remain.

## Final determination

420Swap is **materially implemented and substantially stronger than its stale repository metadata indicated, but it is not genuinely complete or Genesis-ready yet**.

The production-candidate ERC20/ERC20 liquidity path, canonical executor, core registries and composed Exchange user surface are real and testable. The audit repaired the stale scaffold/inventory/verification state instead of treating old metadata as truth.

The remaining blockers are deployment/release-side: absent retained predeploy artifacts/materialized state; unverified live Registry/Pay→Swap/PublicDistributionVault bindings; production-equivalent testnet qualification; and external security qualification.

Do not mark 420Swap complete solely because the core Swap and Exchange tests are green.
