# Governance errors and retries

Typical failures include inactive/invalid proposal, voter not in frozen electorate, duplicate ballot, wrong house, quorum/approval failure, action-hash mismatch, timelock not elapsed and already executed/cancelled state.

Retry only transient transport failures; deterministic governance failures require corrected state or a new proposal/action.