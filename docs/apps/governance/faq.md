# 420 Governance FAQ

## Does validator stake determine voting weight?
No. Voting weight comes from the frozen electorate source for that proposal.

## Can governance rules change during a vote?
Rules can be updated prospectively, but an existing proposal keeps its snapshotted revision.

## Does a passed proposal execute immediately?
No. The committed action batch must pass the applicable timelock.

## Can a proposal be cancelled after it is created?
No in canonical Civic v1. ACTIVE, PASSED and QUEUED proposals have no cancellation path. A later proposal may change future protocol state, but it cannot rewrite another proposal's lifecycle.
