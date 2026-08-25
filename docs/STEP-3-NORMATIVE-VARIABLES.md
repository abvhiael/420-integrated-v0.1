# Step 3 — 420 Integrated Protocol Specification v2
## Normative Variable Checklist

Status: working design specification
Goal: eliminate ambiguity before consensus implementation.

A variable is considered **FROZEN FOR TESTNET** only after:
1. its value/rule is written here or in the canonical protocol config;
2. deterministic arithmetic/rounding is specified;
3. failure behavior is specified;
4. tests can be written against it.

Mainnet values may still change after public-testnet results and audit.

---

# A. Already adopted working rules

## Network economics

- Initial block issuance: **4.2 420**
- Native currency: **420**
- Decimals: **18**
- Target block interval: **12 seconds**
- Issuance reduction interval: **420,000 blocks**
- Issuance reduction: **0.420% per interval**
- Tail floor: **0.420 420/block**

## Dynamic top-level allocation

At the minimum 15-active-validator committee:

- Security: **28.3446712018%**
- Attention: **35.8276643991%**
- Development: **35.8276643991%**

Security rises linearly with active-validator count until:

- 30 active validators -> **50% Security**
- Attention -> **25%**
- Development -> **25%**

Attention and Development always split the non-Security remainder equally.

## Security allocation

Within Security:

- **50%** to successful proposer
- **50%** divided equally among all other successful active validators

A missed validator participation share is **not issued** and is not redistributed.

## Validator population

- Effective bond: **42,000 420**
- Minimum bonded-era eligible pool: **60**
- Active set = **25% of eligible pool**
- Minimum active: **15**
- Maximum active in bounded-validator phase: **30**
- 120+ eligible -> 30 active
- Rotation interval: **42 epochs**
- Epoch length: **420 blocks**
- Rotation interval: **17,640 blocks**
- Rotation turnover: approximately one third of committee
  - 15 active -> 5 swapped
  - 30 active -> 10 swapped
- Active service concept: **3 rotations**
- Working cooldown: **3 rotations**

## Anti-flapping

Eligible-pool size is sampled only at rotation boundaries.

Committee size changes only after the relevant threshold is met for **3 consecutive rotation snapshots**.

Safety exception:
if the existing committee cannot be populated by eligible validators, the protocol may reduce the target immediately to the largest safely fillable committee.

## Bootstrap

- Blocks 1–4,199: bootstrap validator phase
- Earliest bonded-validator handoff: block **4,200**
- Handoff requires readiness conditions, including sufficient eligible validators

## Early validator bond credit

Qualified 42-day testnet validator:

- participant-owned bond: **21,000 420**
- protocol-owned bond credit: **21,000 420**
- effective bond: **42,000 420**

Bond credit:

- non-transferable
- non-spendable
- no independent voting power
- protocol-owned
- recyclable on normal exit/replacement
- subject to slashing policy still to be finalized

---

# B. Variables still required before consensus code

## 1. Exact block/slot timing model — FROZEN FOR TESTNET

Adopted:

- fixed 12-second consensus slots;
- primary proposer window: seconds 0–3;
- propagation: seconds 3–4;
- fallback #1 window: seconds 4–7;
- propagation: seconds 7–8;
- fallback #2 window: seconds 8–11;
- final propagation: seconds 11–12;
- initial receive-clock tolerance: ±500 ms;
- a missed slot creates no execution block and does not increment block height;
- successful fallback receives the full proposer reward;
- isolated missed proposal is not automatically slashable;
- block timestamp = `genesis_time + slot_number × 12`.

---

## 2. Proposer-selection algorithm — FROZEN FOR TESTNET

Adopted:

- equal proposer weight per active validator;
- one rotation-scoped proposer schedule;
- three domain-separated deterministic permutations for primary, fallback #1, and fallback #2;
- distinct proposer identities per slot;
- no stake weighting during bounded-validator phase;
- no mid-rotation reshuffle;
- ejected validators are skipped rather than causing schedule regeneration;
- deterministic fairness debt balances unavoidable remainder assignments;
- schedule is regenerated at each rotation boundary from the actual finalized committee, including transitional resize committees.

The schedule consumes finalized `rotationSeed` from Decision 5.

---

## 3. Consensus finality model — CRITICAL

Need exact rule for when a block becomes finalized.

Variables:

- quorum threshold;
- vote/attestation format;
- whether finality is per block or checkpoint;
- whether 2/3, >2/3, or another threshold is required;
- how long finality may lag;
- what clients do during network partitions.

