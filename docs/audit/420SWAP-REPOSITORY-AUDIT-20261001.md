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
| app-specific docs | present | contract page + deployment/predeploy runbook expanded | COMPLETE for repository-side audit scope | live Genesis acceptance remains later |
| dedicated Swap CI | absent | app qualification + deterministic-predeploy qualification added | COMPLETE | targeted contract/user-surface plus SWAP-AUDIT-6 workflows |
| deterministic deployment artifacts | absent | six pinned compiler artifacts retained | PARTIAL / GLOBAL INPUT BLOCKED | frozen predeploys plus executor/pool compiler provenance retained; final frozen-predeploy runtime hashes require canonical global `genesisConfigHash` |
| materialized Swap predeploy state | not found | four explicit predeploy-state records retained | PARTIAL / GLOBAL INPUT BLOCKED | GovernanceTimelock/ProtocolRegistry identities, compiler immutable refs and empty mutable storage are frozen; final runtime materialization awaits global `genesisConfigHash` |

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
| 420Registry | Genesis-resident components resolve shared dependencies; SWAP-AUDIT-7 qualifies actual ProtocolRegistry component registration, ACTIVE lifecycle, resolution and EXTCODEHASH-derived runtime identity in local EVM deployment | COMPLETE repository/local deployment binding; live public-chain evidence deferred |
| shared Genesis interface layer | executor/registries consume canonical asset, health, governance and safety semantics | COMPLETE |
| 420Pay | exact PaymentRouter → CanonicalSettlementAdapter → CanonicalSwapExecutor graph and executor trusted-caller identity are repository/local-EVM qualified | COMPLETE repository binding; live public-chain transactions deferred to SWAP-AUDIT-8 |
| 420Exchange | canonical Swap adapter and full web swap execution surface exist | COMPLETE in source/tests; BLOCKED live deployment |
| 420Wallet / authorization | Exchange web binds execution to wallet review/session/preflight; capability architecture exists above Swap | COMPLETE in client scope; live chain pending |
| 420Bridge | Pay/Swap/Bridge integration test exists; CADC canonical route pending issuer-approved deployment | PARTIAL/BLOCKED external |
| Oracle layer | canonical Swap cumulative TWAP + fail-closed 420Oracle adapter + Exchange reference guard integration | COMPLETE source-side; live deployment qualification pending |
| 420Indexer | Swap/Exchange decoder/ABI surfaces exist | PARTIAL; live chain qualification pending |
| native $420 | Exchange has wrapped/native execution architecture; canonical pool itself is ERC20/ERC20 | PARTIAL by layer; intentional V1 pool limit |

The committed Pay→Swap wiring manifest is now `REPOSITORY_QUALIFIED_LIVE_BINDING_PENDING`: source ABI compatibility plus the exact local-EVM `PaymentRouter → CanonicalSettlementAdapter → CanonicalSwapExecutor` identity/trusted-caller graph are qualified. `deployment_binding_verified` deliberately remains `false` until SWAP-AUDIT-8 records public-testnet addresses, transactions and block evidence.

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

### SWAP-AUDIT-6 retained Level 1 deterministic-predeploy evidence

