# BET-AUDIT-5A.4 — Slither finding disposition and qualification gate

## Reproducible finding provenance

- Source implementation SHA: `cf93c585c5638dd09bd888f162ba66b268fd1d50`
- Static security workflow: `39372637384` — **failure**
- Analyzer: Slither `0.11.6`
- Previous complete findings artifact: workflow `39351176348`, artifact `12233037070`
- Previously passing scoped Level 1: run `39351176585`, implementation SHA `50f662efe92537b807f138f40a3871b01b0e84eb`
- Previously passing Cross-Game Level 2: run `39351176426`, same SHA
- The extra rake/top-up adversarial tests at `cf93c58` have **not** received successful Level 1 qualification; their run `39372637530` was cancelled.

## Findings (unresolved pending independent review and passing regression)

1. **High / reentrancy-balance / `PokerSeatLedger420._deposit`**: Slither reports a balance observation across an ERC-20 external call. The entire entry path is protected by `nonReentrant` (`buyIn` or `topUp`); all liabilities are updated before `transferFrom`, and incorrect deltas revert atomically. Regression must validate hostile token callbacks and exact balance conservation.
2. **High / reentrancy-balance / `PokerSeatLedger420._withdraw` vault observation**: `leave` and `settleReservedHand` guard the entire operation; liabilities, replay flags and seat state are changed before `transfer`. Requires hostile-token tests for both cashout and rake.
3. **High / reentrancy-balance / `PokerSeatLedger420._withdraw` recipient observation**: The recipient balance is rechecked specifically to reject inexact transfers. Same guard and adversarial test requirements apply.
4. **Medium / incorrect-equality / `PokerNLHEBetting420.start` pendingMask**: `pendingMask == 0` is an exact empty-set test; replacing equality would break betting-state semantics. Requires exact state-transition regression.
5. **Medium / incorrect-equality / `PokerNLHEBetting420.canRevealStreet`**: Strict street/phase equality authorizes disclosure only on exact permitted phases. Requires premature/out-of-order reveal rejection tests.

**Provisional classification:** detector heuristics are consistent with intentional exact-check and guarded transfer patterns. **Not approved as false positives.** No detector suppression, blanket allow-list, or automatic static-security bypass is authorized. Any accepted disposition must cite new successful exact-SHA regression evidence and independent review of assumptions (including non-standard balanceOf behaviour).

## Mandatory open release gates

- **Authenticated private delivery:** `PokerDeckDisclosure420` currently records hashes and acknowledgements, but does not prove recipient ciphertext corresponds to the accepted encrypted-deck card identities. Receipts alone are not cryptographic delivery correctness proofs.
- **Deterministic dispute recovery:** `PokerActionDisputeClock420` provides proposals/appeals but its `start` path explicitly requires an independently authenticated hand engine; end-to-end withheld-share and invalid-proof recovery must remain fail-closed until proved.
- **Production cryptography:** Generated `EXPERIMENTAL-` Solidity verifier acceptance is not evidence of frozen, governance-pinned production verifying keys, setup provenance, and independent external circuit/security audit. No production deployment or settlement authorization is implied by successful fixture tests.
- **Escrow:** Only a verified native canonical terminal outcome may release funds, with adversarial callback, cancellation and replay tests qualified against the same implementation SHA.

## Release decision

**HOLD** — PR #743 must stay draft/unmerged until the above gates pass. This file preserves traceable analysis; it is not a security waiver, a formal independent audit, or a Level 3 certificate.