**Recommended starting point:** >= 2/3 of active validator voting weight for checkpoint finality, with equal validator weight during bounded-validator phase.

---

## 4. Fork-choice rule — CRITICAL

If two valid blocks/branches exist, nodes need one deterministic rule.

Need:

- preferred-head rule;
- treatment of justified/finalized checkpoints;
- tie-breaking rule;
- reorganization constraints;
- maximum reorg after finality.

**Recommended direction:** finalized checkpoint always wins; among non-finalized descendants use latest valid attestation weight, with deterministic tie-break.

---

## 5. Randomness construction — CRITICAL

Random validator selection must not depend on a manipulable block hash.

Need:

- source of entropy;
- contribution format;
- commit/reveal or RANDAO-like accumulation;
- withholding penalty;
- when a seed becomes known;
- which seed selects the next rotation;
- fallback when contributions are missing.

**Recommended direction:** validator randomness contributions accumulated across the prior rotation, mixed into a finalized seed for the next selection.

---

## 6. Validator activation delay

A new bond should not instantly affect committee size or enter selection.

Need:

- minimum waiting period after bonding;
- readiness test;
- activation-boundary rule.

Candidate:

- **1 full rotation** activation delay.

This makes validator-pool snapshots harder to manipulate.

---

## 7. Validator exit rules

Need exact lifecycle:

`Eligible -> Active -> Cooldown -> Eligible`
and
`Eligible/Active -> ExitPending -> Withdrawable`

Variables:

- voluntary-exit notice;
- whether active validator may exit mid-term;
- withdrawal delay;
- whether cooldown precedes withdrawal;
- treatment of protocol bond credit;
- exit queue if many leave simultaneously.

---

## 8. Withdrawal delay

Bond must remain slashable after duties cease.

Need exact number of rotations/days.

Candidate values:

- 3 rotations ≈ 7.35 days
- 6 rotations ≈ 14.7 days
- 12 rotations ≈ 29.4 days

**Recommended starting point:** 6 rotations after final active duty before owned stake is withdrawable.

---

## 9. Slashing schedule — CRITICAL

Must distinguish availability faults from provable malicious faults.

Need exact offenses and penalties:

### Inactivity
- missed proposal;
- missed attestation;
- prolonged downtime.

### Slashable behavior
- double proposal;
- double vote;
- surround/conflicting vote if applicable;
- signing conflicting finalized histories;
- invalid consensus message;
- equivocation.

Need:

- percentage or fixed penalty;
- participant-owned stake vs protocol credit ordering;
- forced ejection;
- exclusion duration;
- correlation multiplier for mass coordinated faults.

---

## 10. Bond-credit slashing priority

Because a matched validator has:

- 21,000 owned stake;
- 21,000 protocol credit;

we need to define whose collateral absorbs a slash.

Candidate rule:

1. inactivity penalties affect rewards first;
2. ordinary slash applies proportionally to owned and credited collateral;
3. severe equivocation can slash up to all participant-owned stake and revoke/burn protocol credit;
4. revoked credit never becomes liquid to validator.

This requires explicit arithmetic.

---

## 11. Validator minimum service commitment

Need to prevent qualify -> activate -> immediately exit.

Variables:

- minimum registered service period for protocol-credit validators;
- whether self-funded validators have same restriction.

Candidate:

- **6 months minimum commitment for protocol-credit validators**
- ordinary self-funded validators governed only by standard exit delay.

---

## 12. Bond-credit replacement

Already conceptually accepted; need exact rule.

Questions:

- can validator replace credit partially?
- minimum replacement increment;
- when returned credit becomes reusable;
- whether replacement is permitted while active;
- how pending slash evidence affects replacement.

Recommended:

- partial or full replacement permitted;
- credit cannot be released until replacement stake is finalized and no slash is pending.

---

## 13. Active-set quantization — FROZEN FOR TESTNET

Adopted: **Option B**

Allowed active committee sizes:

- 15
- 18
- 21
- 24
- 27
- 30

Eligible-pool thresholds:

- 60 -> 15
- 72 -> 18
- 84 -> 21
- 96 -> 24
- 108 -> 27
- 120+ -> 30

Each committee consists of three equal cohorts, and one full cohort rotates out per rotation.

Three consecutive qualifying rotation-boundary snapshots are required before moving between tiers, except for the adopted safety fallback.

---

## 14. Rotation-selection eligibility

Need define whether:

- continuing validators are predetermined by age/cohort;
- outgoing validators are always oldest cohort;
- incoming validators are uniformly random from eligible non-active pool;
- recently cooled validators compete equally with never-selected validators.