- roadmap step: **SWAP-AUDIT-6 — deterministic artifacts and predeploy state**
- qualification level: **Level 1 — per-roadmap-step fast qualification**
- final materialized artifact SHA: `b9de9f1c86e81e2d5a7b222f51a544a1e7d51221`
- current `main` observed during SWAP-AUDIT-6 work: `98e545225d54379086f0c520afcb84b4d4d97288`
- audit PR / branch: **#455** / `audit/420swap-complete-20261001`
- first successful generation workflow: **420Swap SWAP-AUDIT-6 Predeploy Qualification**, PR run **36943686717**, job **110640795060**
- successful generation-run checks: exact-head checkout PASS; pinned Solidity 0.8.24/Cancun/optimizer/viaIR settings PASS; targeted Swap predeploy compile PASS; deterministic artifact generation PASS; reproducibility PASS; independent predeploy verifier PASS; GenesisDEXFactory regression PASS; Swap Genesis integration regression PASS; generated-output commit PASS
- retained compiler artifacts: `GenesisDEXFactory.json`, `PublicBatchAuction.json`, `TWAPOracle.json`, `ApprovedQuoteAssetRegistry.json`, `CanonicalSwapExecutor420.json`, `CanonicalConstantProductPool420.json`
- retained frozen-predeploy records: `GenesisDEXFactory-predeploy-state.json`, `PublicBatchAuction-predeploy-state.json`, `TWAPOracle-predeploy-state.json`, `ApprovedQuoteAssetRegistry-predeploy-state.json`
- frozen identities reconciled: GovernanceTimelock `0x...0429`, ProtocolRegistry `0x...0434`, and the existing frozen Swap addresses `0x...042b`, `0x...042c`, `0x...042d`, `0x...0439`
- constructor authority corrected: all four frozen Swap predeploys now declare `governance_timelock`, `protocol_registry`, and shared `genesis_config_hash`; stale one/two-argument storage-init declarations are retired
- GenesisDEXFactory deterministic-predeploy hardening: frozen factory now starts with `poolImplementation == address(0)`; canonical pool registration fails closed until governance binds a qualified code-bearing implementation reference, avoiding invention of an unfrozen concrete pool address
- storage result: compiler storage layouts retained; Genesis mutable state for the four frozen Swap contracts is explicitly empty with canonical empty storage root
- diagnosed tooling defect: initial run **36943564356** compiled successfully but generation failed because normal Foundry artifact JSON omitted `storageLayout`; generator was corrected to use compiler-authoritative `forge inspect ... storage-layout --json`, matching existing repository predeploy tooling
- generated-output transition: run **36943686717** qualified the pre-generation head and produced generated SHA `bdc9447c3fa111718df848d3a540ecaa19af7af0`; the Actions-authored commit produced an empty `action_required` follow-up and was not counted as qualification evidence
- authoritative exact-head qualification: **420Swap SWAP-AUDIT-6 Predeploy Qualification**, PR run **36944384597**, job **110642979282**, exact head/evidence SHA `493927086538841a8792fb7c1e57221debe5b082` — exact-head checkout PASS; pinned compiler settings PASS; targeted compile PASS; deterministic generation PASS; reproducibility PASS; independent verifier PASS; GenesisDEXFactory regression PASS; Swap Genesis integration PASS; generated outputs already current/no implementation mutation
- canonical global Genesis configuration commitment: `0x01aea63faef55d711e5f93e800b04702177874f4015375b659038ce991d20921`, frozen by `contracts/config/genesis-config-commitment.json` over the versioned non-generated Genesis authority input set
- final materialization state: all four frozen Swap predeploys are recorded as `SWAP_AUDIT_6_FINAL_PREDEPLOY_STATE`; predeploy plan entries are `ARTIFACT_READY`; deployment manifest entries are `SWAP_AUDIT_6_ARTIFACT_READY`
- final runtime code hashes: GenesisDEXFactory `0x1c9e72335d2da9ef3a7c65bcfab88364ba04ec6ed85789ff8c3b231e89e10e35`; PublicBatchAuction `0xe2f81400c625114689b744ff4dd116143d4991e01f1608370a65566938df9203`; TWAPOracle `0x581a2ab1d4f8ffcecd88bb9bce1b868b4de39b52e1911957dbdc93759631fb32`; ApprovedQuoteAssetRegistry `0x7ed9d661715160092a1fd1fdbd4ff09dca80714f2ff0270855d1c5ed1ab315f6`
- Level 2: **not required at this ordinary deployment-preparation step**; no new cross-app runtime milestone is introduced
- Level 3: **intentionally deferred** to complete app-phase closeout
- intentionally deferred live checks: deployed `eth_getCode`/immutable/storage identity, ProtocolRegistry entries, Pay→Swap trusted-caller binding, PublicDistributionVault→auction live funding, Wallet/Exchange journeys, production-equivalent testnet behavior and external release security review
- materialized implementation SHA: `b9de9f1c86e81e2d5a7b222f51a544a1e7d51221`
- authoritative minimal exact-head requalification: **420Swap SWAP-AUDIT-6 Materialized Head**, PR run **36956873407**, job **110681683282**, exact head `b400568520d15ddc740c30c04e4fff868e764e8c` — targeted compile PASS; frozen Genesis commitment PASS; retained runtime/hash reproduction PASS; independent predeploy-state verification PASS; generated outputs already reproducible/no further artifact mutation
- completion state: **COMPLETE**
- blockers for this step: **none**
- next canonical roadmap step: **SWAP-AUDIT-7 — deployment binding/registry qualification**

