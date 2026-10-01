# 420 Integrated — 16-Step Build Roadmap

## 1. Recover and preserve historical source — IN PROGRESS / PRESERVATION INVENTORY COMPLETE
Archive PUFFScoin / 420 Integrated and surviving WhaleCoin code, commits, genesis files, documentation, and known chain parameters.

**Completed:** surviving repositories and archives verified; July 2019 genesis recovered; 2020 420coin registry record recovered; source provenance and SHA-256 manifest created; reproducible Git-mirror/bundle fetch script added.

**Remaining:** run the included fetch script in a networked development environment to embed complete Git object-history bundles, especially WhaleCoin if a surviving mirror is found.

**Deliverable:** immutable historical-source archive plus hashes.

## 2. Perform ancestry and custom-code diff — PROVISIONAL COMPLETE
Separate:
1. upstream Ethereum code,
2. WhaleCoin-specific modifications,
3. PUFFScoin / 420 Integrated modifications.

**Completed:** architecture classification, reward-path comparison, historical network/genesis comparison, keep/reimplement/discard decisions, and patch inventory.

**Key finding:** WhaleCoin's archived client exposes a custom `AccumulateNewRewards(...)` path and its whitepaper documents developer/follower funding; the surviving 2019 PUFFScoin Ethash file instead contains a conventional `accumulateRewards(...)` path with a flat 5-PUFFS reward and no visible follower/developer split.

**Remaining forensic refinement:** once full Git mirrors are available, run byte-level ancestry diffs to prove the exact WhaleCoin → PUFFScoin source lineage and enumerate every changed file.

**Deliverable:** `historical/archaeology/STEP-2-CODE-ARCHAEOLOGY.md` + `PATCH-INVENTORY.csv`.

## 3. Write 420 Integrated Protocol Specification v2 — IN PROGRESS
Define monetary policy, validator lifecycle, randomness, slashing, genesis state, system contracts, governance limits, and consensus transitions.

**Completed:** adopted economic/validator rules have been promoted into a normative-variable checklist.

**Next decisions:** active-set quantization, slot timing, proposer selection, finality, fork choice, randomness, activation/exit delays, slashing, fee policy, exact integer arithmetic, genesis allocation, governance boundaries, and full-PoS transition.

**Deliverable:** versioned protocol specification with no consensus-critical ambiguity.

## 4. Establish modern execution-layer base
Pin a current stable Go-Ethereum release and maintain 420-specific execution changes as a minimal, reviewable patch set.

**Deliverable:** reproducible `420-geth` build.

## 5. Build genesis/network configuration
Generate execution and consensus genesis state from one canonical protocol configuration and allocation ledger.

**Deliverable:** reproducible genesis builder and hashes.

## 6. Implement protocol issuance and treasury routing
Implement declining issuance, immutable top-level 34/33/33 split, security reward routing, Attention Treasury, and Development Treasury.

**Deliverable:** consensus-tested issuance implementation.

## 7. Implement bonded validator registry
42,000-420 candidate bond (currently provisional), eligibility lifecycle, active set, cooldown, withdrawal delay, penalties, and genesis-validator handling.

**Deliverable:** validator registry + consensus integration.

## 8. Implement Whale / publisher staking
Rebuild the useful portion of WhaleCoin’s on-chain economy as a modern publisher/Whale registry.

**Deliverable:** WhaleRegistry contracts and tests.

## 9. Implement campaign and interaction protocol
Campaign registration, content commitments, eligibility rules, interaction proofs, anti-replay rules, and privacy-aware participation.

**Deliverable:** CampaignRegistry + AttentionRegistry prototype.

## 10. Implement epoch reward distribution
Aggregate participation rather than paying every click. Commit reward roots and allow claims.

**Deliverable:** RewardDistributor + fraud/claim tests.

## 11. Launch local multi-node devnet
Run 3–5 nodes first, then a 15-validator simulation. Exercise validator rotation, failures, restarts, re-selection, genesis contracts, and issuance.

**Deliverable:** one-command local 420 devnet.

## 12. Build reference wallet / explorer interface and Genesis service layer — IN PROGRESS
Native 420 balances, validator registration, Attention rewards, Development Fund transparency, dApp interaction, network status, and shared service infrastructure required by the Genesis application ecosystem.

### Genesis dApp/service status

