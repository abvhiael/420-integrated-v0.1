# Dynamic Validator Set and Reward Allocation — v0.4

## Design objective

Scale the number of active validators with the size of the eligible validator pool while keeping only about one quarter of eligible validators active at a time.

The active set grows from **15** to a maximum of **30**.

At full capacity:

- eligible validator pool: **120+**
- active validators: **30**
- validators swapped each rotation: **10**
- mature reward split: **50% Security / 25% Attention / 25% Development**

## Active validator count

During the bonded-validator era:

`active = clamp(floor(eligiblePool × 25%), 15, 30)`

Operationally:

- the bonded handoff requires at least **60 eligible validators**;
- 60 eligible -> 15 active;
- 72 eligible -> 18 active;
- 84 eligible -> 21 active;
- 96 eligible -> 24 active;
- 108 eligible -> 27 active;
- 120+ eligible -> 30 active.

Below the handoff threshold, the protocol remains in the defined bootstrap/readiness state rather than pretending a smaller pool is sufficiently decentralized.

## Rotation size

Rotation remains approximately one third of the active committee.

The intended anchor points are:

- 15 active -> 5 swapped
- 30 active -> 10 swapped

Intermediate committee sizes use deterministic integer rounding defined by the consensus specification.

This preserves the three-rotation active-service concept: a cohort remains active across roughly three rotation periods before aging out, subject to final queue/state-machine rules.

## Smooth issuance-allocation ramp

Initial block issuance remains **4.2 420**.

At 15 active validators, Security receives **28.344671201814%**. This produces approximately a 10% expected subsidy return over the current 52,920-block active-term model.

Security's share rises linearly with the active validator count until it reaches **50% at 30 active validators**.

Formula:

`securityPct = minSecurity + ((active - 15) / 15) × (50 - minSecurity)`

where:

`minSecurity = 28.344671201814%`

and the result is clamped to the range:

`[28.344671201814%, 50%]`

Attention and Development always divide the remainder equally:

`attentionPct = developmentPct = (100 - securityPct) / 2`

## Reference schedule

| Eligible pool | Active | Swap/rotation | Security | Attention | Development | Expected 420 / active term | Return on 42k bond |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 60+ | 15 | 5 | 28.3447% | 35.8277% | 35.8277% | 4,200.0 | 10.000% |
| 72+ | 18 | 6 | 32.6757% | 33.6621% | 33.6621% | 4,034.8 | 9.607% |
| 84+ | 21 | 7 | 37.0068% | 31.4966% | 31.4966% | 3,916.8 | 9.326% |
| 96+ | 24 | 8 | 41.3379% | 29.3311% | 29.3311% | 3,828.3 | 9.115% |
| 108+ | 27 | 9 | 45.6689% | 27.1655% | 27.1655% | 3,759.5 | 8.951% |
| 120+ | 30 | 10 | 50.0000% | 25.0000% | 25.0000% | 3,704.4 | 8.820% |

## Important economic consequence

The system does **not** maintain exactly 10% validator return all the way to 30 active validators.

That is intentional under this design.

The 15-validator state begins at approximately 10%. As the active committee and eligible pool grow, the subsidy return gradually falls. At 30 active validators and the mature 50/25/25 split, the expected subsidy return is approximately **8.82%** per active term under the current block reward, bond, and term assumptions.

This gives early validators a modest bootstrap premium while avoiding an ever-increasing Security allocation.

## Mature state

Once the eligible pool is at least **120** and the active committee reaches **30**:

- active committee stays capped at 30 under this consensus phase;
- 10 validators rotate per rotation;
- Security allocation stays at 50%;
- Attention stays at 25%;
- Development stays at 25%.

Further validator-pool growth increases competition for selection rather than increasing issuance.

A later full permissionless-PoS transition may replace the 30-validator committee model, but it does not automatically alter the 50/25/25 monetary allocation.

## Anti-manipulation requirements

Eligible-pool size is consensus-critical and must count only validators that satisfy all eligibility conditions.

A candidate must not increase the pool count merely by registering a wallet.

At minimum, an eligible validator must have:

- the required effective bond;
- valid validator keys;
- completed activation delay;
- no active slashing/exclusion status;
- operational/readiness requirements required by the protocol;
- no pending withdrawal;
- any required minimum commitment period.

Validator-set size and reward allocation changes should only occur at rotation boundaries, using a finalized eligible-pool snapshot, so a transient registration spike cannot change rewards mid-period.

A hysteresis or persistence rule should also be specified before implementation so the active committee does not oscillate when the eligible pool hovers around a threshold.


## Anti-flapping rule — adopted

Eligible-pool size is sampled only at **rotation boundaries**.

A committee-size change does not occur after a single threshold crossing.

### Increase

If the eligible pool reaches the threshold for a larger active committee, that threshold must remain satisfied for **three consecutive rotation-boundary snapshots** before the larger committee becomes effective.

Example:

- 72 eligible validators corresponds to 18 active validators.
- If the pool reaches 72 for one rotation and falls back to 71 at the next boundary, the committee remains at 15.
- Only after three consecutive qualifying snapshots does the active target increase to 18.

### Decrease

The same three-rotation persistence rule applies when the eligible pool falls below the threshold for the current committee size.

This prevents ordinary validator churn from repeatedly changing:

- active committee size;
- rotation size;
- Security allocation;
- Attention allocation;
- Development allocation.

### Safety exception

If there are no longer enough eligible validators to populate the currently required active committee, safety overrides the persistence delay. The protocol may immediately reduce the active target to the largest committee that can be safely filled under the eligibility rules.

No committee-size or reward-allocation change occurs in the middle of a rotation.
