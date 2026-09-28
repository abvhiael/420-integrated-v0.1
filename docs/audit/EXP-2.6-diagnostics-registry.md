# EXP-2.6 — Operational diagnostics and Registry/service-version contract qualification

EXP-2.6 qualifies the repository API surfaces used for troubleshooting and protocol/version inspection.

## Repository guarantees

- Network status preserves the Indexer's chain/finality/freshness state plus categorical runtime issue and issue timestamp.
- `/v1/status` and `/v1/ready` retain stable operational issue codes while also returning the underlying Indexer runtime diagnostic context.
- `/v1/capabilities` advertises the qualified status/readiness and Registry service/version surfaces.
- Direct service-version lookup validates requested service ID/version against the returned record.
- Service-version records require implementation and activation provenance and reject impossible deprecation state.
- Registry service detail proves the declared active version exists as an active historical version and that its implementation matches the summary.
- The Explorer Indexer client rejects canonical-authority overclaims for service-version reads.

## Deferred boundaries

This milestone does not qualify global-search UI routing, deployed browser navigation, live Registry publication, production-equivalent troubleshooting/recovery, target-network witnesses, canonical Registry authority, or Genesis release readiness.
