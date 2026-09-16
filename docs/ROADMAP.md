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

- **420Indexer** — shared rebuildable projection service implemented and qualified for Genesis consumers.
- **420RPC** — public RPC/routing/policy layer implemented through its hardening and qualification roadmap.
- **GEN-10.1 / 420 Wallet** — repository implementation merged through W13. Wallet Core, web, extension and native mobile surfaces are built and qualified. Production Play/TestFlight release remains externally blocked on genuine physical Android/iPhone device evidence.
- **GEN-10.2 / 420 Explorer** — complete, qualified and merged.
- **GEN-10.3 / 420 Search** — SEARCH-0 through SEARCH-10 complete, reconciled, qualified and merged. Search now provides the qualified non-authoritative discovery layer over public canonical/protocol sources.
- **GEN-10.4 / 420 Analytics — CURRENT** — frozen Genesis profile already exists; the next build is the full qualified Analytics consumer/application implementation over canonical public chain and protocol data.
- **GEN-10.5 / 420 Verify — PENDING** — full verification service/application implementation after Analytics.
- **GEN-10.6 / 420 AppStore — PENDING** — full Registry-backed catalogue/curation implementation after Verify.
- **GEN-10.7 / 420 Notifications — PENDING** — full opt-in notification delivery implementation after AppStore.
- **GEN-10.8 / 420 Status — PENDING** — public network/service-health application closeout after Notifications.
- **420Automation** — shared replaceable infrastructure outside the frozen user-facing Genesis app inventory; continue its own qualification/testnet closeout independently of the GEN-10 application sequence.

Protocol-backed Genesis applications continue through their own contract, deployment and integration gates and are not duplicated as contract-free GEN-10 application builds.

**Current handoff:** begin **GEN-10.4 — 420Analytics**.

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

**Deliverable:** stable public 420 testnet tied to a reconciled and adversarially qualified release candidate.

## 16. Independent audit and launch review
Audit consensus-critical Go code, system contracts, genesis allocations, validator economics, bridges/oracles, and regulatory launch structure before considering mainnet.

The audit target must be the exact reconciled, adversarially qualified, public-testnet release lineage. Any audit remediation that changes consensus-critical or Genesis-critical behavior must re-enter the applicable reconciliation and qualification gates before launch.

**Deliverable:** release candidate and launch/no-launch review.