Recommended:
oldest cohort rotates out; incoming cohort sampled uniformly from eligible non-active candidates, subject to cooldown.

---

## 15. Cooldown duration

Working value: **3 rotations ≈ 7.35 days**.

Need decide if this remains fixed as pool grows.

Potential risk:
small candidate pools may repeatedly recycle the same validators.

Possible rule:
- minimum cooldown 3 rotations;
- increase to 6 rotations if eligible pool is below 2× the active-set size after exclusions.

---

# C. Monetary arithmetic variables

## 16. Integer issuance formula

Consensus cannot use floating point.

Need define issuance in base units.

Reduction:

`rewardEraN = max(floorReward, reward0 × decay^N)`

Need decide:

- exact fixed-point scale;
- rounding direction at each era;
- whether reduction compounds from prior era or is derived directly from genesis value;
- floor comparison before/after rounding.

**Recommended:** direct-from-genesis integer exponentiation using fixed-point constants and round-down, eliminating cumulative implementation drift.

---

## 17. Dynamic allocation rounding

Security percentage contains decimals.

Need exact base-unit rule so:

`Security + Attention + Development <= gross issuance`

and every client produces identical values.

Recommended:
1. calculate Security in base units using fixed-point;
2. remaining issuance = gross - Security;
3. Attention = floor(remaining / 2);
4. Development = remaining - Attention.

That guarantees no value is lost to rounding.

---

## 18. Security reward rounding

Need exact rule for dividing 50% participant pool among `N-1` validators.

Recommended:
- proposer receives floor(Security / 2);
- participantPool = Security - proposer;
- each valid participant receives floor(participantPool/(N-1));
- undistributed remainder follows an explicit policy.

Best policy candidate:
**do not issue the rounding remainder**.

---

## 19. Missed participation issuance

Working policy:
missed participation share is not issued.

Need specify whether total-supply accounting records:

- theoretical scheduled issuance;
- realized issuance;
- both.

Recommended explorer/API exposes both.

---

## 20. Transaction fees

Still undecided.

Need choose:

- base fee?
- base fee burned?
- priority fee to proposer?
- any fee share to validators?
- minimum gas price?
- system transactions exempt?
- fee-market parameters.

Recommended starting model:
Ethereum-style base fee burned + priority fee to proposer.

This keeps fees economically separate from the 4.2 issuance allocation.

---

# D. Genesis variables

## 21. Final genesis supply

Working candidate:
**42,000,000 420**

Needs explicit testnet freeze, then mainnet review.

---

## 22. Exact genesis allocation

Current concepts include:

- founders/core contributors: 1,000,000
- Community/Testnet Treasury: 8,400,000
- Attention bootstrap
- Development bootstrap
- public/liquidity allocation
- protocol reserve
- validator/bootstrap state

Need choose exact values summing to 42M.

---

## 23. Founder vesting

Current:
10 wallets × 100,000 = 1,000,000.

Need:

- cliff;
- vesting duration;
- linear/step vesting;
- departure treatment;
- destination of unvested allocation.

Recommended candidate:
**6-month cliff + 30-month linear vesting**, total 36 months.

---

## 24. Community/Testnet liquid rewards

We adopted separate bond-credit and liquid-contributor tracks.

Need exact allocation and schedule.

Need define:

- standard participation reward;
- points/tier schedule;
- bug-bounty bands;
- maximum per person/address/category;
- vesting for large rewards;
- anti-farming rules.

---

## 25. System contract addresses

Need freeze reserved address range for:

- RewardController
- AttentionTreasury
- DevelopmentTreasury
- ValidatorRegistry
- CommunityTreasury
- ProtocolReserve
- Governance
- Randomness
- possibly UpgradeManager

Addresses must be deterministic and collision-safe.

---

## 26. Chain IDs

Need distinct IDs for:

- local devnet;
- public testnet;
- mainnet.

Historical 420 and 2020 should not automatically be reused.

Need collision check before freezing.

---

# E. Governance and upgrades

## 27. Constitutional vs governable parameters

Need an explicit table.

Likely constitutional:

- native currency unit;
- issuance curve;
- 4.2 initial reward;
- 0.420% reduction interval/rate;
- 0.420 floor;
- mature 50/25/25 maximum allocation;
- no governance ability to increase issuance.

Likely governable within bounds:

- treasury grant allocations;
- eligibility operational requirements;
- non-consensus dApp policy;
- perhaps penalty parameters within hard bounds.

---

## 28. Governance mechanism

Need:

