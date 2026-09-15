# DOC-17 — Genesis publication roadmap

DOC-17 publishes and integrates 420Docs without changing chain, protocol, Wallet, deployment, provider, governance or application authority. One branch/PR carries DOC-17.1 through DOC-17.10; merge only after current-main reconciliation and exact-head 420Docs + full 420 Integrated qualification.

## DOC-17.1 — Production publication contract — COMPLETE
- [x] Publication authority/non-authority boundaries.
- [x] Production target/canonical URL policy.
- [x] Publication evidence, fail-closed, rollback and runtime-link rules.

Deliverable: `docs/publication/publication-contract.md`.

## DOC-17.2 — Pages deployment hardening — COMPLETE
- [x] Unified 420Docs qualification before deploy.
- [x] Exact commit/artifact identity.
- [x] Safe permissions, concurrency and rollback behavior.

Deliverable: `docs/publication/pages-deployment-hardening.md`.

## DOC-17.3 — Canonical URL and release routing — COMPLETE
- [x] Explicit production URL contract and canonical metadata.
- [x] DOC-13 version/environment behavior preserved.
- [x] Testnet/mainnet remain unavailable without cross-track fallback.

Deliverable: `docs/publication/canonical-url-release-routing.md`.

## DOC-17.4 — Repository integration — COMPLETE
- [x] README/public documentation entry points bound to production target.
- [x] Stable audience source links retained.
- [x] Repository integration qualified.

Deliverables: `docs/publication/repository-integration.md`, `docs/publication/repository-entrypoints.json`.

## DOC-17.5 — 420 Wallet integration — COMPLETE
- [x] Stable `CTX-WALLET-*` runtime help.
- [x] Explicit environment/current-version binding.
- [x] Navigation-only authority and fail-closed fallback.

Deliverables: Wallet docs-context bundle/resolver/tests plus `scripts/validate-doc-wallet-integration.py`.

## DOC-17.6 — 420 Explorer integration — COMPLETE
- [x] Stable `CTX-EXPLORER-*` runtime help and visible Help entry.
- [x] Chain/finality authority remains RPC/Indexer/canonical state.
- [x] Unpublished/stale docs cannot change Explorer interpretation.

Deliverables: Explorer docs-context bundle/resolver plus `scripts/validate-doc-explorer-integration.py`.

## DOC-17.7 — Developer Hub integration — COMPLETE
- [x] Stable `CTX-DEV-*` documentation surface.
- [x] Network/current-version binding explicit.
- [x] Hub remains non-authoritative orchestration/tooling.

Deliverables: Developer Hub docs-context bundle/resolver/UI plus `scripts/validate-doc-developer-hub-integration.py`.

## DOC-17.8 — Genesis dApp integration — COMPLETE
- [x] Published DOC-14 dApp contextual namespace integrated through one reusable runtime package.
- [x] All published contextual identifiers validated against production routes.
- [x] Gaming remains protocol-only; Faucet remains unavailable until testnet docs publish.

Deliverables: `docs/publication/genesis-dapp-integration.md`, `packages/420-docs-context/genesis-dapps.json`, `packages/420-docs-context/index.js`, `packages/420-docs-context/test.mjs`, `scripts/validate-doc-genesis-dapp-integration.py`.

Result: 18 published development/Genesis dApps and 108 DOC-14 contextual targets are materialized. Resolution requires an explicitly published environment plus `current` version intent and returns `documentation-navigation-only`; unknown IDs/surfaces and unpublished environments fail closed.

## DOC-17.9 — Publication health, observability and recovery — COMPLETE
- [x] Health/readiness checks for built artifact, deployed root, search index, version context and critical deep links.
- [x] Publication smoke qualification before upload and after deployment.
- [x] Rollback/redeploy recovery preserves repository authority and version history.
- [x] Support-safe diagnostics defined.

Deliverables: `docs/publication/publication-health.json`, `docs/publication/publication-health-recovery.md`, `scripts/validate-doc-publication-health.py` and hardened `.github/workflows/docs-pages.yml` / `scripts/validate-doc-pages-publication.py`.

Result: Pages build now fails before upload if critical artifact health or publication identity is invalid, and the deployed site is smoke-checked after release. Health failures mark publication degraded; they never rewrite DOC-13 state or fall back across environments/releases.

## DOC-17.10 — Final production closeout — COMPLETE
- [x] Audited repository, Wallet, Explorer, Developer Hub and Genesis dApp integrations.
- [x] Verified canonical URL/version/environment and contextual deep-link contracts.
- [x] Recorded deliberate unavailable targets: Gaming protocol-only and Faucet unpublished until testnet documentation exists.
- [x] Verified zero blocking publication/integration gaps in the closeout audit.
- [x] Reconciled with current `main`; main remains the DOC-17 base, so no reconciliation commit is required.
- [x] Final exact-head 420Docs + full 420 Integrated qualification required before merge.
- [x] Merge permitted only when both exact-head gates are green.

Deliverable: `docs/publication/final-production-closeout.md`.

## Phase exit condition

420Docs is reproducibly published from qualified repository state, preserves DOC-13 semantics, and is safely integrated through stable contextual identifiers. Publication failure cannot invent runtime state, weaken authority boundaries or silently substitute another environment/release.
