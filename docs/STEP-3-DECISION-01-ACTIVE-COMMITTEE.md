# Step 3 Decision 1 — Active Committee Tiers and Resize Migration

Status: **FROZEN FOR TESTNET — AMENDED**

## Stable committee tiers

The bounded-validator phase has six stable active committee tiers:

- 15
- 18
- 21
- 24
- 27
- 30

Eligible-pool thresholds remain:

| Eligible validators | Stable target |
|---:|---:|
| 60–71 | 15 |
| 72–83 | 18 |
| 84–95 | 21 |
| 96–107 | 24 |
| 108–119 | 27 |
| 120+ | 30 |

The three-rotation anti-flapping rule remains in force before a resize is authorized.

## Validator-tenure invariant

Every validator receives an exact **three-rotation active tenure** when activated.

Normative rule:

`scheduledExitRotation = activationRotation + 3`

Committee resizing never shortens or lengthens an already-active validator's scheduled tenure.

## Adjacent-tier resize migration

A stable committee does not jump immediately to the next stable size.

When expansion is authorized, the size of each **new incoming cohort** increases by one validator. Existing cohorts finish their original three-rotation tenure naturally.

Example: 15 -> 18

- rotation T: `5 + 5 + 5 = 15`
- T+1: `5 + 5 + 6 = 16`
- T+2: `5 + 6 + 6 = 17`
- T+3: `6 + 6 + 6 = 18`

Example: 27 -> 30

- T: `9 + 9 + 9 = 27`
- T+1: `9 + 9 + 10 = 28`
- T+2: `9 + 10 + 10 = 29`
- T+3: `10 + 10 + 10 = 30`

Contraction uses the inverse rule: each newly admitted cohort is one validator smaller, while older larger cohorts age out normally.

## Transitional active-set sizes

Intermediate counts such as 16, 17, 19, 20, 28, and 29 are valid **only during an authorized resize migration**.

The six stable tiers remain the only equilibrium committee sizes.

## Reward allocation during resize

During a resize migration, the dynamic reward split follows the **actual active validator count** for that rotation.

Raw eligible-pool fluctuations still do not directly change rewards. Only an authorized committee resize changes active count.

## Mid-migration reversal

Routine anti-flapping changes do not reverse a resize once it has begun.

The three-rotation migration normally completes before another resize decision can take effect.

The existing safety fallback may override this rule if the committee cannot be safely populated.
