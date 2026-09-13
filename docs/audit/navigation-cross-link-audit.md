# DOC-16.8 — Navigation and cross-link audit

## Result

PASS with one blocking remediation item already owned by DOC-16.9.

## Audience entry points

The required audience routes are present and coherent:

- `docs/apps/index.md` is the Genesis application/manual entry point and distinguishes user-facing apps, protocol-only Gaming Protocol and testnet-only Faucet.
- `docs/developers/index.md` is the cross-ecosystem developer entry point and links canonical reads/writes, Wallet authorization, provider integrations, Gaming Protocol, examples and generated reference handoffs.
- `docs/troubleshooting/index.md` is the ecosystem troubleshooting entry point and routes by stable `TRB-*` domains, authority, retry safety and escalation.
- `docs/reference/index.md` is the machine-derived reference entry point and links contracts, events/errors, RPC, Indexer API, SDK/CLI, networks and deployments with provenance/freshness rules.

These entry points preserve the intended flow between task guidance, architecture/authority context, troubleshooting and exact generated reference.

## Contextual navigation

DOC-14 correctly defines contextual links as navigation metadata rather than substantive authority. `CTX-TRB-001` provides the generic troubleshooting fallback and exact `TRB-*` identifiers remain the stable recovery identity.

Blocking defect: `docs/contextual/genesis-dapp-context-map.json` declares application `CTX-<DOMAIN>-001..006` identifiers by convention, but the authoritative `docs/contextual/contextual-link-registry.json` does not materialize those per-application records. Runtime clients therefore cannot reliably resolve all declared application contextual IDs.

DOC-16.9 must materialize or equivalently register the declared IDs and validate one-to-one map-to-registry resolution, target type/path and environment compatibility. Gaming Protocol must remain excluded as protocol-only and Faucet must remain unpublished until the testnet documentation track is published.

## Ask 420 citation/navigation audit

`docs/assistant/source-registry.json` keeps canonical architecture/apps/developer/troubleshooting sources authoritative, generated development reference authoritative only with provenance, frozen Genesis sources historical/immutable, and `docs/contextual` compatibility/navigation-only. Testnet and mainnet remain excluded while unpublished.

This prevents contextual metadata or ungoverned repository content from becoming substantive answer authority.

## Orphan audit

No required top-level Genesis documentation family is orphaned from its audience entry point. The known Gaming Protocol matrix path defect remains a DOC-16.9 metadata repair, not an orphaned documentation surface.

## DOC-16.8 conclusion

Navigation and cross-link structure is complete at the documentation-family level. DOC-16 cannot close until DOC-16.9 repairs the application contextual-ID registry defect and adds deterministic validation so future map/registry drift fails qualification.