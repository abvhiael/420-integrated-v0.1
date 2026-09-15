# DOC-17.9 — Publication health, observability and recovery

## Result

420Docs publication health is now checked at both artifact and deployed-site boundaries without changing documentation authority.

The health contract is `docs/publication/publication-health.json`. `scripts/validate-doc-publication-health.py` checks the rendered root, search index, development/current and genesis/current entry points, critical Explorer/developer/troubleshooting deep links, and the exact `publication.json` identity emitted by the Pages workflow.

## Build-time health

Before the Pages artifact can be uploaded, the workflow records the exact source commit and then runs the smoke validator against `site/`. Missing critical files, an invalid publication identity, repository/ref drift or an unqualified artifact fails the build.

## Post-deploy health

After GitHub Pages deploys, the same validator checks the live deployment URL and publication identity. A failure marks the Pages workflow unhealthy and requires investigation; it does not modify DOC-13 publication state or substitute another environment/release.

## Recovery

Recovery preserves repository authority and version history:

1. identify the exact failed Pages run and source commit;
2. distinguish build failure from post-deploy reachability failure;
3. correct the repository defect or restore a previously qualified repository state through normal version control;
4. re-run qualification and Pages deployment from that explicit commit;
5. verify `publication.json` and critical routes after deploy.

Do not repair publication incidents by editing generated Pages files in place, changing canonical URLs ad hoc, redirecting Genesis requests to development, publishing testnet/mainnet implicitly, or rewriting immutable Genesis release metadata.

## Support-safe diagnostics

Safe incident evidence includes workflow/run ID, source commit, publication ref, affected URL/path, HTTP status, timestamp, validator output and whether root/search/version/deep-link checks failed. Do not include wallet secrets, private keys, seed phrases, session tokens, bearer credentials, private application payloads or unrelated personal data.

## Authority boundary

Publication health proves only that a qualified documentation artifact is reachable and internally coherent. It never proves chain finality, contract authenticity, service availability, settlement, wallet authorization, governance outcome or protocol correctness.
