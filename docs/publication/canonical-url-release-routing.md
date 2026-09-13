# DOC-17.3 — Canonical URL, metadata and release routing

## Result

DOC-17.3 establishes a single committed production publication target and binds rendered canonical metadata to that target without inventing a custom domain.

The production target is recorded in `docs/publication/production-target.json`:

- provider: GitHub Pages;
- canonical base URL: `https://abvhiael.github.io/420-integrated-v0.1/`;
- publication branch: `main`;
- custom domain: unavailable / `null` until explicitly configured;
- cross-environment fallback: disabled;
- cross-release fallback: disabled.

## Canonical metadata

Rendered HTML receives exactly one canonical link per page from `scripts/inject-doc-canonical-links.py`. The injector reads the committed production target rather than embedding a second hostname authority.

`validate-doc-canonical-render.py` verifies that every rendered page has exactly one canonical URL under the committed production base and that no canonical URL points into unpublished testnet or mainnet routes.

## Release routing

DOC-13 remains the version and environment publication authority. DOC-17 does not create new tracks or aliases.

The current publication contract therefore exposes:

- `development/current`;
- `genesis/current` and the immutable Genesis release semantics already defined by DOC-13.

The following remain unavailable:

- testnet;
- mainnet.

An unavailable track does not redirect to development or Genesis. It remains an explicit unavailable state until DOC-13 publishes that environment.

## Qualification

`validate-doc-canonical-publication.py` checks that:

- the production target matches the explicitly committed GitHub Pages URL;
- no custom domain is silently assumed;
- published/unpublished environments match the DOC-13 registry;
- published tracks have current aliases;
- unpublished tracks have no current alias;
- canonical publication scripts trigger both documentation qualification and Pages publication workflows.

The unified 420Docs runner performs the static contract check before build, injects canonical metadata after the version selector is rendered, and validates the resulting HTML before final publication-safety and search/navigation checks.

## Authority boundary

Canonical HTML metadata identifies the preferred public documentation URL only. It does not prove live network state, contract deployment, transaction finality, Wallet authority, provider availability, governance state or release readiness.
