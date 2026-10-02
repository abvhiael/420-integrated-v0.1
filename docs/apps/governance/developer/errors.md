# Governance errors and retries

Typical failures include inactive/invalid proposal, voter not in frozen electorate, duplicate ballot, wrong house, quorum/approval failure, action-hash mismatch, timelock not elapsed and already executed state.

Canonical Civic v1 proposals are not cancellable. `CANCELLED` is reserved for compatibility/history and must not be synthesized by clients from a raw legacy timelock cancellation.

Retry only transient transport failures; deterministic governance failures require corrected state or a new proposal/action.