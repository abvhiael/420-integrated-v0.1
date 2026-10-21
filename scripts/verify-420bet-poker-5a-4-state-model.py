#!/usr/bin/env python3
"""Bounded exhaustive safety model for BET-AUDIT-5A.4 hand/delivery/recovery.

This tests the *abstract transition specification*, not Solidity bytecode
equivalence or cryptographic soundness. The latter require their own gates.
"""
from collections import deque
from dataclasses import dataclass, replace

LOCKED, SHUFFLED, ASSIGNED, BETTING, REVEAL, RECOVERY, SETTLED, VOIDED = range(8)
N_SHARES = 8  # heads-up: 2 positions x 2 providers x 2 recipients
ALL_PROOFS = (1 << N_SHARES) - 1
ORIGINAL_ESCROW = 800

@dataclass(frozen=True)
class State:
    phase: int = LOCKED
    proof_mask: int = 0
    receipt_mask: int = 0
    epoch: int = 1
    deadline_passed: bool = False
    review_passed: bool = False
    appealed: bool = False
    verified_outcome: bool = False
    consumed: bool = False
    ledger_total: int = ORIGINAL_ESCROW
    recovered_as_original: bool = False


def edges(s):
    if s.phase == LOCKED:
        yield replace(s, phase=SHUFFLED)
    elif s.phase == SHUFFLED:
        yield replace(s, phase=ASSIGNED)
    elif s.phase == ASSIGNED:
        for i in range(N_SHARES):
            if not (s.proof_mask & (1 << i)):
                yield replace(s, proof_mask=s.proof_mask | (1 << i))
        if s.proof_mask == ALL_PROOFS:
            for seat in range(2):
                if not (s.receipt_mask & (1 << seat)):
                    yield replace(s, receipt_mask=s.receipt_mask | (1 << seat))
            if s.receipt_mask == 3:
                yield replace(s, phase=BETTING)
        # Key rotation invalidates ALL old envelopes and receipts.
        if s.proof_mask or s.receipt_mask:
            yield replace(s, epoch=2, proof_mask=0, receipt_mask=0)
        if not s.deadline_passed:
            yield replace(s, deadline_passed=True)
        if s.deadline_passed and (s.proof_mask != ALL_PROOFS or s.receipt_mask != 3):
            yield replace(s, phase=VOIDED, consumed=True, recovered_as_original=True)
    elif s.phase == BETTING:
        yield replace(s, phase=REVEAL)
    elif s.phase == REVEAL:
        if not s.verified_outcome:
            yield replace(s, verified_outcome=True)
        if s.verified_outcome:
            # Deterministic on-chain settlement is conserving. Model only the
            # zero-fee case; nonzero fee needs actual amount/rake regressions.
            yield replace(s, phase=SETTLED, consumed=True)
        if not s.deadline_passed:
            yield replace(s, deadline_passed=True)
        if s.deadline_passed and not s.verified_outcome:
            yield replace(s, phase=RECOVERY)
    elif s.phase == RECOVERY:
        if not s.verified_outcome:
            yield replace(s, verified_outcome=True)
        if s.verified_outcome:
            yield replace(s, phase=SETTLED, consumed=True)
        if not s.review_passed:
            yield replace(s, review_passed=True)
        if not s.appealed:
            yield replace(s, appealed=True, review_passed=False)
        if s.review_passed and not s.verified_outcome:
            yield replace(s, phase=VOIDED, consumed=True, recovered_as_original=True)


def invariant(s):
    assert s.ledger_total == ORIGINAL_ESCROW, "escrow liability forged"
    assert not s.consumed or s.phase in (SETTLED, VOIDED), "replay state consumed early"
    assert s.phase not in (SETTLED, VOIDED) or s.consumed, "terminal state not consumed"
    assert s.phase != BETTING or (s.proof_mask == ALL_PROOFS and s.receipt_mask == 3), "betting without complete delivery"
    assert not s.recovered_as_original or (s.phase == VOIDED and s.ledger_total == ORIGINAL_ESCROW), "refund is not original snapshot"
    assert s.phase != SETTLED or s.verified_outcome, "settlement without verified canonical proof"
    assert s.epoch in (1, 2), "unexpected key epoch"


def main():
    first = State()
    visited = {first}
    queue = deque([first])
    terminal = set()
    while queue:
        current = queue.popleft()
        invariant(current)
        if current.phase in (VOIDED, SETTLED):
            terminal.add(current.phase)
            assert not tuple(edges(current)), "terminal transition replay"
        for following in edges(current):
            invariant(following)
            if following not in visited:
                visited.add(following)
                queue.append(following)
    assert terminal == {SETTLED, VOIDED}, "missing terminal paths"
    print(f"BET-5A.4 bounded architecture model: PASS; {len(visited)} states; settlement and void explored")
    print("Limitations: abstract 2-seat/8-share model; not a full contract-model proof or independent cryptographic audit.")

if __name__ == "__main__":
    main()
