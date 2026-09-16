# 420Analytics — ANALYTICS-4.1 Methodology Registry

ANALYTICS-4.1 makes metric methodology a versioned registry contract inside the analytics service instead of duplicated free-form text in individual metric builders.

## Scope

The registry covers every Genesis metric implemented through ANALYTICS-3.4:

- 4 network metrics
- 5 validator/staking metrics
- 4 protocol/application metrics
- 5 Treasury/economic metrics

Each registry entry binds a stable metric ID to a methodology ID, methodology version, and human-readable description.

## Invariants

1. Metric builders resolve methodology by stable metric ID.
2. Unknown metric IDs fail closed instead of inventing methodology metadata.
3. Registry enumeration is deterministic and sorted by metric ID.
4. Methodology ID, version, and description are all required.
5. A methodology change requires an explicit registry/code change and version update.
6. Existing metric IDs and existing v1 methodology semantics remain unchanged by this phase.
7. Methodology metadata remains descriptive and non-authoritative; it does not create protocol authority.
8. Source provenance remains qualified 420Indexer only.
9. Historical snapshots retain the methodology version embedded at construction time.

## Qualification

`analytics/methodology/registry_test.go` verifies registry completeness for the 18 currently implemented Genesis metrics, deterministic ordering, exact resolution, unknown-ID rejection, and drift rejection.

The network, validator, protocol, and Treasury/economic builders now consume the registry through a shared resolver rather than embedding independent methodology strings.