Exact-final-head comprehensive Level 3 results remain intentionally deferred until complete app-phase closeout.

### SWAP-AUDIT-7 retained Level 1 + deployment-binding Level 2 evidence

- roadmap step: **SWAP-AUDIT-7 — deployment binding/registry qualification**
- qualification level: **Level 1 — deployment-binding fast qualification**, plus **Level 2 — retained Swap app integration milestone** because this step introduces the shared ProtocolRegistry/420Pay authority binding
- implementation SHA: `d42ad8a746e303cd1b3c82d6bfbbbd09ab5479c1`
- current `main` / Level 1 base at closeout: `98e545225d54379086f0c520afcb84b4d4d97288`
- audit PR / branch: **#455** / `audit/420swap-complete-20261001`
- authoritative Level 1 workflow: **420Swap SWAP-AUDIT-7 Deployment Binding**, PR run **36959964085**, job **110691261681** — exact-head checkout PASS; deployment-binding manifest PASS; retained Swap interface verifier PASS; targeted compile PASS; real ProtocolRegistry/Swap/Pay binding graph PASS
- authoritative Level 2 workflow: **420Swap Audit Qualification**, PR run **36959964102**
- Level 2 contract job **110691297185**: static verification PASS; targeted build PASS; Genesis factory PASS; permissionless factory PASS; TWAP/oracle PASS; PublicBatchAuction PASS; canonical pool PASS; Swap integration PASS; fuzz PASS; invariant PASS; Pay/Swap + Pay/Swap/Bridge integration PASS
- Level 2 user-surface job **110691297485**: `npm run check` PASS; Node tests PASS; qualification build PASS
- Registry proof: actual `ProtocolRegistry.registerComponent` derives runtime code hashes from deployed code; canonical market registry, swap executor, settlement adapter and payment router resolve ACTIVE at the exact registered implementations and support version 1.0.0
- Swap binding proof: `GenesisDEXFactory.poolImplementation` is code-bearing before registration; factory pool ID resolves to the exact concrete `CanonicalConstantProductPool420`; `CanonicalMarketRegistry` points the canonical market to that exact pool/pair/role
- Pay→Swap proof: `PaymentRouter420.settlementAdapter == CanonicalSettlementAdapter420`; adapter `swapExecutor == CanonicalSwapExecutor420`; executor trusts the exact canonical adapter and does not implicitly trust a wrong adapter
- fail-closed proof: a deliberately misbound replacement adapter is observable and remains untrusted; suspending the canonical market registry in ProtocolRegistry blocks its operational mutation path
- frozen predeploy authority: SWAP-AUDIT-6 runtime identities for GenesisDEXFactory/PublicBatchAuction/TWAPOracle/ApprovedQuoteAssetRegistry remain authoritative and are checked by the binding manifest verifier
- live-boundary discipline: registry-resolved component addresses, concrete pool address, deployment transactions, registry transactions, binding transactions and public evidence blocks remain null/empty in the repository binding manifest rather than being fabricated
- 420Pay state: `REPOSITORY_QUALIFIED_LIVE_BINDING_PENDING`; `deployment_binding_verified: false` intentionally remains until SWAP-AUDIT-8 live evidence
- diagnosed qualification harness failures: earlier Level 2 runs failed before contract execution because the static verifier first mistook the legitimate `setPoolImplementation(address implementation_)` setter for constructor deployment authority and then used an over-escaped constructor regex; both verifier defects were corrected and the final exact SHA was requalified
- Level 2 milestone: **PASS** on the same exact implementation SHA; no repository-wide Level 3 inventory was duplicated
- Level 3: **intentionally deferred** to complete app-phase closeout
- intentionally deferred checks: public-testnet deployed addresses/transactions/blocks, live Wallet/Exchange journeys, reorg/recovery behavior, live Pay composition, live PublicDistributionVault→auction funding, global Level 3 reconciliation and external release security review
- blockers for this step: **none**
- completion state: **COMPLETE**
- next canonical roadmap step: **SWAP-AUDIT-8 — production-equivalent testnet qualification**

