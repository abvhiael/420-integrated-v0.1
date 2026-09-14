# 420 Integrated — 15-Step Build Roadmap

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

- **420Indexer** — shared rebuildable projection service implemented and qualified through its current roadmap.
- **420RPC** — public RPC/routing/policy layer implemented through its planned hardening/qualification roadmap.
- **420Automation** — AUT-0 through AUT-11 implemented; hostile-state and cross-layer adversarial qualification passed. AUT-11 is in documentation/reconciliation closeout before merge. **Next:** AUT-12 public-testnet qualification and launch closeout.
- **420Explorer / Wallet / remaining Genesis applications** — continue to consume the shared infrastructure and protocol surfaces through their respective roadmaps and qualification gates.

420Automation remains shared replaceable infrastructure, not a new entry in the frozen `config/genesis-applications.json` user-facing application inventory. Its purpose is to support bounded scheduled/conditional execution for approved protocols and dApps without becoming wallet, protocol, Oracle, bridge, consensus, or finality authority.

**Deliverable:** usable reference wallet/explorer plus qualified shared Genesis service infrastructure and application integrations.

## 13. Attack the economics and consensus
Sybil simulations, validator concentration, correlated failures, randomness manipulation, reward gaming, Attention fraud, treasury abuse, and stress tests.

**Deliverable:** adversarial simulation report.

## 14. Public testnet — PREPARATION ACTIVE
Open validator qualification, faucet, public dApp deployment, bug bounties, telemetry, upgrades, and community testing.

Shared-service launch gates are being completed before public exposure. For 420Automation, AUT-12 will require exact release identity, live worker/job evidence, failure drills, compatibility evidence, and an explicit go/no-go closeout.

**Deliverable:** stable public 420 testnet.

## 15. Independent audit and launch review
Audit consensus-critical Go code, system contracts, genesis allocations, validator economics, bridges/oracles, and regulatory launch structure before considering mainnet.

**Deliverable:** release candidate and launch/no-launch review.
