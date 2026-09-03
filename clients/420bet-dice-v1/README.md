# 420Bet DiceV1 browser client

Framework-neutral browser/client integration for the first 420Bet reference game.

The client deliberately does not implement game math, randomness selection, settlement, custody, or capability granting. Canonical state comes from `DiceV1View420`; wager writes go through `WagerRouter420`; parameter commitments come from `DiceV1420.hashParams`.

## Player state controller

`DicePlayerController420` provides the presentation-neutral player flow:

`disconnected -> validating-session -> ready -> submitting -> waiting-randomness -> result-ready -> settled`

An `error` state is entered when session authorization fails or a submission/read operation fails.

- `connect()` binds the controller to the wallet client's active account and validates the existing narrowly scoped Dice session.
- `setBetDraft()` edits stake, roll-under/roll-over threshold, win gross payout, and max gross payout locally. These values are not canonical until submitted.
- `revalidateSession()` re-checks the injected session validator; `submit()` performs the same check again immediately before writing the wager.
- `submit()` obtains the canonical parameter commitment through `DiceV1420.hashParams`, writes only through `WagerRouter420`, then tracks the emitted wager ID.
- `refresh()` reads only through `DiceV1View420` and advances the UI from randomness pending to canonical result and settlement states.
- `openHistory()` reloads a locally tracked wager from canonical chain state. The local history list is navigation convenience, not protocol truth.
- `verifyRoll()` reports whether the committed parameters match, canonical randomness is fulfilled, a deterministic result is available, and any settlement exactly matches that reproduced result.
- `winChanceBps()` is display-only arithmetic for the selected threshold; it has no payout or outcome authority.

## Expected UI flow

1. Connect a configured 420 wallet/smart-account session.
2. Ensure the session already has the narrowly scoped `ACTION_PLACE` capability for the Dice game version.
3. For ERC-20 stake assets, call `approveStake`, which approves the bound bankroll vault rather than the game module or UI.
4. Use the controller's stake/odds draft controls and submit the wager.
5. Render `waiting-randomness` while the canonical request/root is incomplete.
6. When the controller reaches `result-ready`, animate only the already-canonical roll/outcome returned by `DiceV1View420`.
7. When it reaches `settled`, display the immutable settlement and balance/history presentation.
8. Expose `verifyRoll()` as the player's independent verification view.

Frontend animation has no outcome authority. A UI must never invent a result while `resultAvailable` is false or substitute local parameters when `paramsMatch` is false.
