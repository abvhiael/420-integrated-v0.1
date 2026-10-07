# CMP-6.7 — Transparent reward accounting

Status: **IMPLEMENTED; QUALIFICATION PENDING.**

## Canonical definition

> Transparent reward accounting

CMP-6 provides application-layer incentives for verified useful compute. Compute rewards must not replace chain consensus.

CMP-6.7 introduces an append-only reward policy and an immutable accounting ledger that converts one already-verified CMP-6.3 contribution into a deterministic native-$420 reward-accounting amount for one CMP-6.4 research pool.

## Reward policy

`ComputeUsefulRewardPolicy420` is governance-controlled and append-only.

Each policy revision freezes:

- policy ID;
- research pool ID;
- contribution metric ID;
- numerator;
- denominator;
- per-contribution reward cap;
- publication time;
- revision.

Reward arithmetic is:

`reward = contribution.amount * numerator / denominator`

The result is capped by the frozen per-contribution cap.

The policy itself has no custody, Vault, settlement, minting, transfer, claim or payout authority.

## Canonical reward inputs

`ComputeUsefulRewardAccounting420` accepts no caller-supplied beneficiary, contribution amount, project, metric or pool.

For every accounting entry it reads:

- the exact CMP-6.7 reward policy revision;
- the exact CMP-6.4 research pool;
- the CMP-6.4 `eligibleContribution(poolId, contributionId)` result;
- the exact CMP-6.3 contribution record;
- the current CMP-6.1 pool funding amount.

The contribution beneficiary is the canonical CMP-6.3 contributor.

## Immutable reward record

Every reward record freezes:

- reward ID;
- contribution ID;
- pool ID;
- beneficiary;
- research project reference;
- metric ID;
- contribution amount;
- reward-policy ID;
- reward-policy revision;
- reward-policy commitment;
- numerator;
- denominator;
- final reward-accounting amount;
- pool-funding snapshot;
- credit timestamp.

The event emitted for each reward contains the same critical reconstruction fields.

## Transparent aggregates

The ledger exposes cumulative native-$420 accounting credits by:

- research pool;
- beneficiary;
- metric.

It also exposes `remainingAccountableFunding(poolId)`, calculated from current CMP-6.1 pool funding minus already-accounted CMP-6.7 credits.

## Pool funding invariant

CMP-6.7 never allows cumulative reward accounting for a pool to exceed that pool's observable CMP-6.1 funding.

For a new reward:

- current pool funding is snapshotted;
- existing pool credits are read;
- the new amount must fit entirely inside the remaining observable funding.

CMP-6.1 funding is additive, so later funding can expand future accounting capacity without rewriting any earlier reward record.

## Double-reward prevention

A CMP-6.3 contribution can be accounted as a reward only once globally.

The replay guard is keyed by contribution ID rather than reward-policy revision.

Publishing a later reward-policy revision therefore cannot reward the same contribution a second time.

## Arithmetic safety

Accounting fails closed when:

- the policy is invalid;
- contribution eligibility fails;
- project or metric identity drifts;
- contribution amount is zero;
- multiplication would overflow;
- integer division produces zero reward;
- pool funding is zero;
- existing credits already exceed the current funding snapshot;
- the new reward would exceed remaining pool funding;
- the contribution has already been rewarded.

## Relationship to CMP-6.6

CMP-6.6 protects sponsor-match/funding-side economics through minimum contribution, principal caps, epochs, cooldowns and replay controls.

CMP-6.7 accounts compute-contributor rewards from canonical CMP-6.3 verified contribution records.

These are distinct economic surfaces. CMP-6.7 does not reinterpret a funding principal as a compute beneficiary, and it does not invent a false identity relationship between a sponsor-match contributor and a compute worker/contributor.

## Custody and settlement boundary

CMP-6.7 is a transparent accounting ledger only.

It does **not**:

- move native $420;
- reserve Vault funds;
- create Vault obligations;
- release Vault obligations;
- cancel Vault obligations;
- claim Vault funds;
- withdraw Vault funds;
- mint native $420;
- debit payer escrow;
- slash stake;
- settle Compute jobs;
- alter CMP-6.1 funding records;
- alter CMP-6.2 verification state;
- alter CMP-6.3 contribution records;
- alter CMP-6.4 pool identity;
- alter CMP-6.5 sponsor matching;
- alter CMP-6.6 anti-farming admissions;
- replace chain consensus rewards.

This avoids duplicating the canonical Vault authority already owned by AssetVault420/VaultAccounting420.

## Qualification level

CMP-6.7 is a **Level 2 app integration milestone**.

Reason: it is the final CMP-6 economic convergence point before phase closeout, combining:

1. CMP-6.1 observable funding;
2. CMP-6.3 verified contribution accounting;
3. CMP-6.4 research-pool project/metric binding;
4. append-only reward valuation policy;
5. immutable reward records;
6. pool/beneficiary/metric aggregate accounting;
7. global contribution double-reward prevention.

Level 2 remains app-focused through the retained Compute Market suite.

Repository-wide Level 3 remains deferred to **CMP-6.8 — Phase closeout**.

## Focused qualification

Coverage must prove:

- exact reward-policy inputs are frozen;
- exact arithmetic inputs are visible in every reward record;
- per-contribution caps apply deterministically;
- cumulative pool credits cannot exceed observable CMP-6.1 funding;
- beneficiary aggregates are exact;
- pool aggregates are exact;
- metric aggregates are exact;
- remaining accountable funding is exact;
- one contribution cannot be rewarded twice across policy revisions;
- ineligible contribution fails closed;
- metric mismatch fails closed;
- zero-after-division fails closed;
- overflowing multiplication fails closed;
- reward-policy revisions are append-only;
- historic policy commitments remain immutable;
- no Vault/custody/payout/consensus authority is introduced.

## Exit criteria

CMP-6.7 is COMPLETE only when:

- append-only reward policy exists;
- deterministic metric-to-native-$420 accounting exists;
- immutable reward records expose all reconstruction inputs;
- beneficiary/pool/metric aggregates exist;
- pool funding cannot be over-accounted;
- contribution replay is globally prevented;
- arithmetic edge cases fail closed;
- focused tests and repository verifier pass;
- retained Compute Market Level-2 qualification passes on the exact implementation SHA;
- durable repository evidence records the qualified implementation SHA.

Durable evidence: [CMP-6.7 qualification](CMP-6.7-QUALIFICATION-EVIDENCE.md).

Next canonical step:

**CMP-6.8 — Phase closeout**
