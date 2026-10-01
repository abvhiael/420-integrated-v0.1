# 420 Governance security

Verify proposal class, snapshot, required houses, action commitment and timelock before voting or executing. Do not trust a frontend-generated action summary without comparing it to the canonical committed batch.

Never weaken quorum, approval or timelock rules to force an outcome. Rule changes apply prospectively to later proposals.

Civic v1 has no proposer cancel, emergency council, operator cancel or capability-based cancellation path. Do not treat the reserved `CANCELLED` enum, a raw legacy timelock cancellation event, or a derived-service state as authority to cancel or rewrite a Civic proposal. Bootstrap timelock cancellation retires when Civic authority activates.


Canonical Civic v1 proposals are not cancellable.


## Governance-authorized external calls and reentrancy

Canonical Civic execution intentionally permits **governance-authorized arbitrary target calls** only after the exact action batch has been committed, passed, queued, and released by GovernanceTimelock. This is an accepted protocol capability, not an implicit trust grant to called contracts.

The execution path relies on atomic EVM rollback, exact action-hash binding, Timelock single-use operation state, and Proposal Registry lifecycle state. Civic does **not** add an undocumented global reentrancy lock. A target that reenters the same Timelock operation cannot replay it because the operation is marked executed before the external call; direct reentry into the Governor batch is also restricted to the Timelock.

Target contracts remain responsible for their own reentrancy safety, authorization, accounting, and failure behavior. A reverting target reverts the complete Governance batch and leaves the proposal queued for a later valid execution attempt; derived services must not infer partial execution.
