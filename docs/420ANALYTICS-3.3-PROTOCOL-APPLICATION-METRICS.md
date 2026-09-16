# 420Analytics ANALYTICS-3.3 — Protocol/application metrics

ANALYTICS-3.3 adds derived protocol/application activity metrics on top of the stable 420Indexer public API v1 DTO boundary.

## Source boundary

Inputs are normalized from qualified `ProtocolEventDto420` and `ProtocolObjectStateDto420` projections. 420Analytics does not read protocol contract storage or node420 RPC directly and does not infer canonical protocol outcomes.

## Genesis metric set

- `protocol.event_count` — unique typed protocol events represented by transaction hash plus log index.
- `protocol.object_count` — unique latest protocol objects represented by protocol plus object key.
- `protocol.active_object_count` — latest protocol objects whose indexed lifecycle is `active` or `enabled`.
- `protocol.distinct_count` — distinct protocol identifiers represented by the event/object snapshot.

All metrics use `MetricProtocol`, methodology version `v1`, point observation windows, and exact ANALYTICS-2 provenance.

## Qualification rules

- source and snapshot provenance must be qualified `420Indexer`;
- event/object chain IDs must match the snapshot chain;
- event/object block numbers must be nonzero and not exceed the qualified indexed height;
- stable protocol/event/object identities are mandatory;
- duplicate event coordinates and duplicate protocol/object identities fail closed;
- empty protocol input fails closed;
- lifecycle strings other than `active` and `enabled` are retained as non-active rather than interpreted as protocol failure.

## Authority invariant

These are analytics observations only. They do not decide registration, settlement, ownership, governance, bridge, rights, identity, payment, or any other canonical protocol state.