# Governance events and finality

Proposal creation, ballot casting, finalization, queueing and execution are canonical state transitions. Indexed clients must reconcile reorgs and distinguish current-head state from finalized execution state.

A UI result should not be treated as irreversible before required chain finality.