### SWAP-AUDIT-8 retained Level 1 repository-readiness evidence

- roadmap step: **SWAP-AUDIT-8 — production-equivalent testnet qualification**
- qualification level: **Level 1 — app-scoped live-testnet readiness/harness qualification**; the roadmap exit criterion itself is operational/live and cannot be satisfied by synthetic CI
- repository-readiness implementation SHA: `7b7883998bdbfe4da3e48aef61e4482eff50386e`
- current `main` / observed base during closeout: `d30c81cfbea7847817654b39491694a23c8701e4`
- audit PR / branch: **#455** / `audit/420swap-complete-20261001`
- authoritative readiness workflow: **420Swap SWAP-AUDIT-8 Testnet Readiness**, push run **36961637620**, job **110696399107** — exact-head checkout PASS; fail-closed official-testnet readiness verifier PASS; Exchange live-swap harness PASS; Wallet live-runner syntax/authority validation PASS; protected live workflows confirmed manual-only PASS
- readiness evidence contract: `contracts/config/swap/swap-audit-8-testnet-qualification.json` enumerates exactly eight mandatory live journeys: success, slippage, stale quote/oracle, wrong chain, disabled market, replay, reorg/recovery and Pay composition
- fail-closed verifier: `scripts/verify-swap-audit-8-testnet-readiness.py` proves SWAP-AUDIT-7 repository binding remains qualified, required Wallet/Exchange live tooling exists, no official testnet evidence is fabricated, and missing official infrastructure remains visibly BLOCKED
- operator runbook: `docs/apps/swap/testnet-qualification.md` defines prerequisite launch authority, exact release-candidate binding, evidence fields, protected workflows, journey-specific requirements and the durable live-evidence file contract
- Exchange harness result: all retained V15.6 live-swap qualification unit tests PASS, including successful finality/indexer reconciliation, unresolved-runtime rejection, reorg rejection, reverted-receipt rejection and V13/RPC conflict rejection
- Wallet harness result: live-testnet runner validates syntactically and retains chain-ID/block-height/deployed-code/Explorer/Faucet checks for an official resolved manifest/runtime
- protected execution discipline: `.github/workflows/exchange-testnet-swap.yml` and `.github/workflows/wallet-live-testnet.yml` remain `workflow_dispatch` live workflows; Exchange continues to use the protected `exchange-testnet` environment
- prior qualification harness defect: PR run **36961421569** failed only because stale Forge steps remained after Foundry setup was intentionally removed as redundant; the log showed `forge: command not found`. Those duplicate contract reruns were removed because SWAP-AUDIT-8 changed no contract implementation and prior exact-SHA contract qualification remains valid
- launch authority observed: `docs/STEP-5-TESTNET-LAUNCH.md` states **PUBLIC TESTNET NOT YET AUTHORIZED**; `docs/STEP-5.4-PUBLIC-TESTNET.md` states **TESTNET NOT DECLARED LIVE**
- official infrastructure state: `developer-hub/manifests/testnet.json` is absent; `testnet/services/endpoints.json` still contains placeholder RPC/WebSocket/Explorer/Faucet/metadata endpoints; launch chain ID status remains candidate pending collision preflight
- live evidence state: exact release-candidate SHA/chain/evidence block, deployed dynamic Swap/Pay addresses, Registry/binding transactions and live Wallet/Exchange workflow IDs intentionally remain null/empty; `docs/audit/SWAP-AUDIT-8-LIVE-TESTNET-EVIDENCE.json` does not exist
- Level 2: **not re-run for readiness-only repository changes**; the retained app integration milestone from SWAP-AUDIT-7 remains authoritative because no Swap/Pay executable source changed. The actual production-equivalent integration milestone is inherently the blocked live SWAP-AUDIT-8 execution
- Level 3: **intentionally deferred** to complete app-phase closeout after live SWAP-AUDIT-8 succeeds
- blockers: official production-equivalent testnet is not authorized/live; official testnet manifest absent; public endpoints remain placeholders; no live deployed dynamic Swap/Pay binding evidence; none of the eight mandatory live journeys has retained public-testnet evidence
- completion state: **BLOCKED — OFFICIAL PRODUCTION-EQUIVALENT TESTNET NOT LIVE**
- next canonical roadmap step: **SWAP-AUDIT-8 remains current. Do not advance to SWAP-AUDIT-9 until every live journey and deployment evidence requirement passes on one exact release candidate.**

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

