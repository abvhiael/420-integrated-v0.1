# BET-AUDIT-5A.4 — Workstream 5 deterministic recovery and dispute finality

## Nonnegotiable custody invariant

Only PokerSeatLedger420 owns player chip balances and its original funded seat snapshot. PokerProviderAccountability420 owns provider collateral in a *separate* account, tracked separately by asset and provider. An operator, reviewer or challenger may not submit a balance vector for a hand. A failed proof path always calls the native ledger's `cancelReservedHand`, which restores the same original seat balances; a genuine settled game calls `settleReservedHand` only with the native cryptographic outcome calculator's computed 9-seat balances and bound rake policy.

The engine sets `handAborted` or `handSettled` **before** any external ledger or bond close operation. A revert in the ledger, provider collateral transfer, token callback or dispute clock atomically rolls back those flags and all transfers. `ledger.handConsumed`, closed bond state and the terminal flags are single-use, and the dispute clock rejects new clocks/disputes on a consumed or finalized hand.

## Funded immutable evidence window

`PokerNLHEBetting420.reserve` requires a fully funded table and a governance-authorized dispute resolver already bound to the **same native engine**. It snapshots the locked seat-epoch state and a fixed initial evidence deadline derived from the committed hand's original deadline. Neither a provider nor a late caller can replace `fundedSnapshot` or `fundedEvidenceDeadline`. Before any pre-betting timeout cancellation, the engine rechecks the untouched original escrow snapshot.

If both shuffled-deck Groth16 stages do not complete by that immutable window, `cancelWithheldDeal` returns the entire initial player balance snapshot. If the shuffle was accepted but complete recipient-only proof-backed delivery and actual player acknowledgments are missing, `cancelWithheldDelivery` does the same. Provider blame comes only from the stored accepted stage or the accepted independently verified per-position provider-share mask, never a caller-supplied accusation. If both proof books are complete but a recipient withholds acknowledgment, the player refund still proceeds but **neither provider's bond is slashed**.

## Street evidence, bounded correction and appeals

Following a completed canonical betting round, `evidenceDueAt` fixes the first evidence deadline for that exact pending street. An overdue, still provably incomplete flop/turn/river/showdown may open **one** review, with expiry anchored to the original evidence deadline, not the time at which a user submits the recovery transaction. Thus a sleeping operator cannot obtain a new 49-hour grace period by calling `beginMissingEvidenceRecovery` days late. The `recoveryStageMask` blocks repeated reviews for the same stage.

During review, real proof-backed public ciphertext shares and verified card unmask evidence can still arrive. `advanceRevealedStreet` checks the canonical authorized stage and the exact completed proof set, then atomically closes that stage's pending review and resumes betting. A different later street has its own one-time review; a corrected flop cannot prevent a later withheld turn from reaching a terminal refund.

A seated player's dispute is evidence-committed but cannot choose a winner. A governance-bound native engine may propose only its independently recomputed cryptographic result; one seated participant appeal extends review at most once by `REVIEW_WINDOW`. Final settlement is permitted only with the *unchanged* proposed native result after appeal expiry. If the genuinely required evidence is still missing after review and applicable dispute appeal time, `finalizeMissingEvidenceRecovery` permissionlessly returns the original exact escrow snapshot and closes provider bonds using `missingProviders` from the authorized canonical reveal gate. The accepted provider mask is recomputed for the actual outstanding street; allegations without supporting missing cryptographic evidence produce no slash.

## Invalid, replayed and malicious evidence

- A proof verified for a different encrypted card, deck root, hand, provider, position, street or recipient is not counted. Both independent provider shares remain missing until genuine proof verification and on-chain acceptance.
- Publicly generated or caller-controlled evidence hashes can freeze a review but never themselves satisfy cryptographic correctness or substitute a settlement vector.
- Duplicate provider submissions, double card reveals, old signer or key-epoch receipts, repeated clock disputes after a consumed hand, second appeals, replacement outcome hashes and repeated terminal refund or settlement must all revert.
- The fund and bond contracts maintain their non-reentrancy guards and exact token balance deltas during deposits, refunds, provider releases and slashes. Hostile token callbacks must be denied; no fee-on-transfer or forged transfer can fabricate provider or player collateral.
- No manual or discretionary operator finalization is enabled. The sole governance authority can approve the one-time protocol components, but this authority does not bypass proof predicates, exact seat snapshots, native calculation or review deadlines.

## Scope of evidence

The dedicated `.github/workflows/420bet-poker-ws5-recovery-level1.yml` compiles and runs only WS5 native funded reconciliation, dispute clock, malicious-collateral and public-proof correction tests, with pinned Solidity 0.8.30 and via-IR to avoid the established 0.8.24 Yul optimizer blocker. It records the exact qualified SHA and hashes of relevant Solidity sources and fixtures. The already-passing Workstreams 1–4 genuine cryptographic proofs are inherited, not regenerated. This scoped Level 1 does not claim the separate production trusted setup, testnet or full 5A.4 Phase Level 3 qualification.
