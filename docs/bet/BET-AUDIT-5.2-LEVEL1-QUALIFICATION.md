# BET-AUDIT-5.2 — Deterministic 52-Card Deck and Initial Dealing, Level 1 Qualification

**Canonical step:** 5.2 — Implement deterministic 52-card deck generation and initial dealing.
**Disposition:** LEVEL 1 PASS for the initial dealing lifecycle only. This does not constitute a qualified playable draw/settlement game or authorize any production wagering.

## Qualified implementation identity

- **Implementation SHA:** `887b04722cb32b375407d8be995d85ac5a30c8d6`.
- **Reconciliation base SHA:** `435d6b122db3e84b745abdc62eba8ef38f6cf841`.
- **Branch:** `audit/420bet-video-poker-5-2-deck-20261017`.
- **PR:** [#706](https://github.com/abvhiael/420-integrated-v0.1/pull/706).
- **Scope:** `contracts/src/bet/VideoPokerDealV1420.sol`; `contracts/test/BetVideoPokerDeck420.t.sol`; `.github/workflows/420bet-video-poker-5-2-level1.yml`. Preserves immutable E3.1 `VideoPokerV1420` API/constructor and prior tests.

## Requirements-to-evidence matrix

| Requirement | Implementation and test |
| --- | --- |
| Deterministic 52-card deck | Domain-separated Fisher–Yates shuffle of cards 0–51; nonce-derived keccak samples; rejection sampling removes per-position modulo bias. `testSameInputSameDeck`, `testFullDeckUniqueAndBounded`. |
| Card encoding, uniqueness, full coverage | Documented four 13-rank suits, full 52-element permutation, no duplicate or out-of-range values. `testFullDeckUniqueAndBounded`. |
| Wager/version/ruleset/root/source isolation | Shuffle binds `DECK_DOMAIN`, chain ID, verifying deal contract address, wager ID, game version, ruleset, randomness root/source. `testDomainSeparationByWagerRootAndSource`. |
| Initial exactly five-card deal | `startInitialDeal` deals first five shuffled cards, records player, root/source and full-deck commitment, emits auditable event. `testPlayerInitialDealExactlyOnceAndMatchesDeck`. |
| Player access and one-time replay protection | Canonical wager owner only, session `exists` prevents a second initial deal. `testUnauthorizedCallerFails`, `testPlayerInitialDealExactlyOnceAndMatchesDeck`. |
| Canonical randomness authority binding | Reads `RandomnessRouter420.getRequest` and checks fulfillment, nonzero root, PRIMARY/FALLBACK source, wager ID, randomness profile, game version, params hash and nonzero context. `testUnfulfilledRandomnessFails`, `testWrongRandomnessBindingFails`. |
| Wager status, expiry and input commitment | Calls qualified E3.1 `VideoPokerV1420.validateWager`; only accepted/outcome-ready and before deadline; validated committed paytable and credits. `testExpirationFails`, `testUncommittedParamsFail`, previous E3.1 foundation suite. |

## Exact-SHA executable qualification evidence

[420Bet Video Poker 5.2 Level 1 — GitHub Actions run 39070675889](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39070675889), job `117507443518`, **SUCCESS**.

Verbatim critical CI evidence:
- `Qualified input SHA: 887b04722cb32b375407d8be995d85ac5a30c8d6`
- `Ran 7 tests for test/BetVideoPokerV1420.t.sol:BetVideoPokerV1420Test`
- `Ran 9 tests for test/BetVideoPokerDeck420.t.sol:BetVideoPokerDeck420Test`
- `Ran 2 test suites in 14.72ms (7.13ms CPU time): 16 tests passed, 0 failed, 0 skipped (16 total tests)`

Other automatically triggered workflows at this SHA: Solidity Contracts, Global Level 3 Artifact Preflight (preflight ONLY), Mines Level 1, Phase 4 Level 2 and Dice Client recorded SUCCESS on certificate creation; others still in progress and **not counted as passed**. Docs was SKIPPED, not success. No global workflows were manually dispatched.

## Security and future-phase boundaries

**Important fairness limit:** the randomness root used for initial dealing is public, so the deterministic 52-card permutation is publicly reconstructible; its unused cards are **not approved as secret draw cards** once the player sees the initial hand. Future hold/draw must use separately committed and appropriately timed unpredictable replacement-card entropy, with duplicate-card exclusion and proofs, before any payout/settlement is authorized. Do not treat these initial-deal tests or a stored deck commitment as proof of future draw secrecy.

No actual live VRF receipt, custody transfer, player hold/draw, Jacks-or-Better evaluator, paytable economics, payout, settlement, app client or production approval is implemented or claimed here. Independent policy/RTP/liability, real-network randomness, legal/eligibility and operational acceptance remain gated in `docs/420BET-TESTNET-WORK-ROADMAP.md`.

**Current-main reconciliation:** at certificate preparation the branch was one implementation commit ahead, **zero behind** `main`, with no intervening changed paths. For evidence-only certificate commit, preserve qualification against implementation SHA and record evidence SHA separately; do not rerun tests. Final merge eligibility must be checked by GitHub before merging.

**Level 2:** not initiated for Phase 5. **Level 3:** not initiated for Phase 5. **Next canonical step:** Video Poker hold-mask commitment and draw lifecycle with independent replacement entropy and duplicate exclusion, subject to the actual repository roadmap.
