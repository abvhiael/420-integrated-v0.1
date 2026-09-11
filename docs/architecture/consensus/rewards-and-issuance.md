---
title: Rewards and issuance
component: consensus-rewards
audience:
  - validator
  - operator
  - developer
  - architect
category: architecture
status: development
version: current
---

# Rewards and issuance

This page documents the consensus reward and native `$420` issuance model used by 420 Integrated during the bounded-validator phase. It separates consensus-critical issuance arithmetic from execution settlement and from transaction-fee economics.

`fourtwentyd` is authoritative for deterministic reward arithmetic and the set of validators that actually earned a reward for a finalized block. `RewardController` is the execution-side receiver/accounting surface for the finalized consensus result. Ordinary users, governance, Wallet sessions, and dApps cannot manufacture issuance through this path.

## Monetary-policy anchors

The current protocol configuration defines these issuance anchors:

- initial gross block issuance: **4.2 `$420`**;
- issuance-reduction interval: **420,000 blocks**;
- reduction rate: **0.420% per interval**;
- tail floor: **0.420 `$420` per block**;
- native currency precision: **18 decimals**;
- consensus-critical monetary arithmetic must use deterministic integer/fixed-point rules rather than floating point.

Issuance is protocol-created value. It is distinct from transaction fees, transfers of already-existing `$420`, slashed collateral, treasury spending, or application-level token accounting.

## Gross issuance versus realized issuance

For each successfully certified execution block, consensus first determines the protocol's gross issuance for that block under the issuance curve.

Not every theoretically available reward unit must become realized issuance. In particular:

- a missed proposer duty produces no proposer issuance for that missed duty;
- an active validator that does not provide the required valid participation does not receive its participation share;
- missed participation shares are not redistributed to the proposer or other validators;
- deterministic rounding remainder that the protocol elects not to allocate remains unissued.

This means tooling should distinguish:

- **scheduled/theoretical issuance** — the maximum amount implied by the monetary schedule before duty failures and deterministic non-issuance; and
- **realized issuance** — the amount actually applied to execution state after consensus evaluates participation and rounding.

## Dynamic top-level allocation

The canonical monetary-policy model uses the actual active-validator count to determine the Security share during the bounded-validator phase.

At **15 active validators**:

- Security: approximately **28.3446712018%**;
- Attention: approximately **35.8276643991%**;
- Development: approximately **35.8276643991%**.

As the active committee grows, Security rises linearly until the mature bounded-validator split at **30 active validators**:

- Security: **50%**;
- Attention: **25%**;
- Development: **25%**.

Attention and Development each receive one half of the non-Security remainder.

During an adjacent-tier committee migration, allocation uses the **actual finalized active-validator count for that rotation**, including transitional sizes such as 16, 17, 19, or 20. Reward arithmetic must not pretend the committee has already reached the destination stable tier.

A fixed 50/25/25 split is therefore the mature 30-validator endpoint, not the universal bounded-era split at smaller committees.

## Security allocation

The Security allocation is split between the successful proposer and the other successful active validators.

The intended deterministic structure is:

```text
proposerAmount = floor(Security / 2)
participantPool = Security - proposerAmount
perParticipant = floor(participantPool / (N - 1))
```

where `N` is the actual active committee size for the block.

The successful proposer receives the proposer allocation. Every other active validator is eligible for one equal participation unit only if it supplied the required valid participation for that block.

At the 15-validator committee size this corresponds to one proposer plus up to 14 participant rewards. At larger or transitional committees the divisor follows the actual active count rather than assuming 14 participants.

## Successful fallback proposer

A block produced by an authorized fallback proposer is economically treated as the successful proposer for that slot.

Therefore:

- fallback #1 or fallback #2 receives the full proposer reward when it successfully proposes the certified block;
- the missed primary does not also receive proposer issuance;
- fallback success does not alter future scheduled proposer opportunities;
- reward accounting follows the block that actually became certified/canonical, not the identity originally ranked primary.

## Missed participation

Missed participation is handled by **non-issuance**, not redistribution.

