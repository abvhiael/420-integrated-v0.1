# BET 5A.6 — Hand evaluation, pots and side pots

The production outcome calculator derives contributions and folded status from
the native engine and cards from authenticated reveal slots. It accepts neither
caller-selected winners nor caller-selected payouts. The existing five-of-seven
evaluator orders all nine categories, includes every kicker, treats an ace-low
straight as five-high, rejects duplicate/out-of-range cards, and permits the
board itself to be the best five cards.

## Contribution tiers and exact integer charges

The unique unmatched excess is returned to its originating seat before rake.
Sorted contribution thresholds define separate pots. Folded players fund pots
but cannot win them; a short stack wins only the tiers it covered. Each tied pot
is divided once, with odd chips assigned to winning physical seats clockwise
after the button, including sparse tables. Original stacks plus awards, refunds
and the immutable table policy's rake must conserve all reserved player chips.

5A.6 corrects a reachable arithmetic failure in the previous rake allocation:
contributions `[10,11,12,13,14,15,16,17,17]` total 125; 7% rake is eight chips.
Flooring each earlier tier independently leaves more than two chips to charge
against the final two-chip side pot. Settlement previously reverted.

`PokerPotMath420.award` now charges each tier the difference between successive
floors of `fee * cumulativeGross / totalGross`. Charges sum to the exact fee and
no charge exceeds its own tier. `portion` uses an exact multiplication fast path
and binary long division when the intermediate product exceeds uint256. Rake
calculation uses the same exact fraction primitive. The independent JavaScript
economics uses BigInt products and rejects unsafe aggregate chip values.

The calculator remains immutably bound by runtime hash. These rules apply to
new bindings; an existing table cannot replace its bound calculator in place.
No new proof relation, trusted setup, verifier key or proof-acceptance bypass is
introduced. Unchanged proofs must still pass actual verification and the funded
hand's contract-derived context comparison.

## Executable qualification

`BetPokerEvaluation56.t.sol` calls the same pot library used in production and
the actual native ranker. Its eleven mandatory cases cover nine-tier rake at
every fee from zero through the full pot, nine all-in depths, folded eligibility,
sparse-seat odd chips, malformed pot inputs, full-width arithmetic, all hand
categories, two trips, three pairs, board-only ties, 2,500 fraction fuzz runs,
256 independent seven-card ranking vectors, 256 independent two-to-nine-seat
pot vectors, and 32 full-width BigInt division vectors.

The deterministic vector generator imports independent ranking and chip-layer
pot oracles. The chip-layer oracle groups a complete pot before splitting its
odd chips; splitting each physical layer separately incorrectly awards the same
seat repeated odd chips. CI checks that the committed corpus regenerates exactly.

The existing poker Level 2 owner now requires actual execution of all eleven
5A.6 cases alongside all 32 5A.5 cases, affected settlement/ranking regressions,
independent Node tests, scoped static security, genuine proof verification, and
the legitimate funded hand plus ten attacks. Reports and the certificate bind
the exact tested SHA. New pot arithmetic, ranking and rake sources are included
in the static owner. Changed economics/ranking owners receive fresh execution;
unchanged historical cryptographic provenance is retained.

Level 1 and Level 2 success require execution artifacts; this document records
scope and rules, not a test result. Level 3 and live deployment remain separate
release gates. Unrelated global compiler and 420Arcade documentation failures
are outside this focused qualification.
