# Validator Economics — v0.2

## Current assumptions

- Initial block issuance: **4.2 420**
- Validator bond: **42,000 420**
- Active validators: **15**
- Active term: **52,920 blocks**
- Security share of protocol issuance: **34%**
- Proposer share of Security allocation: **50%**
- Other-validator participation share: **50%**, divided equally among the other 14 active validators
- Uniform proposer selection and full participation assumed
- Transaction fees/tips excluded

## Per-block issuance

Total issuance: **4.2 420**

- Security: **1.428000 420**
- Attention: **1.386000 420**
- Development: **1.386000 420**

Within Security:

- Successful proposer: **0.714000 420**
- Remaining participant pool: **0.714000 420**
- Each of the other 14 active validators: **0.051000000000 420**, if participating

## Expected validator earnings per active term

Over **52,920 blocks**, an evenly selected validator is expected to:

- propose **3,528 blocks**
- participate as a non-proposer in **49,392 blocks**
- earn **2,518.992 420** from proposer duties
- earn **2,518.992 420** from non-proposer participation
- earn **5,037.984 420 total**

On a **42,000 420** bond, that is an expected active-term subsidy return of:

**11.995%**

This replaces the earlier 5% target-derived issuance model. The block reward is now the fixed design choice, and validator return is the resulting output.

The reward will still decline by **0.420% every 420,000 blocks** until it reaches the **0.420 420** floor.
