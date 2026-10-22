# 420Bet — Blockchain-Native Canonical Evidence and Settlement Decision

**Decision:** APPROVED by the project owner, 2026-10-19.  
**Application:** 420Bet / BET-AUDIT-5A.4.  
**Status:** Architecture approved; implementation qualification is separate.

## Binding architectural principles

1. **Canonical authority.** 420 Integrated's versioned, immutable, on-chain poker rules, table parameters, contract state and accepted proofs define the authoritative hand history. Neither a table operator nor an external adjudicator may substitute a declared result for a verified result.
2. **Permissionless proof submission.** Any address may submit complete public evidence. Acceptance is based solely on contract validation against the particular hand, table, chain ID, ruleset, ciphertext commitment and latest state. Submitting evidence does not grant power to certify it.
3. **No trusted dealer result.** Dealer commitments and encrypted deliveries are inputs, not proof of a fair shuffle or an allowed payout. The shuffle circuit must prove a sound re-encryption permutation of an authenticated canonical deck under an independently controlled threshold public key.
4. **Deterministic NLHE verification.** Signed, epoch-scoped actions and authorized private reveals must be independently checked for full betting legality, side pots, hand rankings, rake and conservation. The on-chain state must be derived from those rules, or accept a sound proof of that exact computation.
5. **On-chain dispute and timeout transitions.** Timeout, challenge, appeal and recovery conditions must be deterministic and replay protected. Disputes block settlement until their established on-chain resolution conditions are met. Human approvals cannot override proof failure.
6. **Atomic settlement.** Only the settled hand's fully verified final payout vector may modify escrowed seat balances, exactly once, with supply conservation and authorized rake transfer. No attested hash alone is sufficient.
7. **Versioned cryptographic governance.** On-chain addresses and verifying-key hashes must be pinned to immutable circuit versions. Upgrades require a new approved version and cannot modify already committed hands.

## Explicit authorization model

**No third-party approval is required for each hand.** An operator, dealer, reviewer, designated adjudicator or governance member does not have the authority to pronounce an invalid proof valid. Off-chain computation, prover and public evidence submission are permitted; on-chain proof verification decides acceptance.

**Approval is not cryptographic qualification.** This decision must not be read as evidence that the still-unimplemented full 52-card proving pipeline, live threshold decryption, complete NLHE circuit, escrow locking/atomic settlement, or independent security review already exists.

## Migration from draft 5A.4

The previous `PokerHandFinality420` supports designated dual attestors. It remains a **non-authoritative legacy challenge-window helper**, NOT sufficient to settle a hand. `PokerHandAccountingProof420` permits controller-supplied conservation figures and is also NOT canonical rules verification. The new evidence gate must never treat either helper as a substitute for sound deck and rules proofs. Do not remove their tests or qualified evidence; consumers must adopt the new canonical evidence chain before production.

**Acceptance requirements**: real pinned Solidity verifiers; proof-authenticated initial deck and both re-encryption shuffles; threshold card sharing/reveals; signed-actions/state-machine proof; dispute-free terminality; locked-pot ledger state; one transaction verifying exact payouts and enforcing no replay. Only then can on-chain settlement be enabled. Until then remain fail closed.
