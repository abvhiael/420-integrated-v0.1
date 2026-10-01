# 420 Governance security

Verify proposal class, snapshot, required houses, action commitment and timelock before voting or executing. Do not trust a frontend-generated action summary without comparing it to the canonical committed batch.

Never weaken quorum, approval or timelock rules to force an outcome. Rule changes apply prospectively to later proposals.

Civic v1 has no proposer cancel, emergency council, operator cancel or capability-based cancellation path. Do not treat the reserved `CANCELLED` enum, a raw legacy timelock cancellation event, or a derived-service state as authority to cancel or rewrite a Civic proposal. Bootstrap timelock cancellation retires when Civic authority activates.
