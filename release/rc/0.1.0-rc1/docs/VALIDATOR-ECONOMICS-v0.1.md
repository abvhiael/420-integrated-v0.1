# Validator Economics — v0.1 Genesis Model

## Assumptions

- Validator bond: 42,000 420
- Target expected active-term return: 5%
- Target reward per active term: 2,100 420
- Active validators: 15
- Active term: 52,920 blocks
- Security share of protocol issuance: 34%
- Proposer share of Security allocation: 50%
- Other-validator participation share: 50%, divided equally among the other 14 active validators
- Uniform proposer selection and full participation assumed
- Transaction fees/tips excluded

## Derived initial issuance

To pay 15 validators an expected 2,100 420 each over one active term:

- Total Security issuance per term: 31,500 420
- Security issuance per block: 0.5952380952380952 420
- Total protocol issuance per block: 1.7507002801120448 420

Per block at genesis:

- Security: 0.5952380952380952 420
- Attention: 0.5777310924369748 420
- Development: 0.5777310924369748 420

Inside the Security allocation:

- Successful proposer: 0.2976190476190476 420
- Each of the other 14 active validators: 0.02125850340136054 420, if participating

Over 52,920 blocks, one validator is expected to:

- propose 3,528 blocks;
- participate as a non-proposer in 49,392 blocks;
- earn 1,050 420 from proposer duties;
- earn 1,050 420 from non-proposer participation;
- earn 2,100 420 total protocol subsidy.

The 5% target applies to the genesis issuance era. The reward declines as the 0.420%-per-420,000-block monetary decay proceeds.