- **420Indexer** — shared rebuildable projection service implemented and repository-qualified for Genesis consumers; live public-testnet binding/evidence remains deployment-time.
- **420RPC** — public RPC/routing/policy layer implemented through its hardening and qualification roadmap; final public-testnet endpoint qualification remains deployment-time.
- **GEN-10.1 / 420 Wallet** — repository implementation merged through W13. Wallet Core, web, extension and native mobile surfaces are built and qualified. Production Play/TestFlight release remains externally blocked on genuine physical Android/iPhone device evidence, and live testnet binding remains deployment-time.
- **GEN-10.2 / 420 Explorer** — repository implementation complete, qualified and merged; production-equivalent live deployment/recovery qualification remains testnet-gated.
- **GEN-10.3 / 420 Search** — SEARCH-0 through SEARCH-10 complete, reconciled, qualified and merged. Live deployed Search/Indexer evidence remains testnet-gated.
- **420Names — NAMES-AUDIT testnet handoff** — NAMES-AUDIT-1 through NAMES-AUDIT-8 are repository-complete and qualified. **Current phase: NAMES-AUDIT-9 — production-equivalent testnet deployment qualification.** Testnet work must use the approved production-equivalent candidate chain and retain durable live-chain evidence for: (1) expected chain ID, network and genesis identity; (2) `eth_getCode` at canonical Names420 address `0x0000000000000000000000000000000000000435`; (3) exact deployed runtime hash `0xa974fffd3a40e7f28db41e4ae30656b33789d2483b18b47c809ce2385de709b7`; (4) `systemName() == "Names420"`; (5) `protocolVersion() == 3`; (6) `governanceTimelock() == 0x0000000000000000000000000000000000000429`; (7) the frozen initial predeploy/storage state; (8) complete live commit/register behavior including commitment timing and replay/expiry boundaries; (9) renewal; (10) forward resolution/profile/service updates; (11) reverse resolution; (12) transfer nomination and acceptance; (13) lease expiry behavior; (14) 420Wallet against the verified chain-specific deployment; (15) 420Indexer ingestion of actual `0x0435` events using the frozen descriptor; (16) 420Search reconstruction from actual ordered event history while remaining derived and non-authoritative; (17) realistic restart/reorg/recovery behavior where possible; and (18) multi-provider/RPC disagreement handling that fails closed rather than accepting inconsistent chain identity or contract state. Anvil/local fixtures, offline manifests or CI-only simulation may qualify the harness but **must not** be promoted to NAMES-AUDIT-9 live-deployment completion evidence. After live evidence closes NAMES-AUDIT-9, proceed to **NAMES-AUDIT-10 — Genesis acceptance closeout**, then **NAMES-AUDIT-11 — production qualification**.
- **GEN-10.4 / 420 Analytics** — repository implementation is complete through ANALYTICS-8. The deployable `analytics420` runtime, API, dashboard, metrics, methodology, privacy, reorg/finality/freshness and resource controls are implemented. **Current phase: ANALYTICS-9 / LIVE_QUALIFICATION_READY**; live 420Indexer-backed testnet evidence remains outstanding before ANALYTICS-10 Genesis closeout.
- **GEN-10.5 / 420 Verify** — VERIFY-0 through VERIFY-10 complete, reconciled, exact-head qualified and merged via PR #303 (merge `1f937b7ef641980cc118336763ba50ffc8f3cc5a`). Public backend/frontend deployment and live testnet endpoint qualification remain operational work.
- **GEN-10.6 / 420 AppStore** — implementation qualified and merged via PR #305 (merge `202874aa76db333348a50ad7bab6c126d96c7397`). Public backend/frontend deployment and live Registry/Verify/Wallet integration evidence remain testnet-gated.
- **GEN-10.7 / 420 Notifications** — NOTIFY-0 through NOTIFY-10 implementation/closeout work complete and merged via PR #312 (merge `d0006253ccdda9777f07dcc7bd98daf519f8cd36`). Public service deployment, live Indexer binding and provider delivery/replay/recovery evidence remain operational/testnet work.
- **GEN-10.8 / 420 Status** — STATUS-0 through STATUS-10 implementation/closeout work complete and merged via PR #325 (merge `f442801cd841ddb275eb5889c846be73093be25c`), with later reconciliation PRs including #332/#336 also merged. Live service probes, public endpoint deployment and production-equivalent incident/recovery evidence remain deployment-time.
- **420Automation** — shared replaceable infrastructure outside the frozen user-facing Genesis app inventory; continue its own qualification/testnet closeout independently of the GEN-10 application sequence.

Protocol-backed Genesis applications continue through their own contract, deployment and integration gates and are not duplicated as contract-free GEN-10 application builds.

**Current GEN-10 state:** the contract-free Genesis application implementation sequence is repository-built. Remaining work is concentrated in live/public-testnet deployment, environment binding and deployment-specific qualification, plus Wallet physical-device release evidence.

