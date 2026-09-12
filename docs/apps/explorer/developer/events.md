# Explorer event and finality handling

Explorer does not define canonical protocol events. It consumes indexed execution logs and chain/finality metadata.

Downstream consumers should key event identity to canonical chain provenance and distinguish observations at head, safe and finalized boundaries. Before finality, an event may disappear during reorg repair; applications must tolerate removal/replacement rather than assuming first observation is permanent.

Historical decoding must use the protocol/service version that was effective for the originating block, not only the newest ABI.
