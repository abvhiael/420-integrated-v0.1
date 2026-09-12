# Governance integration examples

For a ballot UI: read the proposal's frozen electorate source and voter weight, show required house and immutable ballot choice, then submit through the canonical voting contract.

For execution: recompute the exact committed actions hash, verify queue/timelock state, then execute the unchanged batch atomically.