**Deliverable:** usable reference wallet/explorer plus qualified shared Genesis service infrastructure and completed contract-free Genesis application integrations.

## 13. Genesis requirements reconciliation pass — REQUIRED GATE
Reconcile every consensus, protocol, contract, service, dApp, deployment, documentation, and operational requirement into one canonical Genesis release manifest before adversarial qualification or public testnet promotion.

This phase is a whole-system proof that independently completed components actually compose into one reproducible Genesis release. It is not a new feature-development phase. Any requirement discovered here as missing, ambiguous, stale, unqualified, or incompatible must be returned to its owning roadmap and closed before this gate can pass.

### Required reconciliation checks

1. **Protocol-spec closure** — map every consensus-critical rule to the normative protocol specification and verify there are no unresolved or contradictory Genesis variables.
2. **Canonical network configuration** — bind chain ID, genesis state, allocations, system-contract addresses, validator/bootstrap configuration, fork parameters, fee policy, and release hashes to one reproducible source of truth.
3. **Consensus and execution implementation traceability** — prove each normative requirement is implemented by an exact code path, test suite, and qualified release identity.
4. **Genesis allocation ledger reconciliation** — independently total and verify all founder, validator, treasury, development, ecosystem, faucet/testnet-only, protocol, and reserved allocations against the canonical genesis state.
5. **System-contract inventory** — verify every required Genesis contract is deployed at the expected deterministic address with the correct bytecode, constructor/init state, ownership, permissions, upgrade boundaries, and interfaces.
6. **Genesis application inventory** — reconcile the frozen Genesis dApp/application list against implemented packages, dependencies, deployment manifests, service endpoints, documentation, and launch status.
7. **Shared-service dependency graph** — verify Wallet, Explorer, Search, Analytics, Verify, AppStore, Notifications, Status, Indexer, RPC, Automation, Gas/Paymaster, Bundler, Oracle-facing surfaces, storage, and other approved Genesis consumers bind only to qualified upstream interfaces.
8. **Cross-component compatibility** — exercise exact-version compatibility across node, contracts, RPC, indexer, wallet, dApps, automation, account-abstraction infrastructure, bridge/oracle interfaces, and documentation examples.
9. **Authority and trust-boundary reconciliation** — confirm no service or application has silently acquired consensus, custody, bridge, oracle, governance, validator, treasury, or finality authority outside its adopted specification.
10. **Security-control reconciliation** — verify authentication, signing domains, replay protection, chain provenance, rate limits, privilege boundaries, emergency controls, fail-closed behavior, and key-management assumptions across the complete Genesis stack.
11. **Failure and recovery coverage** — identify every critical dependency and prove documented restart, rebuild, reorg, failover, degraded-mode, corruption-recovery, and state-reconstruction procedures exist and are tested where applicable.
12. **Data/provenance reconciliation** — ensure user-facing applications clearly distinguish canonical chain state, indexed projections, cached data, inferred/analytical data, oracle attestations, external data, and non-authoritative search/discovery results.
13. **Documentation parity** — verify architecture docs, operator guides, user guides, API/RPC references, contract references, deployment instructions, troubleshooting, and generated examples match the exact Genesis release rather than an earlier implementation.
14. **CI and qualification evidence** — require all Genesis-critical repositories/packages to have passing qualification gates tied to exact commits and retain evidence sufficient to reproduce the go/no-go decision.
15. **Known-blocker register** — enumerate every externally blocked, deferred, testnet-only, provisional, or post-Genesis item and prove none is incorrectly represented as a satisfied Genesis requirement.
16. **Reproducible release assembly** — build the complete Genesis release from a clean environment and produce deterministic manifests, version identifiers, hashes, deployment artifacts, and provenance records.
17. **Final reconciliation matrix** — classify every Genesis requirement as `IMPLEMENTED`, `QUALIFIED`, `DOCUMENTED`, `BOUND TO RELEASE`, `ADVERSARIALLY READY`, or `BLOCKED`, with an owner and evidence link for every non-complete item.

### Exit criteria

The reconciliation gate passes only when:

- every Genesis requirement has one canonical owner and source of truth;
- all consensus-critical ambiguities are resolved;
- all required implementations and integrations are qualified;
- exact release identities and hashes are frozen;
- allocation, contract, application, service, and dependency inventories reconcile without unexplained differences;
- all known blockers are either closed or explicitly proven non-blocking for the intended Genesis release;
- the complete release can be reproduced from clean inputs; and
- a signed/committed Genesis reconciliation report records an explicit **GO** for adversarial qualification.

