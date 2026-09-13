# DOC-17 — Genesis publication roadmap

DOC-17 turns the completed 420Docs corpus into a production publication and runtime-integration surface. It does not change chain, protocol, Wallet, deployment, provider, or governance authority. Repository-controlled documentation remains the source of truth; the published site is a version-aware presentation and navigation layer.

DOC-17 follows the monolithic documentation-phase policy: DOC-17.1 through DOC-17.10 remain on one branch and pull request, reconcile with current `main`, then require exact-head 420Docs and full 420 Integrated qualification before one final merge.

## DOC-17.1 — Production publication contract and deployment inventory — COMPLETE
- [x] Freeze publication authority and non-authority boundaries.
- [x] Define the current production publication target and canonical public URL policy.
- [x] Define publication evidence, fail-closed behavior, rollback and runtime-link requirements.
- [x] Record the current Pages workflow/site configuration against the contract.

Deliverable: `docs/publication/publication-contract.md`.

Result: GitHub Pages is the explicit current production presentation target at `https://abvhiael.github.io/420-integrated-v0.1/` until an explicitly configured replacement/custom domain is committed and qualified. Repository-controlled documentation remains authoritative; publication never proves runtime state.

## DOC-17.2 — Pages build and deployment hardening — COMPLETE
- [x] Require the unified 420Docs qualification pipeline before artifact upload/deploy.
- [x] Bind deployment to a qualified commit identity and deterministic site artifact.
- [x] Preserve concurrency, permissions and rollback-safe deployment behavior.
- [x] Add publication-specific CI validation and workflow triggers.

Deliverable: `docs/publication/pages-deployment-hardening.md`.

Result: `.github/workflows/docs-pages.yml` now runs the full `scripts/qualify-documentation.py` gate before artifact upload, records the exact source SHA/repository/ref in `site/publication.json`, and deploys only from the successful build job. `scripts/validate-doc-pages-publication.py` enforces ordering, commit identity, Pages permissions/environment and serialized non-cancelling deployment; that validator is itself part of unified 420Docs CI.

## DOC-17.3 — Canonical URL, metadata and release routing — COMPLETE
- [x] Define canonical URL generation without assuming an unconfigured custom domain.
- [x] Add canonical metadata only from an explicitly published production target.
- [x] Verify DOC-13 environment/version routes survive production publication.
- [x] Ensure unpublished testnet/mainnet routes remain unavailable and never redirect across environments.

Deliverable: `docs/publication/canonical-url-release-routing.md`.

Result: `docs/publication/production-target.json` is the single committed production URL contract. The unified build injects and validates one canonical link per rendered page from that target. DOC-13 remains the version authority: development and Genesis are published, while testnet/mainnet remain unavailable with no cross-environment or cross-release fallback. Canonical-routing changes trigger both qualification and Pages publication workflows.

## DOC-17.4 — Repository integration — COMPLETE
- [x] Verify README and repository navigation point to the canonical production docs entry.
- [x] Preserve stable architecture/user/developer/operator/troubleshooting/reference source entry links.
- [x] Validate repository links against the production publication contract.

Deliverable: `docs/publication/repository-integration.md` and `docs/publication/repository-entrypoints.json`.

Result: the README public 420Docs root is bound to the committed production target while repository-relative audience links remain valid source-navigation paths. `scripts/validate-doc-repository-integration.py` checks the canonical root, required audience families, source-file existence and safe production-relative paths as part of unified documentation qualification. README and repository-integration changes participate in both qualification and Pages publication triggers.

## DOC-17.5 — 420 Wallet integration — NEXT
- [ ] Wire Wallet help/context entry points to stable DOC-14 identifiers or canonical production routes.
- [ ] Preserve environment/version binding and safe fallback behavior.
- [ ] Verify Wallet never treats docs as signing/account/runtime authority.

## DOC-17.6 — 420 Explorer integration
- [ ] Wire Explorer help/context entry points to stable contextual/documentation routes.
- [ ] Preserve chain/finality authority boundaries.
- [ ] Verify stale/unavailable docs cannot alter canonical Explorer interpretation.

## DOC-17.7 — Developer Hub integration
- [ ] Wire Developer Hub documentation/help entry points to canonical production docs.
- [ ] Bind network/version context explicitly.
- [ ] Preserve Developer Hub as non-authoritative orchestration/tooling.

## DOC-17.8 — Genesis dApp integration
- [ ] Integrate the published DOC-14 dApp contextual namespace across supported Genesis applications.
- [ ] Validate all published `CTX-*` identifiers resolve through the production route.
- [ ] Keep Gaming Protocol protocol-only and Faucet unavailable until testnet documentation is published.

## DOC-17.9 — Publication health, observability and recovery
- [ ] Define health/readiness checks for build artifact, deployed root, search index, version context and critical deep links.
- [ ] Add publication smoke qualification.
- [ ] Define rollback/redeploy recovery without rewriting documentation authority or version history.
- [ ] Record support-safe diagnostics for publication incidents.

## DOC-17.10 — Final production publication closeout
- [ ] Run production publication/integration audit across repository, Wallet, Explorer, Developer Hub and Genesis dApps.
- [ ] Verify canonical URL/version/environment behavior and contextual deep links.
- [ ] Record deliberate unavailable targets and residual non-blocking follow-ups.
- [ ] Verify zero blocking publication/integration gaps remain.
- [ ] Reconcile with current `main`.
- [ ] Require exact-head 420Docs and full 420 Integrated qualification.
- [ ] Merge DOC-17 only after all closeout gates are green.

## Phase exit condition

420Docs is reproducibly published from qualified repository state, exposes an explicit canonical production entry point, preserves DOC-13 version/environment semantics, and is safely integrated from the repository, Wallet, Explorer, Developer Hub and supported Genesis dApps through stable navigation/context identifiers. Publication failure cannot invent runtime state, weaken authority boundaries, or silently substitute another environment/release.
