# Architecture

420 Notifications consumes replayable, fork-sensitive event envelopes from the public 420Indexer boundary through its consumer adapter. Subscription and delivery state are consumer/provider policy and remain non-canonical. Delivery failure cannot block the underlying protocol event.
