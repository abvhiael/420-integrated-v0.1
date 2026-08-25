# Step 3 Decision 3 — Proposer Selection

Status: **FROZEN FOR TESTNET**

## Objective

Assign one primary proposer and two ordered fallback proposers to every 12-second slot while providing:

- equal proposal weight per active validator;
- deterministic schedules;
- cryptographic unpredictability before the seed is finalized;
- no stake advantage above the required validator bond;
- no open proposer race;
- distinct proposer identities within each slot;
- stable schedules for the full rotation.

## Equal proposer weight

During the bounded-validator phase:

`one active validator = one proposer scheduling unit`

Stake above the required effective bond does not increase proposer probability.

The same rule applies to validators using protocol bond credit and validators that are fully self-bonded.

## Schedule scope

A proposer schedule is generated once per **rotation**.

Current rotation length:

- 42 epochs
- 420 slots per epoch
- **17,640 slots per rotation**

At each rotation boundary:

1. finalize the active committee for the incoming rotation;
2. consume the finalized `rotationSeed`;
3. build canonical validator ordering;
4. generate three deterministic proposer permutations;
5. freeze the schedule for all slots in that rotation.

No normal mid-rotation reshuffle is permitted.

## Domain-separated proposer permutations

Three independent deterministic shuffles are derived from the same finalized rotation seed using distinct domains:

- `420/primary`
- `420/fallback1`
- `420/fallback2`

Conceptually:

`primarySeed = H(rotationSeed || "420/primary")`

`fallback1Seed = H(rotationSeed || "420/fallback1")`

`fallback2Seed = H(rotationSeed || "420/fallback2")`

Each seed drives a deterministic cryptographic shuffle of the same canonical active-validator list.

The exact hash and shuffle algorithm will be specified alongside the randomness primitive in Decision 5.

## Slot assignment

For slot index `i` within the rotation:

- primary candidate comes from the primary permutation;
- fallback #1 comes from the fallback-1 permutation;
- fallback #2 comes from the fallback-2 permutation.

All three identities must be distinct.

If a fallback permutation yields an identity already used by a higher-ranked proposer for that slot, the scheduler advances deterministically through that fallback permutation until a distinct eligible identity is found.

## Interaction with Decision 2

The selected proposer ranks use the frozen slot windows:

- primary: seconds 0–3;
- fallback #1: seconds 4–7;
- fallback #2: seconds 8–11.

A successful fallback receives the full proposer reward.

Fallback success does not alter that validator's future scheduled primary duties.

## Fairness

The scheduler must distribute **scheduled** primary and fallback opportunities as evenly as mathematically possible.

Fairness is measured from assigned opportunities, not successful blocks. An offline validator is not granted future make-up slots merely because it failed its assigned duty.

Where the number of slots is not exactly divisible by committee size, unavoidable remainder assignments are tracked using deterministic fairness debt.

For example:

- 17,640 / 15 = 1,176 exactly;
- /18 = 980 exactly;
- /21 = 840 exactly;
- /24 = 735 exactly;
- /30 = 588 exactly;
- /27 = 653 remainder 9.

At 27 active validators, nine validators must receive one extra scheduled primary opportunity in a rotation. The fairness state ensures those extra opportunities rotate across persistent validators rather than repeatedly favoring the same identities.

Equivalent balancing applies to fallback assignments.

## Fairness state during committee changes

Fairness debt follows a validator identity only while that validator remains active across consecutive rotations.

A validator that rotates out stops accumulating active-schedule fairness state.

When it later becomes eligible and is selected again, the final implementation may either reset or restore historical debt; for testnet, **reset on reactivation** is the default because it is simpler and cannot materially distort long-run economics across a large pool.

## Ejection during a rotation

If a validator becomes ineligible or is forcibly ejected after the schedule is frozen:

- the rotation schedule is not regenerated;
- scheduled appearances for that validator are skipped;
- the normal fallback hierarchy is used;
- the next rotation receives a newly generated schedule from the new finalized committee.

This prevents slashing/ejection from becoming a mechanism for manipulating a fresh schedule.

## Committee resize migration

Decision 1 now permits transitional active sizes during an authorized three-rotation resize.

A new proposer schedule is generated normally at each rotation boundary using the actual finalized active committee for that rotation.

Example during 15 -> 18 migration:

- first migration rotation: 16 active -> schedule generated for 16;
- second: 17 active -> new schedule generated for 17;
- third: 18 active -> new schedule generated for 18.

The three-rotation validator-tenure invariant remains unchanged.

## Explicit exclusions

During the bounded-validator phase:

- proposer selection is **not stake weighted**;
- excess bonded 420 does not buy more proposer slots;
- block hash is not used directly as proposer randomness;
- validators do not race openly for proposal rights;
- proposer schedules do not change because a fallback successfully proposed;
- schedules do not regenerate mid-rotation after ordinary faults.

## Dependency on Decision 5

Decision 3 consumes a trustworthy finalized `rotationSeed`.

The exact entropy generation, contribution rules, withholding behavior, and cryptographic primitive are intentionally deferred to Decision 5.

Decision 3 is therefore complete at the scheduling layer even though the seed-production mechanism remains to be frozen.