- production-equivalent public-testnet deployment/journey evidence owned by SWAP-AUDIT-8;
- app-specific Genesis acceptance record after live qualification.

## Genesis and deployment readiness

Repository-side deterministic deployment and binding preparation is complete through SWAP-AUDIT-7:

- six retained Swap compiler artifacts pin source/compiler/runtime-template/ABI/storage-layout provenance;
- the canonical global `genesisConfigHash` is frozen and all four frozen Swap predeploys have final materialized runtime hashes;
- the predeploy plan and deployment manifest retain artifact-ready frozen runtime identities;
- SWAP-AUDIT-7 deploys the actual registry-resolved Swap/Pay stack in a local EVM using the real `ProtocolRegistry`, proves Registry-derived runtime code identities and ACTIVE lifecycle, and qualifies the factory→pool→market plus PaymentRouter→adapter→executor trusted-caller graph;
- `420pay-genesis-wiring.json` records repository binding qualification while deliberately leaving `deployment_binding_verified: false` until public-testnet evidence exists;
- no public-testnet address, transaction, block or Registry revision is fabricated by SWAP-AUDIT-7;
- CADC canonical markets remain blocked on the issuer-approved 420 deployment/path;
- production-equivalent public-testnet Swap execution evidence remains SWAP-AUDIT-8;
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
| Pay integration | Pay/Swap architecture + normative Genesis wiring | exact router→adapter→executor identities and executor trusted-caller relation repository/local-EVM qualified | dedicated SWAP-AUDIT-7 binding test + retained PaySwap suite | wiring manifest + binding manifest | COMPLETE repository/local binding | public-testnet transaction/block proof in SWAP-AUDIT-8 |
| Bridge/CADC integration | CADC/Bridge docs | configured pending issuer | bridge integration tests | yes | BLOCKED | issuer-approved route/deployment |
| Exchange user surface | Exchange web | implemented | 261 Node tests plus checks | extensive | COMPLETE source-side | live config/qualification |
| deterministic build | Foundry + web | source builds under CI | dedicated audit workflow | dev docs | COMPLETE source-side | retain exact-head evidence |
| Genesis predeploy artifacts | predeploy plan + Genesis interface authority | six retained compiler artifacts + four final materialized predeploy states with frozen `genesisConfigHash` and runtime code hashes | generator/reproducer/verifier + exact-head materialized-state qualification | deployment runbook | COMPLETE | retain |
| deployment binding / Registry qualification | Swap/Pay/Registry architecture | actual local-EVM ProtocolRegistry registration and exact factory/pool/market + router/adapter/executor binding graph | `SwapDeploymentBinding420.t.sol` + binding verifier + retained Level 2 app suite | binding manifest/wiring docs | COMPLETE repository/local | live public-testnet evidence in SWAP-AUDIT-8 |
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
29. Reconciled stale Swap predeploy constructor declarations to the actual GenesisResidentAccess420 immutable set: GovernanceTimelock, ProtocolRegistry and shared genesisConfigHash.
30. Removed the unfrozen concrete pool implementation address from GenesisDEXFactory constructor state; the frozen factory starts unbound and fails closed until governance binds a qualified code-bearing implementation reference.
31. Added six reproducible SWAP-AUDIT-6 compiler artifacts and four frozen-predeploy state records with compiler-emitted immutable references, source provenance, ABI, storage layout and empty mutable-storage evidence.
32. Added deterministic generation and independent verification tooling that refuses to claim final runtime hashes while the global genesisConfigHash is unresolved.
33. Updated predeploy-plan and deployment-manifest state to explicit COMPILER_ARTIFACT_FROZEN / GLOBAL_HASH_PENDING statuses instead of stale SOURCE_READY claims.
34. Added a dedicated Swap deployment/predeploy operations runbook and a targeted exact-head SWAP-AUDIT-6 CI workflow.
35. Froze the canonical global Genesis configuration commitment and materialized final immutable runtimes/code hashes for all four frozen Swap predeploys.
36. Added `swap-audit-7-deployment-binding.json` as the canonical repository/live-boundary manifest for Registry, pool/market and Pay→Swap bindings.
37. Added `SwapDeploymentBinding420.t.sol` using the real `ProtocolRegistry` and actual Swap/Pay contracts to prove ACTIVE component registration, EXTCODEHASH-derived runtime identity, factory→pool→market bindings, exact router→adapter→executor identity, trusted-caller authority, misbinding visibility and inactive-component failure.
38. Updated `420pay-genesis-wiring.json` to `REPOSITORY_QUALIFIED_LIVE_BINDING_PENDING`, preserving `deployment_binding_verified: false` until public-testnet transaction evidence exists.
39. Added `verify-swap-audit-7-deployment-binding.py` and dedicated exact-head SWAP-AUDIT-7 CI; live addresses/transactions/blocks remain explicitly null and owned by SWAP-AUDIT-8.
40. Corrected two static-verifier harness defects discovered during Level 2 qualification: a setter-name false positive for factory deployment semantics and an over-escaped constructor regex. No protocol assertion was weakened.

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

