# 420 Integrated — 15-Step Build Roadmap

## 1. Recover and preserve historical source
Archive PUFFScoin / 420 Integrated and surviving WhaleCoin code, commits, genesis files, documentation, and known chain parameters.

**Deliverable:** immutable historical-source archive plus hashes.

## 2. Perform ancestry and custom-code diff
Separate:
1. upstream Ethereum code,
2. WhaleCoin-specific modifications,
3. PUFFScoin / 420 Integrated modifications.

Pay particular attention to WhaleCoin reward accumulation, follower/Whale economics, genesis logic, RPC additions, and wallet-facing functionality.

**Deliverable:** code-archaeology report and patch inventory.

## 3. Write 420 Integrated Protocol Specification v2
Define monetary policy, validator lifecycle, randomness, slashing, genesis state, system contracts, governance limits, and consensus transitions.

**Deliverable:** versioned protocol specification.

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

## 12. Build reference wallet / explorer interface
Native 420 balances, validator registration, Attention rewards, Development Fund transparency, dApp interaction, and network status.

**Deliverable:** usable reference wallet and explorer dashboard.

## 13. Attack the economics and consensus
Sybil simulations, validator concentration, correlated failures, randomness manipulation, reward gaming, Attention fraud, treasury abuse, and stress tests.

**Deliverable:** adversarial simulation report.

## 14. Public testnet
Open validator qualification, faucet, public dApp deployment, bug bounties, telemetry, upgrades, and community testing.

**Deliverable:** stable public 420 testnet.

## 15. Independent audit and launch review
Audit consensus-critical Go code, system contracts, genesis allocations, validator economics, bridges/oracles, and regulatory launch structure before considering mainnet.

**Deliverable:** release candidate and launch/no-launch review.
