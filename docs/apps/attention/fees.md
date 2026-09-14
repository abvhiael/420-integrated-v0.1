# 420 Attention fees and rewards

Campaign rewards are funded in native `$420`. Reward amount is deterministic from attention units multiplied by the campaign's committed reward-per-unit, subject to the immutable per-account cap.

Network gas is separate from campaign reward value. A reward becomes claimable only after sufficient campaign funds are reserved; the protocol must not create an unfunded entitlement.