6. **SWAP-AUDIT-6 — deterministic artifacts and predeploy state — COMPLETE**  
   Canonical `genesisConfigHash` is frozen, all four frozen Swap runtimes are materially instantiated with compiler-derived immutable references, final runtime hashes are retained, and the resulting generated state is reproducible under the dedicated minimal exact-head verifier.

7. **SWAP-AUDIT-7 — deployment binding and registry qualification — COMPLETE**  
   The actual Registry-resolved Swap/Pay stack is repository/local-EVM qualified with real `ProtocolRegistry` component registration, Registry-derived runtime identities, ACTIVE lifecycle, factory→pool→market bindings, exact PaymentRouter→CanonicalSettlementAdapter→CanonicalSwapExecutor identity and exact adapter trusted-caller authority. Public-testnet transactions/blocks remain intentionally deferred to SWAP-AUDIT-8.

8. **SWAP-AUDIT-8 — production-equivalent testnet qualification — BLOCKED ON LIVE NETWORK**  
   Repository readiness/evidence tooling is implemented and exact-head qualified, but the canonical public testnet is not yet authorized/live. Execute and retain all eight required Wallet/Exchange/Pay journeys on one exact production-equivalent release candidate before completing this step.

9. **SWAP-AUDIT-9 — Genesis closeout and release security gate**  
   Reconcile exact deployed state with frozen address/namespace authority, retain Genesis acceptance evidence, complete independent security review required by release policy, and only then assess production readiness.