**Deliverable:** canonical Genesis requirements matrix, dependency/inventory manifest, reproducible release manifest, unresolved-blocker register, and explicit reconciliation go/no-go report.

## 14. Attack the economics and consensus
Sybil simulations, validator concentration, correlated failures, randomness manipulation, reward gaming, Attention fraud, treasury abuse, and stress tests.

This phase begins only after the Genesis requirements reconciliation gate passes so adversarial testing targets the exact release candidate rather than a moving collection of components.

**Deliverable:** adversarial simulation report tied to the reconciled Genesis release identity.

## 15. Public testnet — PREPARATION ACTIVE
Open validator qualification, faucet, public dApp deployment, bug bounties, telemetry, upgrades, and community testing.

Shared-service and application launch gates are being completed before public exposure. Every public-testnet application must bind to an exact qualified release identity, preserve chain/service provenance, pass its failure drills, and record an explicit go/no-go closeout. Public-testnet promotion requires both the Genesis requirements reconciliation gate and adversarial qualification to pass against the same release lineage.

### Testnet-gated work queue

The following workstreams are repository-implemented but deliberately remain open for production-equivalent/public-testnet evidence. They must not be represented as unfinished greenfield implementation merely because live evidence does not yet exist.

#### Genesis applications awaiting live qualification

- **420 Wallet — live network/device release qualification.** Repository implementation is merged through W13 and W14 provides the live-testnet qualification machinery. Remaining testnet work is to resolve the real testnet manifest/deployment inventory, bind the Wallet runtime to the exact chain/RPC/Explorer/Faucet and deployed contract addresses, verify deployed bytecode and service reachability, exercise real send/dApp/session/recovery paths and retain exact-release evidence. Genuine physical Android/iPhone closeout remains a separate release gate and is not satisfied merely by launching testnet. See `docs/420WALLET-W14.3-LIVE-TESTNET.md`.
- **420 Explorer — production-equivalent deployment qualification.** Repository implementation is complete/merged, but `testnet/public-services/explorer/readiness.json` remains deployment-pending with placeholder endpoints. Remaining work is live Explorer/Indexer/RPC/Registry binding, real-chain smoke, restart/recovery/reorg/finality/freshness qualification and retained deployment evidence.
- **420 Search — SEARCH-9 live qualification.** SEARCH implementation is repository-complete; remaining work is live 420Indexer integration, seeded domain witnesses, restart/rebuild/reorg validation, real endpoint evidence and final closeout against the deployed release. See `docs/420SEARCH-ROADMAP.md`.
- **420 Analytics — ANALYTICS-9/10 live qualification and closeout.** Repository implementation is complete through ANALYTICS-8 and the readiness record intentionally keeps `liveTestnetEvidence=false`. Remaining work is live 420Indexer-backed metric/snapshot evidence, restart/rebuild/reorg qualification, retained machine-readable evidence and ANALYTICS-10 closeout. See `docs/420ANALYTICS-ROADMAP.md` and `docs/420ANALYTICS-9-TESTNET-QUALIFICATION.md`.
- **420 Verify — public endpoint deployment/qualification.** VERIFY-0 through VERIFY-10 are complete and merged. Remaining work is to deploy the backend/frontend, compiler catalogue/cache and evidence store against the real testnet, run public endpoint/reproducibility smoke, retain deployment evidence and advance `testnet/public-services/verify/readiness.json` from `PENDING_DEPLOYMENT`. See `docs/420VERIFY-ROADMAP.md`.
- **420 AppStore — public testnet deployment/integration qualification.** Repository implementation is qualified and merged while `testnet/public-services/appstore/readiness.json` remains `PENDING_PUBLIC_TESTNET`. Remaining work is live Registry/Verify/Explorer/Wallet binding, catalogue rebuild/deprecation/restart/dependency-failure drills, real public endpoints and retained deployment evidence. See `docs/420APPSTORE-ROADMAP.md`.
- **420 Notifications — live delivery/provider qualification.** Repository implementation and NOTIFY-10 closeout are merged. Remaining work is deployment of `notifications420`, live 420Indexer binding, real in-app/web/push provider configuration, delivery/dedup/replay/reorg/restart/provider-outage drills, public endpoint qualification and retained evidence. See `docs/420NOTIFICATIONS-ROADMAP.md`.
- **420 Status — live service-probe and incident/recovery qualification.** Repository implementation and STATUS-10 closeout are merged. Remaining work is deployment of `status420`, real service probes, freshness/conflict/outage/maintenance/incident/recovery drills, public endpoint qualification and retained production-equivalent testnet evidence. See `docs/420STATUS-ROADMAP.md`.
- **420 Registry — REG-AUDIT-8 production-equivalent deployment and later closeout.** Repository audit/remediation through REG-AUDIT-7 is complete. Remaining work begins with deploying the reconciled ProtocolRegistry candidate to the production-equivalent testnet and recording chain/environment, exact release SHA, address/predeploy proof, runtime code hash, governance authority, smoke reads/strict publication, deprecation/history and restart/recovery evidence; REG-AUDIT-9/10 follow only after that live evidence exists. See `docs/audit/420REGISTRY-COMPLETE-AUDIT-20260928.md`.
- **420 Gaming Protocol — GP-15 live testnet qualification.** The live-qualification harness is repository-complete but runtime deployment remains unresolved. Remaining work is to resolve the actual testnet manifest/contract/operator addresses, verify live RPC/bytecode, and execute the four-game registry plus profile, entitlement, migration and cross-game attestation/revocation journeys against the deployed contracts. See `docs/gaming/420GP-15-LIVE-TESTNET.md`.
- **420 Faucet — testnet-only operational deployment.** Faucet exists only on testnet by design. Remaining work is to publish the official testnet manifest/service endpoint, fund/configure the dedicated test account/hot wallet, enforce the frozen distribution/rate-limit/CAPTCHA/emergency-pause policy, verify real distribution transactions and keep all production/mainnet keys and economics excluded.

