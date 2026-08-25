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

- **50% Security**
- **25% Attention Economy**
- **25% Development Ecosystem**

Current proposed decay:

- reduction interval: **420,000 blocks**
- reduction: **0.420%**
- permanent floor: **0.420 420 per block**

The current initial block issuance is **4.2 420 per block**. Under the current 50/25/25 allocation and validator economics, this produces an expected **7,408.800 420** protocol-subsidy reward over one complete 52,920-block active term, equal to **17.640%** of a 42,000-420 bond, assuming full participation and uniform proposer selection.

The top-level 50/25/25 split and the rule preventing governance from increasing monetary issuance are intended to become constitutional consensus rules.

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

The Attention Treasury receives 25% of eligible protocol issuance. It funds measurable, useful participation: viewers, creators, Whales/publishers, verification, curation, provenance participation, and future application-specific activities.

It must not be implemented as a naive per-click faucet.

Rewards should be aggregated into epochs and protected against Sybil/replay/fraud attacks.

## 7. Development Fund

The Development Treasury receives 25% of eligible protocol issuance and funds core protocol work, audits, infrastructure, open-source dApps, tooling, grants, and ecosystem development.

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


## 8A. Founders / Core Contributors genesis allocation

The current genesis model reserves:

- **10 founder/core-contributor wallets**
- **100,000 420 per wallet**
- **1,000,000 420 total**
- approximately **2.38095% of the 42,000,000 genesis supply**

This allocation is intended for people actively building and maintaining the project rather than passive promotional allocations.

The final liquidity/vesting treatment is still undecided. The recommended model is to place these allocations under transparent on-chain vesting or time-lock rules rather than making the full 100,000 420 per wallet immediately liquid at genesis.

The allocation must be disclosed in the published genesis manifest, including all addresses, balances, lock rules, and release schedule.


## 8B. 42-Day Testnet Validator Match

The Community/Testnet genesis allocation is currently **8,400,000 420**.

A major use of this allocation is a 42-day public testnet validator qualification program.

A participant who successfully completes the testnet qualification may receive:

- **21,000 420 protocol match**
- participant contributes **21,000 420**
- resulting mainnet validator bond: **42,000 420**

The protocol match is not intended to become immediately liquid. At mainnet launch it is deposited directly into the participant's validator bond.

Because 8,400,000 / 21,000 = 400, the Community/Testnet allocation can support a maximum of **400 full matched-bond awards** if the entire allocation is ultimately used for that purpose.

### Current qualification draft

A full match requires:

- participation during at least **35 of the 42 testnet days**;
- at least **95% validator uptime** during required periods;
- at least **95% successful assigned consensus duties**;
- zero serious consensus faults or slashable test behavior;
- successful mainnet/genesis-readiness check;
- operation of an independent validator node and valid validator keys.

The purpose is to reward actual network operation, not wallet possession or passive registration.

Any unused allocation remains in the Community/Testnet Treasury for later community contribution and validator-decentralization programs unless governance later approves another use under the treasury rules.

## 9. Open principles

1. Keep changes to upstream Geth as small as practical.
2. Consensus-critical arithmetic uses deterministic integers/fixed point, never floating point.
3. Monetary-policy computation cannot depend on an oracle.
4. Validator selection randomness must not be directly manipulable by a single proposer.
5. Genesis must be reproducible.
6. System contracts must have explicit and minimal authority.
7. Every privileged bootstrap capability must have a documented removal/expiry path.


## Dynamic validator-set and allocation ramp

During the bounded bonded-validator phase, the number of active validators is tied to the number of eligible validators:

`active = clamp(floor(eligiblePool × 25%), 15, 30)`

The bonded-validator handoff currently requires at least **60 eligible validators**. At 120 or more eligible validators, the committee reaches its phase maximum of **30 active validators**.

Rotation size scales from **5 of 15** at the minimum committee to **10 of 30** at full capacity, preserving an approximately one-third committee turnover per rotation.

The block reward remains **4.2 420** initially.

The top-level issuance allocation changes smoothly with active-validator count:

- at 15 active validators: Security = **28.344671201814%**
- at 30 active validators: Security = **50%**
- between those points: linear interpolation
- Attention and Development each receive one half of the remaining issuance.

At 30 active validators the monetary allocation becomes the mature **50% Security / 25% Attention / 25% Development** split and remains capped there during this consensus phase.

The expected active-term subsidy return therefore declines gradually from approximately 10% at 15 active validators to approximately 8.82% at 30 active validators, before transaction fees.


### Validator-pool anti-flapping rule

The eligible validator pool is snapshotted only at rotation boundaries.

A larger or smaller active-validator target is adopted only after the corresponding pool threshold has been satisfied for **three consecutive rotation-boundary snapshots**. The active committee size and dynamic reward allocation therefore cannot change in the middle of a rotation.

Safety exception: if the existing active target can no longer be populated by eligible validators, the protocol may immediately reduce the target to the largest safe committee permitted by the eligibility rules.


## Fixed slot timing and proposer fallback

420 Integrated uses fixed **12-second slots**.

Each slot has one primary proposer and two deterministically ordered fallback proposers.

- primary proposal window: 0–3 seconds;
- propagation interval: 3–4 seconds;
- fallback #1 proposal window: 4–7 seconds;
- propagation interval: 7–8 seconds;
- fallback #2 proposal window: 8–11 seconds;
- final propagation interval: 11–12 seconds.

A missed slot creates no execution block and does not increment execution block height.

A successful fallback receives the full proposer reward. An isolated missed primary proposal records an availability failure but is not automatically slashable.

Block timestamps are derived deterministically from:

`genesis_time + slot_number × 12 seconds`

The initial testnet receive-clock tolerance is ±500 ms.


## Proposer schedule

During the bounded-validator phase, active validators have equal proposer weight.

At each rotation boundary the finalized active committee and finalized `rotationSeed` generate three independent domain-separated deterministic permutations for:

- primary proposer;
- fallback proposer #1;
- fallback proposer #2.

The schedule is frozen for the rotation. Each slot must have three distinct proposer identities.

Stake above the effective validator bond does not increase proposal weight.

Ordinary faults or validator ejection do not trigger a mid-rotation reshuffle; invalid/ejected scheduled identities are skipped and the fallback hierarchy continues.

Scheduled opportunities are balanced as evenly as mathematically possible, with deterministic fairness debt used when 17,640 slots are not evenly divisible by the active committee size.

During a three-rotation committee resize migration, a new schedule is generated at every rotation boundary from the actual transitional active committee.
