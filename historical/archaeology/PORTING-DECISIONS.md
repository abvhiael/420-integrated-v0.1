# Step 2 — Porting Decisions

## Rule 1: preserve behavior requirements, not obsolete implementation

No historical consensus function is automatically eligible for porting merely because it once worked.

## Rule 2: WhaleCoin's attention economy becomes a protocol requirement

The historical follower/upvote mechanism establishes provenance for the concept. The new protocol will implement the idea with modern primitives:

- immutable top-level Attention issuance;
- epoch accounting;
- campaign/content registries;
- fraud-resistant interaction proofs;
- anti-Sybil scoring;
- bounded claims;
- transparent reward roots.

## Rule 3: Development funding becomes constitutional

The old Developer's Fund concept is retained but separated from unilateral founder control.

## Rule 4: PUFFScoin's 2019 PoW economics are not inherited

The flat 5-PUFFS Ethash reward and uncle mechanics are historical artifacts only.

## Rule 5: current 420 validator design supersedes historical mining/masternodes

The new consensus specification is authoritative:

- 15 active validators;
- 5 rotate each rotation;
- 420-block epochs;
- 42 epochs per rotation;
- three rotations per active term;
- 42,000 effective bond;
- 21,000 participant-owned 420 + optional 21,000 protocol bond credit for qualified early validators;
- 50% Security share to proposer;
- remaining 50% divided among the other 14 successful active validators;
- missed participation reward is not issued.

## Rule 6: bond credit is accounting, not a token

The testnet-earned 21,000 credit is:

- non-transferable;
- non-spendable;
- non-voting;
- usable only as effective validator collateral;
- protocol-owned;
- recyclable to the Community Validator Reserve on normal exit/replacement;
- subject to final slashing rules.

## Rule 7: historical chain IDs are not automatically reused

420 and 2020 remain historical evidence. Step 3 will reserve a new testnet ID and later a mainnet ID after collision checks.