- **GEN-11 / 420 Bundler Network — live operator and release qualification.** GEN-11.0 through GEN-11.20 repository implementation is merged; PR #341 merged at `a57cfb45b73548bc94317528d13b17f6a11ef194`. Remaining GEN-11 work is deployment/testnet-specific: deploy and exercise at least two independently controlled Bundlers on the same verified chain/EntryPoint; qualify live Wallet web/CORS, extension, mobile and native/API paths; prove pre-send fallback and ambiguous-send quarantine/reconciliation; execute wrong-chain/EntryPoint, stale-node, hostile-response, overload, restart, reorg/orphan and unresolved-intent recovery drills; verify `fifo-v1` ordering/economic neutrality under deployed settings; retain actual transaction/block/operator evidence; and perform final exact-release CI/security/deployment signoff. Canonical status and gates are defined in `docs/420BUNDLER-ROADMAP.md` and `docs/GEN-11.20-BUNDLER-CLOSEOUT.md`. Until that live evidence exists, GEN-11 repository implementation remains complete while operational release signoff remains open.

#### Shared service dependencies awaiting live qualification

These are not additional Genesis applications, but their live qualification is required by the applications above.

- **420Indexer — IDX-10 live qualification/closeout.** Run the production ingestion path against the real testnet, retain smoke/restart/reorg/consumer-witness evidence, exact node/indexer revisions and descriptor/artifact digests, then produce the blocker-free deployment closeout. See `docs/420INDEXER-TESTNET.md`.
- **420RPC — RPC-12 public-testnet qualification/closeout.** Bind the real HTTPS/WSS endpoints and execution/indexer providers, run the live compatibility witness set plus auth/resource/failover/wrong-chain/finality-conflict/subscription/readiness-recovery drills, and retain exact release evidence. See `docs/420RPC-TESTNET-CLOSEOUT.md`.
- **420Automation — AUT-12 public-testnet qualification/closeout.** Deploy the candidate with real RPC/Oracle dependencies, prove live worker/job availability, exercise all trigger classes, lease failover, replay suppression, ambiguous-submission recovery, wrong-chain/finality/hostile-observation/resource/auth/readiness drills and retain the final go/no-go evidence. See `docs/420AUTOMATION-AUT12-TESTNET.md`.
- **420Gas / Paymaster — GAS-12 public-testnet qualification/closeout.** GAS-0 through GAS-11 are complete/merged and GAS-12 is the next phase. Pin the exact release/deployment identity, collect live Paymaster deposit/reservation/settlement plus Wallet/Automation evidence, execute failure/recovery drills, verify compatibility with `EntryPoint420`, Wallet, 420RPC, Registry and Automation, and retain the machine-readable go/no-go report. See `docs/420GAS-ROADMAP.md`.

**Deliverable:** stable public 420 testnet tied to a reconciled and adversarially qualified release candidate.

## 16. Independent audit and launch review
Audit consensus-critical Go code, system contracts, genesis allocations, validator economics, bridges/oracles, and regulatory launch structure before considering mainnet.

The audit target must be the exact reconciled, adversarially qualified, public-testnet release lineage. Any audit remediation that changes consensus-critical or Genesis-critical behavior must re-enter the applicable reconciliation and qualification gates before launch.

**Deliverable:** release candidate and launch/no-launch review.