If an otherwise active validator fails to provide the valid participation required for the finalized block:

1. its participant share is not issued;
2. that amount is not reassigned to the proposer;
3. it is not divided among the other participating validators;
4. it does not become treasury revenue merely because participation was missed.

Ordinary missed participation is therefore an availability/reward consequence, not by itself a principal-slashing event. DOC-4.6 documents the distinction between reward non-issuance and slashable safety faults.

## Rounding and conservation

Consensus-critical monetary arithmetic must be deterministic across every client implementation.

The required architecture is:

1. derive gross block issuance using integer/fixed-point arithmetic;
2. calculate the Security allocation deterministically from actual active count;
3. calculate `remaining = gross - Security`;
4. assign `Attention = floor(remaining / 2)`;
5. assign `Development = remaining - Attention`;
6. assign `proposerAmount = floor(Security / 2)`;
7. derive `participantPool = Security - proposerAmount`;
8. derive equal participant units using integer division;
9. do not create extra value to compensate for integer remainder or missed duties.

The execution-applied total must never exceed the gross consensus-authorized issuance for that block.

Any unallocated rounding remainder follows the protocol's explicit non-issuance rule; it must not be silently assigned by implementation convenience.

## Issuance curve

The issuance schedule declines at protocol-defined intervals until it reaches the floor.

Conceptually:

```text
era = floor(blockNumber / 420000)
gross = max(floorIssuance, deterministicDecay(initialIssuance, era))
```

The implementation must derive identical base-unit results on every node. Floating-point exponentiation is not consensus-safe and must not be used for production issuance decisions.

Governance must not be able to increase issuance beyond constitutional protocol bounds through an ordinary governance call.

## Consensus authority

Consensus is responsible for determining the complete reward tuple for a finalized block, including:

- block/issuance era;
- actual active-validator count;
- successful proposer identity;
- successful participant identities;
- gross issuance;
- Security/Attention/Development allocation;
- proposer amount;
- per-participant amount;
- missed-duty non-issuance;
- any deterministic rounding remainder treatment.

Execution does not independently recompute committee performance from logs, RPC state, or application data.

## Execution settlement through `RewardController`

`RewardController` is the canonical execution receiver/accounting contract for native consensus issuance.

Its current interface accepts finalized consensus-provided values for:

- block number;
- proposer;
- participating validator addresses;
- proposer amount;
- per-participant amount;
- Attention amount;
- Development amount.

The contract then records:

- validator accruals;
- gross Security issued;
- gross Attention issued;
- gross Development issued;
- a `RewardApplied` event describing the applied settlement.

The contract intentionally does **not** choose committee membership or recompute consensus arithmetic. The source explicitly places reward arithmetic in `fourtwentyd`.

## Consensus-system-call boundary

Reward settlement uses the privileged native consensus-system path rather than an ordinary user transaction.

Consequences:

- only the immutable/bound consensus-system caller may invoke the consensus reward application entrypoint;
- an EOA, dApp, governance executor, relayer, or Wallet session cannot call it as ordinary protocol authority;
- settlement is incorporated into the canonical execution state transition through the consensus/execution boundary;
- replay and ordering protections must ensure one finalized reward result is not applied more than once.

Reward settlement is therefore protocol state transition, not a user-paid transaction competing in the public mempool.

## Attention and Development settlement

The top-level non-Security allocation is routed to the canonical Attention and Development treasury/accounting destinations defined by protocol deployment.

These allocations are part of the same gross issuance envelope. They are not additional minting layered on top of Security issuance.

Accordingly:

```text
realizedSecurity + realizedAttention + realizedDevelopment <= grossAuthorizedIssuance
```

with equality only when there is no missed-participation or deliberately unissued rounding remainder within the applicable model.

## Transaction fees are separate

Transaction-fee economics are separate from protocol issuance.

DOC-3.5 documents EVM gas, base-fee, and priority-fee behavior. Consensus reward accounting must not silently treat user-paid transaction fees as part of the 4.2 `$420` issuance schedule.

