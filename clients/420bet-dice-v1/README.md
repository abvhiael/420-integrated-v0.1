# 420Bet DiceV1 browser client

Framework-neutral browser/client integration for the first 420Bet reference game.

The client deliberately does not implement game math, randomness selection, settlement, custody, or capability granting. Canonical state comes from `DiceV1View420`; wager writes go through `WagerRouter420`; parameter commitments come from `DiceV1420.hashParams`.

## Expected UI flow

1. Connect a configured 420 wallet/smart-account session.
2. Ensure the session already has the narrowly scoped `ACTION_PLACE` capability for the Dice game version.
3. For ERC-20 stake assets, call `approveStake`, which approves the bound bankroll vault rather than the game module or UI.
4. Call `placeWager` with the operator, game version, stake, max payout, correlation key, deadline, and Dice parameters.
5. Track the returned wager ID with `snapshot`.
6. Render `randomnessRequested` / `randomness.fulfilled` as pending states.
7. When `resultAvailable` is true, animate only the already-canonical result.
8. When `settlementExists` is true, display the immutable settlement and allow the user to compare it against the independently reproduced Dice result.

Frontend animation has no outcome authority. A UI must never invent a result while `resultAvailable` is false or substitute local parameters when `paramsMatch` is false.
