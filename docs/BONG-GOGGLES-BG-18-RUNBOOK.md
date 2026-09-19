# Bong Goggles BG-18 Rewards Production Runbook

## Authority boundary

Bong Goggles never mints, custodies, signs, pays, or locally finalizes rewards. Canonical authority remains:

`BongGogglesContributionVerifier420`
→ `BongGogglesRewardsAdapter420`
→ `ContributionRegistry420`
→ `RewardCampaignRegistry420`
→ `RewardDistributor420`
→ `RewardPool420`.

Operators may inspect projections and prepare Wallet-bound intents only.

## Pre-deployment checks

1. Validate the selected `testnet`, `staging`, or `production` reward configuration.
2. Confirm every dependency address is non-zero and matches the intended deployment.
3. Confirm each enabled campaign is bound to `APP_ID_BONG_GOGGLES` and exactly one supported contribution type.
4. Confirm scorer and optional policy contracts match the reviewed profiles.
5. Confirm contribution cap, account cap, total budget, start, and end values.
6. Confirm game rewards remain deferred and no GAME_PARTICIPATION / GAME_RESULT campaign exists.
7. Confirm the RewardPool distributor binding is the canonical `RewardDistributor420`.
8. Confirm operator surfaces show no private Wallet material or service-side signing path.

## Campaign activation

Use the deterministic sequence:

1. create campaign through `RewardCampaignRegistry420.createCampaign`;
2. reread and validate the canonical campaign;
3. fund `RewardPool420.fund` from the sponsor Wallet;
4. verify funded, reserved, and available balances;
5. activate with `RewardCampaignRegistry420.setActive(campaignId, true)`.

Activation must not proceed if canonical campaign data differs from the plan, the pool is underfunded, reserved exceeds funded, or the campaign window is invalid.

## Operating checks

Monitor separately:

- submitted canonical contributions;
- accrued rewards;
- reserved rewards;
- paid rewards;
- accrued amount by campaign;
- earned amount by account;
- funded / reserved / available pool balances;
- remaining campaign budget;
- campaign active/window state.

Never treat contribution submission as reward earned or reward accrual as payment.

## Claims

Claims target `RewardDistributor420.claim(rewardId, beneficiary)`.

- beneficiary must match the canonical reward;
- Wallet confirmation is required;
- local state must not mark payment final before canonical `RewardReleased`;
- actual EVM event ordering may emit `RewardReleased` before `RewardClaimed`; PAID is terminal and must not regress.

## Pause / incident response

For suspected abuse, accounting mismatch, scorer/policy failure, or funding issue:

1. deactivate the affected campaign;
2. do not delete or rewrite existing contribution/reward records;
3. preserve already-earned claims;
4. reconcile local projections against canonical Contribution Registry, Campaign Registry, Distributor, and Pool state;
5. resolve the cause before reactivation;
6. top up only through sponsor Wallet confirmation if underfunding is the issue.

## Abuse controls

Duplicate source, cross-account source replay, cooldown violations, rapid submission bursts, hidden/invalid sources, cap exhaustion, and policy/scorer failures must fail closed at the canonical reward boundary. Application abuse signals are advisory and non-authoritative.

## Reconciliation

A production reconciliation is healthy only when:

- submitted count matches canonical contribution inventory;
- accrued count and amount match distributor state;
- paid count and amount match canonical releases;
- per-campaign accrued and remaining budget match;
- pool funded/reserved/available balances reconcile;
- restart/replay rebuilds the same totals.

Any mismatch blocks operational sign-off.

## Closeout / rollback

Before release, run the BG-18.12 drills and exact-head CI. If any canonical or accounting invariant fails, keep campaigns disabled and roll back application deployment/configuration without attempting to mutate historical reward state.