Likewise, a fee paid by a user does not increase gross protocol issuance; it transfers or burns already-existing value according to execution-layer fee rules.

## Committee resizing and rewards

Committee migration does not freeze rewards to the source or destination stable tier.

For example, during a 15 → 18 migration:

- first migration rotation may have 16 active validators;
- second may have 17;
- third reaches 18.

Each rotation uses its actual finalized active count for:

- top-level Security percentage;
- number of non-proposer participant units;
- per-participant division;
- reward accounting and observability.

This matches the committee migration rule that existing validator tenure remains unchanged while newly admitted cohort size changes incrementally.

## Reward observability

Explorer, Indexer, Analytics, and Wallet surfaces may display reward data, but they are derived views.

Useful derived fields include:

- gross scheduled issuance;
- realized issuance;
- proposer reward;
- participation reward per validator;
- missed participation/non-issued amount;
- Security/Attention/Development totals;
- issuance era and current block-level issuance rate.

These projections must remain rebuildable from canonical chain/consensus state and must not become reward authority.

## Reward invariants

- **REWARD-001** — reward arithmetic must be deterministic integer/fixed-point arithmetic; production consensus must not depend on floating point.
- **REWARD-002** — total execution-applied issuance for a block must never exceed the protocol-authorized gross issuance for that block.
- **REWARD-003** — the top-level Security allocation must use the actual finalized active-validator count, including transitional migration sizes.
- **REWARD-004** — a validator's bond size above the required effective bond must not increase its proposer or participation reward weight.
- **REWARD-005** — the successful proposer, including an authorized fallback, is the only validator eligible for that block's proposer issuance.
- **REWARD-006** — missed participation shares must not be redistributed or silently redirected.
- **REWARD-007** — unallocated deterministic rounding remainder must not be converted into extra issuance.
- **REWARD-008** — execution contracts must not independently infer or fabricate consensus participation/reward outcomes.
- **REWARD-009** — only the bound consensus-system path may apply native consensus issuance through `RewardController`.
- **REWARD-010** — Security, Attention, and Development allocations must all fit inside the same gross block-issuance envelope.
- **REWARD-011** — transaction fees must remain economically and accounting-wise distinct from protocol issuance.
- **REWARD-012** — derived reward/indexer views must not become canonical authority for reward settlement.

## Failure and recovery behavior

### Consensus arithmetic disagreement

The node must fail closed rather than apply a reward tuple that disagrees with canonical consensus computation.

### Reward system call rejected

The block/state transition must not silently continue with a partially applied reward result. Consensus/execution recovery must determine whether the payload/state transition is invalid or requires replay from the last trusted boundary.

### Duplicate reward application

Replay protection must prevent a finalized block reward from being applied twice.

### Derived accounting mismatch

Indexer/Explorer reward totals may be rebuilt from canonical state and `RewardApplied` events. A projection mismatch does not authorize a compensating mint.

### Validator unavailable

Reward non-issuance follows the finalized participation result. Operators cannot later claim missed issuance merely by demonstrating that the node returned online.

## Relationship to the remaining DOC-4 pages

- [Consensus overview](consensus-overview.md) defines the consensus/execution authority split.
- [Proposer selection, cohorts, and rotation](proposer-selection-cohorts-rotation.md) defines who is scheduled and the actual active committee used by reward arithmetic.
- [Epochs, fork choice, QCs, and finality](epochs-fork-choice-qcs-finality.md) defines the certification/finality outcome on which reward settlement depends.
- DOC-4.6 defines slashable safety faults and how they differ from ordinary reward non-issuance.
- DOC-4.7 defines recovery when consensus or execution cannot safely settle the finalized reward path.

## Implementation references

- `config/protocol.json`
- `docs/STEP-3-NORMATIVE-VARIABLES.md`
- `docs/PROTOCOL-v0.1.md`
- `contracts/src/system/RewardController.sol`
- `docs/CONSENSUS-SYSTEM-CALL-v1.md`
- `consensus/`
