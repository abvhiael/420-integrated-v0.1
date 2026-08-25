# 420 Integrated Protocol v0.1 — Working Draft

## 1. Network identity

**Network:** 420 Integrated  
**Native currency:** `420`  
**Decimals:** 18  
**Block target:** 12 seconds  
**Execution environment:** EVM-compatible  
**Execution architecture:** modern Go-Ethereum-derived execution layer  
**Consensus architecture:** independent 420 consensus component communicating with the execution layer.

`FourTwenty` is the preferred internal source-code stem where an identifier is required.

## 2. Monetary constitution

Every unit of protocol-created block issuance has one of three purposes:

- **34% Security**
- **33% Attention Economy**
- **33% Development Ecosystem**

Current proposed decay:

- reduction interval: **420,000 blocks**
- reduction: **0.420%**
- permanent floor: **0.420 420 per block**

The current modeled initial block issuance is **1.7507002801120448 420 per block**. This value is chosen so that, at genesis conditions, a validator bonding 42,000 420 has an expected protocol-subsidy return of **2,100 420 (5%)** over one complete 52,920-block active term, assuming full participation and uniform proposer selection.

The top-level 34/33/33 split and the rule preventing governance from increasing monetary issuance are intended to become constitutional consensus rules.

## 3. Validator system

### Active set
15 active validators.

### Rotation
One consensus epoch is 420 blocks.

Every 42 epochs:

- 5 oldest validators rotate out;
- 10 continue;
- 5 eligible candidates are selected using verifiable protocol randomness.

42 epochs = 17,640 blocks = about 2.45 days at the 12-second target.

A validator remains active for three rotations:

- 52,920 blocks;
- approximately 7.35 days.

### Cooldown
Current draft: three rotations (approximately 7.35 days) before the validator can return to the eligible selection pool.

### Bond
Current draft minimum:

**42,000 420**

The bond is collateral, not a payment. It remains locked through active service and cooldown. A separate withdrawal-delay parameter still needs to be chosen.

### Candidate pool
Permissionless random rotation should not activate until at least 42 eligible candidates exist.

## 4. Bootstrap

Blocks 1–4,199 are produced under the predetermined launch/bootstrap validator configuration.

At block 4,200 — approximately 14 hours after genesis at target block time — the protocol hands authority to the bonded-validator system, subject to the final launch-readiness rules we choose.

The intent is to make founder privilege short, explicit, observable, and automatically expiring.

## 5. Security reward distribution

Of the 34% Security allocation:

- 50% goes to the successful block proposer;
- the remaining 50% is divided equally among the other 14 active validators who successfully perform their required participation duties.

With 15 validators, a proposed block has one proposer and 14 other validators eligible for participation rewards.

A validator that fails its required participation does not receive that participation payment. The missed amount is not redistributed; it is not issued.

This avoids rewarding remaining validators merely because a peer is offline.

## 6. Attention Fund

The Attention Treasury receives 33% of eligible protocol issuance. It funds measurable, useful participation: viewers, creators, Whales/publishers, verification, curation, provenance participation, and future application-specific activities.

It must not be implemented as a naive per-click faucet.

Rewards should be aggregated into epochs and protected against Sybil/replay/fraud attacks.

## 7. Development Fund

The Development Treasury receives 33% of eligible protocol issuance and funds core protocol work, audits, infrastructure, open-source dApps, tooling, grants, and ecosystem development.

Genesis may provide a bootstrap reserve in addition to ongoing issuance.

Treasury governance must be separate from authority to alter the monetary constitution.

## 8. Genesis

Genesis will be generated from machine-readable configuration rather than maintained by hand.

It will establish at minimum:

- chain/network configuration;
- initial native-420 balances;
- system-contract code/storage or deterministic deployment state;
- validator bootstrap state;
- validator bonds or bootstrap collateral;
- Attention Treasury bootstrap balance;
- Development Treasury bootstrap balance;
- transparent genesis allocation manifest.

All final genesis inputs and hashes will be published before a public network launch.

## 9. Open principles

1. Keep changes to upstream Geth as small as practical.
2. Consensus-critical arithmetic uses deterministic integers/fixed point, never floating point.
3. Monetary-policy computation cannot depend on an oracle.
4. Validator selection randomness must not be directly manipulable by a single proposer.
5. Genesis must be reproducible.
6. System contracts must have explicit and minimal authority.
7. Every privileged bootstrap capability must have a documented removal/expiry path.
