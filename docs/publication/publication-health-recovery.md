# DOC-17.9 — Publication health, observability and recovery

## Result

420Docs publication health is checked at both artifact and deployed-site boundaries without changing documentation authority. The health contract is `docs/publication/publication-health.json`; `scripts/validate-doc-publication-health.py` validates the rendered root, search index, 420AI architecture page, developer quickstart, troubleshooting page, and the `publication.json` identity emitted by the Pages workflow.

**Publication scope:** The current MkDocs build publishes a flat compatibility corpus. The DOC-13 version renderer records that corpus as `legacy` in `version-context.json`; it does not create `versions/development/current/` or `versions/genesis/current/` document trees. The client selector disables choices without a materialized version-specific inventory. A passing flat-site health check must not be interpreted as a passing versioned-release publishing gate or as proof that a legacy document is an immutable Genesis snapshot.

The prior health contract incorrectly required `versions/development/current/index.html` and `versions/genesis/current/index.html` even though the build deliberately did not produce those files. The health contract now checks actual materialized compatibility routes. Publishing release-owned versioned trees and separately validating their provenance and routes remains outstanding; never create them by blindly copying development/legacy pages into the Genesis release namespace.

## Build-time health

Before the Pages artifact can be uploaded, the workflow records the exact source commit and runs the smoke validator against `site/`. Missing critical **materialized compatibility** files, an invalid publication identity, repository/ref drift or an unqualified artifact fails the build. DOC-13 registry, version routing, generated-reference version, canonical rendering and selector qualification remain independent fail-closed stages.

## Post-deploy health

After GitHub Pages deploys, the same validator checks the live compatibility routes and publication identity. A failure marks the Pages workflow unhealthy and requires investigation; it does not modify DOC-13 publication state or substitute another environment/release. This check does **not** establish that unmaterialized version-qualified routes are live.

## Recovery

Recovery preserves repository authority and version history:

1. Identify the exact failed Pages run and source commit.
2. Distinguish qualification, build, artifact smoke, upload, deployment and post-deploy reachability failures.
3. Compare required artifact paths with the actual rendering and the version-specific publication evidence; never weaken a provenance gate to make an unavailable release appear published.
4. Correct the repository defect or restore a previously qualified repository state through normal version control.
5. Re-run qualification and Pages deployment from an explicit commit and verify `publication.json` and the materialized compatibility routes.
6. When a release-owned version tree is separately implemented, add its paths to the health contract only after the corresponding provenance and publication qualification is in place.

Do not repair publication incidents by editing generated Pages files in place, changing canonical URLs ad hoc, redirecting Genesis requests to development, publishing testnet/mainnet implicitly, or rewriting immutable Genesis release metadata.

## Support-safe diagnostics

Safe incident evidence includes workflow/run ID, source commit, publication ref, affected URL/path, HTTP status, timestamp, validator output and whether root/search/version/deep-link checks failed. Do not include wallet secrets, private keys, seed phrases, session tokens, bearer credentials, private application payloads or unrelated personal data.

## Authority boundary

Publication health proves only that a qualified documentation artifact is reachable and internally coherent. It never proves chain finality, contract authenticity, service availability, settlement, wallet authorization, governance outcome or protocol correctness.
