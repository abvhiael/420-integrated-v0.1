# 420Bet — BET-AUDIT-4.4 Reference Slots V1 audit inventory

**Canonical step:** Verify reel definitions, symbols, paylines, random streams, paytables, RTP artifacts and maximum liability. **Qualification:** Level 1, not phase closeout.

## Existing game model

- Five reels, four visible rows, 32-symbol virtual strip per reel, seven symbol identifiers `0..6` inclusive.
- Symbols `0..4` are regular ways-winning symbols; `5` is WILD, which substitutes for a regular symbol; `6` is SCATTER. Wild/scatter are not separate per-way payline awards.
- **There are no fixed-line paylines in this reference title.** It uses a *ways-to-win* evaluation. For each symbol `0..4`, matching/wild symbol counts multiply across consecutive reels beginning at the first reel; awards require at least three consecutive matching reels. Four visible positions create at most `4^5 = 1024` ways for a single symbol.
- Scatter awards depend on the count of reels containing at least one scatter (3, 4 or 5). The existing feature trigger is total visible scatter symbols >= 3; audit reviewers must distinguish that from the scatter-paying count of reels.
- The deterministic `SlotRandomStream420` uses one canonical fulfilled randomness root, wager ID, game/ruleset version, domain, phase, spin index and reel index, with strip-length modulo. Separate domains distinguish base and feature; at most six base free spins plus two three-spin retriggers (12 spins), each with fixed 2x multiplier.
- `ReferenceSlotV1420.hashParams` commits all 5×32 base symbols, all 5×32 feature symbols, the seven per-symbol payout slots, scatter awards and the max gross payout.
- A max payout cap prevents resolution above `params.maxGrossPayout`. The accepted maximum is reserved as gross less wager stake; the requested maximum must match the immutable slot terms authority and configured risk profile.

## BET-AUDIT-4.4 admission and settlement remedies

- `ReferenceSlotTermsAuthority420` binds a version/ruleset and exact terms hash to an append-only slot artifact registry. It checks all four nonzero artifact identifiers (reels, paytable, RTP and liability) and the approved maximum multiplier during one-time activation.
- Generic `WagerRouter420.placeWager` is now forbidden for this game; `placeSlotWager` validates the authority and exact terms before stake, nonce or bankroll liability can be consumed.
- Generic `SettlementEngine420.settle` is now forbidden for this game; `settleSlot` derives payout and terminal category from the committed deterministic engine and passes through the usual authorized, atomic settlement lifecycle.
- The canonical terminal classifier treats positive gross payouts below stake as partial-return **LOSS**, equal stake as PUSH, and greater stake as WIN. This matches `SettlementEngine420` terminal economics.

## Gating limitations — do not mistake hash existence for mathematical proof

The previously committed repository did not provide an independently approved, reproducible, economically calibrated production Reference Slots reel-and-paytable RTP proof. A hash in `BetSlotArtifactRegistry420` cannot prove the probability model or return-to-player calculation. The symbols, reel strips and payout values used by Solidity's test fixtures are *test data*, not authorized casino economics. No actual production RTP figure or independently approved liability artifact has been established by this step's fixture. This must be resolved by a genuine reproducible model, independently reviewed payout authority and its digest before production activation; do not invent an RTP target or present provisional test fixture hashes as approvals.

The mathematical model must distinguish strip-index sampling, ways prizes, scatter occurrences versus scatter-paying reels, feature triggers/retriggers, feature 2x multiplier, the absolute-denomination paytable (whose RTP depends on the stake amount), and per-wager gross cap. The cap means an **uncapped expectation alone is not a valid RTP certificate**. Testnet/live review additionally requires real deployed code hashes, authorized principals and network receipts.

**Current state:** security remediation under scoped Level 1 CI on PR #678. No Level 1 PASS or merge is claimed until its exact-SHA tests finish. Level 2 and Level 3 have not been requested.
