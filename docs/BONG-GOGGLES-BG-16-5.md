# Bong Goggles BG-16.5 — moderation, appeals + rewards emitters

BG-16.5 connects the Bong Goggles notification pipeline to canonical moderation, appeal and reward-adapter events without creating a second source of truth.

## Moderation

Canonical `BongGogglesSafetyRegistry420` events are used directly:

- `SafetyActionApplied` -> `MODERATION_ACTION` to the canonical case subject;
- `SafetyActionRevoked` -> `MODERATION_ACTION` to the canonical case subject;
- `CaseClosed` -> `MODERATION_ACTION` case-status presentation to the canonical case subject;
- `AppealResolved` -> `APPEAL_UPDATED` to the canonical appellant.

The notification layer hydrates the current case/action/appeal projection and fails closed when IDs do not match the source event. Notifications carry only presentation metadata and never mutate case, action, appeal or profile state.

`AppealFiled` does not currently create a user-facing self-notification because the canonical appellant is also the filing actor. Operator-facing moderation queues remain BG-17 scope rather than being invented here as notification authority.

## Rewards

The canonical Bong Goggles reward adapter currently exposes `RewardContributionSubmitted`. That event means a verified Bong Goggles contribution has been forwarded into the shared rewards contribution registry. It does **not** prove that a reward has been earned, priced, funded or paid.

BG-16.5 therefore emits:

- `RewardContributionSubmitted` -> `REWARD_CONTRIBUTION_SUBMITTED` to the canonical beneficiary.

The `REWARD_EARNED` and `REWARD_PAYOUT_UPDATED` notification kinds remain reserved in the catalog for future canonical reward lifecycle events, but the Bong Goggles pipeline deliberately does not fabricate `RewardEarned` or `RewardPayoutUpdated` source events. Until the canonical rewards protocol exposes those transitions, no earned/payout notification is emitted.

## Invariants

- moderation and reward contracts remain authoritative;
- notifications are non-authoritative presentation only;
- source chain/block/transaction/log provenance is preserved;
- canonical IDs are revalidated before notification creation;
- replay remains deterministic and deduplicated;
- a contribution submission must never be mislabeled as an earned reward or payout;
- notification delivery failure cannot alter moderation, appeal or reward state.