## Readiness state

At repository-remediation stage:

- CODE COMPLETE: **YES for repository-side Swap source/deployment-binding semantics and SWAP-AUDIT-8 live-readiness tooling.**
- BUILD COMPLETE: **YES for current app-scoped source and deployment-binding scope on exact-head CI; Level 3 final merge-candidate qualification remains later.**
- CONTRACT COMPLETE: **YES source-side through deterministic frozen-predeploy runtime materialization.**
- TEST COMPLETE: **YES for repository-side readiness/harness qualification through SWAP-AUDIT-8; NO for the required live production-equivalent journeys.**
- DOCUMENTATION COMPLETE: **YES for repository-side Swap deployment, testnet qualification and evidence procedures; live evidence/Genesis acceptance remain later.**
- INTEGRATION COMPLETE: **YES for repository/local-EVM Swap→Registry→Pay binding; NO for public-testnet Wallet/Exchange/live-chain qualification.**
- SECURITY QUALIFIED: **NO** — internal hardening is not the required external release gate and unresolved components remain.
- TESTNET READY: **NO** — readiness tooling is complete, but the official production-equivalent public testnet is not authorized/live and all eight live SWAP-AUDIT-8 journeys remain outstanding.
- GENESIS READY: **NO** — deterministic predeploy/runtime, repository binding and testnet-readiness tooling are complete, but live SWAP-AUDIT-8 qualification and final Genesis acceptance remain.
- PRODUCTION READY: **NO** — Genesis/testnet/security gates remain.

## Final determination

420Swap is **materially implemented and substantially stronger than its stale repository metadata indicated, but it is not genuinely complete or Genesis-ready yet**.

The production-candidate ERC20/ERC20 liquidity path, canonical executor, core registries and composed Exchange user surface are real and testable. The audit repaired the stale scaffold/inventory/verification state instead of treating old metadata as truth.

The immediate blocker is operational rather than repository-side: the official production-equivalent public testnet is not authorized/live, so the eight mandatory Wallet/Exchange/Pay journeys cannot yet produce honest evidence. After SWAP-AUDIT-8 passes, the remaining gate is the independent release security/Genesis closeout in SWAP-AUDIT-9.

Do not mark 420Swap complete solely because the core Swap and Exchange tests are green.

## Main reconciliation closeout — 2026-10-02

- reconciled audit branch with current `main` SHA `d30c81cfbea7847817654b39491694a23c8701e4` via two-parent merge commit `0821192828ca6bc45b9267abac34c54c71ec6733`;
- overlapping authority/configuration files were merged structurally without field-level semantic conflicts;
- current-main namespace changes intentionally invalidated the earlier Genesis configuration commitment, so the canonical commitment was re-frozen as `0x01aea63faef55d711e5f93e800b04702177874f4015375b659038ce991d20921` and the four frozen Swap runtimes were rematerialized;
- rematerialized runtime hashes are GenesisDEXFactory `0x1c9e72335d2da9ef3a7c65bcfab88364ba04ec6ed85789ff8c3b231e89e10e35`, PublicBatchAuction `0xe2f81400c625114689b744ff4dd116143d4991e01f1608370a65566938df9203`, TWAPOracle `0x581a2ab1d4f8ffcecd88bb9bce1b868b4de39b52e1911957dbdc93759631fb32`, and ApprovedQuoteAssetRegistry `0x7ed9d661715160092a1fd1fdbd4ff09dca80714f2ff0270855d1c5ed1ab315f6`;
- this documentation update is a normal user-authored retrigger commit so exact-head PR workflows can qualify the final generated state before merge.