- who votes initially;
- voting weight;
- quorum;
- proposal threshold;
- voting period;
- timelock;
- emergency powers;
- founder privileges and expiry.

Strong recommendation:
bootstrap multisig only for operational matters, with explicit self-expiry and no authority over constitutional issuance.

---

## 29. Protocol upgrade mechanism

Need define:

- how hard forks are scheduled;
- activation conditions;
- minimum notice;
- client-version signaling;
- whether governance can activate upgrades automatically;
- emergency patch process.

Recommended:
governance proposes; client releases implement; activation requires explicit future epoch/block and readiness threshold.

---

# F. Execution/consensus boundary

## 30. Engine API contract

Need define exact interaction between 420 consensus client and execution client:

- payload construction;
- forkchoice updates;
- payload validation;
- system reward application;
- validator-set queries;
- failure handling.

This becomes a formal interface specification.

---

## 31. System transactions / system calls

Need decide how protocol issuance and validator-state changes enter execution state.

Options:

- privileged system calls from consensus;
- special transaction type;
- predeploy calls with reserved caller.

Recommended:
consensus-triggered system calls to deterministic predeploys, modeled explicitly and excluded from ordinary user authorization.

---

## 32. EVM compatibility level

Need select the upstream execution release/fork rules for testnet.

Questions:

- which Ethereum hard-fork feature set?
- EIP-1559?
- withdrawals-related EVM changes?
- blobs / EIP-4844 support?
- future upstream synchronization policy?

Goal:
maximum tooling compatibility with minimum custom execution changes.

---

# G. Network safety and operations

## 33. Peer discovery / bootnodes

Need:

- initial bootnodes;
- DNS discovery;
- node-record format;
- network ID;
- minimum peer recommendations.

---

## 34. Validator key model

Need separate:

- consensus signing key;
- withdrawal address;
- operator address;
- fee-recipient address.

Need rotation/recovery rules.

---

## 35. Emergency consensus behavior

Need define behavior if:

- <2/3 validators online;
- <1/2 online;
- network partitions;
- random seed unavailable;
- validator registry unavailable;
- catastrophic client bug.

The protocol should prefer halting safely over finalizing conflicting histories.

---

## 36. Testnet-only reset authority

For early devnets/testnet, decide whether operators can intentionally reset the chain.

Public testnet should have a clearly disclosed reset policy.

Mainnet must have none.

---

# H. Transition to full permissionless PoS

## 37. Definition of “full PoS”

Need define what changes relative to bounded-validator phase.

Possible characteristics:

- no 30-validator active cap;
- larger validator committee;
- stake-weighted or capped-weight selection;
- committees/subcommittees;
- shorter selection intervals;
- changed finality mechanics.

---

## 38. PoS transition trigger

Could use:

- minimum eligible validator count;
- minimum bonded stake;
- minimum sustained network age;
- testnet/audit milestone;
- explicit protocol upgrade.

Recommended:
multiple conditions, not a single date.

---

## 39. Stake weighting after bounded phase

Need decide whether 42,000 remains:

- one validator unit;
- minimum stake with additional weight;
- capped weight;
- multiple validator keys per multiple bond units.

This has major decentralization implications.

---

# Recommended decision order

Before implementation, decide these first:

1. **active-set quantization** — 15/18/21/24/27/30 vs every integer;
2. **slot/fallback timing**;
3. **proposer-selection schedule**;
4. **finality threshold/model**;
5. **fork-choice rule**;
6. **randomness design**;
7. **activation delay**;
8. **exit + withdrawal delay**;
9. **slashing rules**;
10. **bond-credit slashing/replacement**;
11. **fee policy**;
12. **exact integer reward arithmetic**;
13. **genesis allocation**;
14. **governance/upgrade boundaries**;
15. **full-PoS transition definition**.

Once items 1–12 are fixed, we can begin implementing the consensus state machine without continually rewriting its foundations.

## 17. Implementation architecture — FROZEN FOR TESTNET

- `fourtwentyd` consensus daemon; `node420` execution client;
- private JWT Engine API; libp2p consensus P2P;
- Solidity + Foundry contracts;
- Cannaseur replaces Whale/Publisher application terminology;
- opt-in wallet-native Cannaseur advertising with non-executable ads and anti-Sybil rewarded engagement;
- verified 420-side cross-chain gateway live at genesis; immediate bridge use requires source-side gateway deployed/verified before genesis;
- ApprovedQuoteAssetRegistry selects canonical gateway-backed stable settlement asset;
- exact bridge verification primitive deferred to dedicated security decision.
