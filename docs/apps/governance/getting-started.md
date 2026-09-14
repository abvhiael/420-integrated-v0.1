# Getting started with 420 Governance

A governance proposal commits to a proposal class, frozen constitutional rules, a frozen electorate snapshot and an exact action batch commitment.

Voting is one ballot per voter per required house during the proposal's voting window. Passing does not execute immediately: the exact committed action batch must be queued through GovernanceTimelock and wait the proposal's frozen delay.

Never treat a frontend vote count as final if canonical proposal state or finality disagrees.