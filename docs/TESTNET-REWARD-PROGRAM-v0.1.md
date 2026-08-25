# 42-Day Public Testnet Reward Program — v0.1

## Objective

Use the Community/Testnet genesis allocation to create a technically competent and economically committed validator community before mainnet launch.

## Allocation

Community/Testnet pool: **8,400,000 420**

Full validator match: **21,000 420**

Maximum possible full matches:

**8,400,000 / 21,000 = 400 validators**

A qualified participant supplies the other **21,000 420**, producing the required **42,000 420 validator bond**.

## Mainnet launch treatment

The earned 21,000 420 is not sent to the participant as freely transferable currency.

At genesis/mainnet activation:

1. participant's earned allocation is credited to the validator-bond system;
2. participant supplies or has allocated their own 21,000 420;
3. the resulting 42,000 420 is bonded;
4. the validator enters the eligible validator-selection pool;
5. normal cooldown, slashing, and withdrawal-delay rules apply.

The matched portion should remain distinguishable in protocol accounting so launch documents can show how much genesis 420 was distributed through earned testnet participation.

## Qualification window

Public testnet length: **42 days**

### Full-match draft requirements

- Participate on at least **35 of 42 days**.
- Validator uptime of at least **95%** during assigned monitoring periods.
- Successful completion of at least **95%** of assigned consensus duties.
- No serious consensus fault or slashable test behavior.
- Complete final synchronization and genesis-readiness test.
- Submit valid consensus and withdrawal keys.
- Run an independently controlled validator instance.

## Why 35/42 days

35 days is five-sixths of the testnet. It permits limited maintenance, Internet outages, travel, and genuine operational problems without allowing someone to qualify after appearing only briefly.

## Why 95% uptime/duties

The testnet is a qualification exercise, not merely an airdrop. A validator must demonstrate that it can maintain a production-quality node while still allowing for realistic outages.

## Anti-gaming principle

The blockchain cannot reliably prove that multiple wallet addresses correspond to different humans.

The primary defenses are therefore:

- each matched validator must represent an actually operating node;
- every match requires 21,000 420 of participant capital in addition to the protocol match;
- validator keys and node performance must be observed throughout the testnet;
- duplicate or coordinated infrastructure may be analyzed during genesis qualification;
- the matched 21,000 is bonded rather than immediately liquid.

The goal is not to claim perfect one-person-one-validator identity. The goal is to make mass fake validator creation technically burdensome and economically costly.

## Award accounting

Potential states:

- `QUALIFYING`
- `QUALIFIED`
- `DISQUALIFIED`
- `MATCH_ALLOCATED`
- `BONDED_AT_GENESIS`

A public testnet dashboard should show qualification metrics without exposing unnecessary personal information.

## Unused allocation

If fewer than 400 full awards are earned, the unused 420 remains in the Community/Testnet Treasury.

It is not automatically transferred to founders, Development, Attention, or public-sale allocations.

Potential later uses include:

- validator decentralization rounds;
- bug bounties;
- open-source contribution rewards;
- documentation rewards;
- dApp testnet programs;
- security research.

## Variables still to finalize

- exact uptime measurement method;
- whether uptime is scored continuously or only during assigned validator periods;
- whether partial rewards exist below the full-match threshold;
- whether a participant must own the full 21,000 counterpart before the testnet ends or only before genesis;
- validator withdrawal delay;
- policy for matched bonds when a validator voluntarily exits soon after launch;
- final anti-Sybil qualification rules.
