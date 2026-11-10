# 420Bet game and platform qualification — local increment

**Status: PARTIAL / NOT RELEASE QUALIFIED.** This change supplies an independent, deterministic **reference model** for stake escrow, maximum *net* liability reservation, capped gross payout, refund exclusivity, replay denial and negative tests. It deliberately does not claim to execute actual Solidity/Go services, sign approvals, determine mathematically approved RTP, or verify real chain activity.

## How to run
```sh
python3 -m unittest discover -s tests -p 'test_420bet_game_platform_qualification.py' -v
python3 scripts/qualify-420bet-game-platform.py trace.json
```
Trace schema: `{"bankroll":1000,"events":[{"type":"accept","id":"w1","stake":100,"maxGross":500},{"type":"settle","id":"w1","gross":500,"fee":0}]}`. Amounts are nonnegative integer smallest-token units. This is a comparison oracle only, not a casino engine or canonical ledger.

An optional `--release-inventory` parses a strict per-vertical evidence inventory, but **always exits nonzero** because a JSON reference cannot authenticate independent approvers, signed manifests or finalized on-chain receipts. Its statuses are not release authorization. A pass on the trace tests demonstrates properties of the reference model only.

## Qualification remaining before integration into main can be called complete
- Run each actual game engine's exact-revision economic verifier and published approved configuration (Dice, Keno, Plinko, Slots, Roulette, Blackjack, Mines, Crash, Video Poker).
- Qualify poker/tournament and fantasy escrow, multi-party liabilities, live lifecycle and dispute/refund accounting against their actual contract and service implementations.
- Finish sportsbook TN-BOOK-00 engine, exposure and local funded settlement qualification and private ownership authority TN-BET-7-OWNERSHIP; the odds-display cache is not a bookmaker.
- Qualify actual cross-service Wallet/Identity, Registry, Indexer, Notifications/Mail, Search and Analytics adapters, including reorg/replay/restart and authorization failures.
- Resolve the eight reported BET-AUDIT-7 lobby regression failures and exact-head CI; reconcile the separate unmerged BET-AUDIT-7 branch before merging this increment.
- Move **only** genuine official-network proofs, deployed runtime identity, independent policy/math/risk signoff and funded live acceptance to the testnet roadmap. Existing gate statuses remain OPEN.

**Safety invariant:** browser practice, an Indexer projection, a fabricated approval JSON or successful model tests never authorize funded wagers. Product-specific approvals and universal release gates in `docs/420BET-TESTNET-WORK-ROADMAP.md` remain authoritative.
