# Explorer integration errors

Treat these classes as fail-closed for authoritative decisions:

- wrong chain/network;
- stale indexed head;
- degraded Indexer readiness;
- finalized inconsistency/conflict;
- unsupported API version;
- missing provenance for a supposedly canonical fact.

Not-found can mean nonexistent, not-yet-indexed or pruned/unsupported presentation data; distinguish those cases before concluding that canonical state is absent.

Retries are appropriate for transient availability/lag, not for wrong-network or finalized-conflict conditions.
