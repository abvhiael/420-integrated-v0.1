# 420 Governance concepts

A **constitutional rule revision** defines voting period, quorum, approval, dual-house requirement and timelock floor for a proposal class.

An **electorate snapshot** freezes source, revision, root and total voting weight for a proposal. A **ballot** is immutable once cast. An **actions hash** commits to the exact execution batch.

A passed vote, queued proposal and executed proposal are distinct states.

Civic v1 proposal lifecycle is monotonic: ACTIVE resolves to PASSED or FAILED; PASSED may queue; QUEUED may execute. Proposal cancellation is not a canonical v1 transition.
