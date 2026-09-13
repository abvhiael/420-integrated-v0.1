---
title: DOC-14 contextual documentation roadmap
audience:
  - developer
  - operator
category: contributing
status: active
version: current
---

# DOC-14 — Contextual documentation roadmap

DOC-14 adds stable, version-aware deep links from Wallet, Genesis applications and runtime surfaces into task-specific 420Docs guidance and troubleshooting without duplicating canonical documentation inside applications.

DOC-14 is monolithic: DOC-14.1 through DOC-14.10 remain on one branch/PR and merge only after final coverage audit, reconciliation with current `main`, exact-head 420Docs Qualification and exact-head 420 Integrated Qualification are green.

## DOC-14.1 — Contextual-link authority and URL contract — COMPLETE

- [x] Define contextual-link authority and non-authority boundaries.
- [x] Define stable target classes for task guides, concepts, reference and troubleshooting entries.
- [x] Define version/environment-aware URL behavior using DOC-13 authority.
- [x] Define fail-closed behavior for unknown, unpublished, retired and cross-environment targets.
- [x] Define application behavior when contextual help is unavailable.

Deliverable: `docs/contextual/contextual-link-contract.md`.

## DOC-14.2 — Contextual-link registry and schema — COMPLETE

- [x] Define machine-readable contextual-link registry.
- [x] Define stable link IDs, source surfaces, target type, audience and environment constraints.
- [x] Define aliases/deprecation rules without reassigning stable IDs.
- [x] Add deterministic registry validation.

Deliverables:

- `docs/contextual/contextual-link-registry.json`
- `docs/contextual/contextual-link-schema.md`
- `scripts/validate-doc-contextual-registry.py`

The registry begins with foundational 420Docs, Wallet, troubleshooting and developer targets. DOC-14.3 through DOC-14.6 expand coverage; DOC-14.8 wires contextual validation into the unified documentation gate and publication trigger contract.

## DOC-14.3 — Wallet contextual help — COMPLETE

- [x] Map Wallet setup, send/receive, connection, signing, permissions, recovery and troubleshooting surfaces.
- [x] Provide stable task/help targets for user-visible Wallet states.
- [x] Preserve Smart Account/passkey/recovery authority boundaries.

Deliverable: `docs/contextual/wallet-contextual-help.md`.

Wallet contextual IDs cover setup/import/protection, send/receive/activity, troubleshooting, dApp connections, signing/transaction review, permissions/sessions, recovery/device safety and the neutral Wallet overview.

## DOC-14.4 — Genesis dApp contextual help — COMPLETE

- [x] Map every frozen Genesis user-facing application to contextual task/help targets.
- [x] Cover state-changing, value-changing, signing, permissions, economics, security and privacy surfaces.
- [x] Preserve protocol-only Gaming Protocol and testnet-only Faucet boundaries.

Deliverables:

- `docs/contextual/genesis-dapp-contextual-help.md`
- `docs/contextual/genesis-dapp-context-map.json`

The application map covers the 18 non-Wallet Genesis user-facing applications plus Faucet. Each application receives six deterministic contextual slots. Faucet remains testnet-only and non-resolvable until DOC-13 publishes a testnet documentation track. 420 Gaming Protocol remains protocol-only.

## DOC-14.5 — Troubleshooting and error deep links — COMPLETE

- [x] Integrate stable `TRB-<DOMAIN>-<NNN>` anchors from DOC-11.
- [x] Define runtime error-to-troubleshooting routing rules.
- [x] Prevent applications from duplicating or silently forking canonical recovery guidance.
- [x] Define safe fallbacks when a specific troubleshooting target is unavailable.

Deliverables:

- `docs/contextual/troubleshooting-error-deep-links.md`
- `docs/contextual/troubleshooting-route-map.json`

Runtime error help prefers exact stable DOC-11 `TRB-*` IDs, application troubleshooting is the bounded second-level fallback, and `CTX-TRB-001` is the general diagnostics/support fallback.

## DOC-14.6 — Developer and operator contextual links — COMPLETE

- [x] Define deep links from RPC/API/SDK/CLI and operator surfaces into canonical developer/operator docs.
- [x] Cover generated reference, network identity, deployment, finality, diagnostics and incident-response targets.
- [x] Preserve canonical-versus-derived authority boundaries.

Deliverables:

- `docs/contextual/developer-operator-contextual-help.md`
- `docs/contextual/developer-operator-context-map.json`
- `CTX-DEV-002` through `CTX-DEV-008` and `CTX-OPS-001` through `CTX-OPS-004` in the contextual-link registry.

## DOC-14.7 — Version and environment coupling — COMPLETE

- [x] Couple contextual targets to DOC-13 tracks, current aliases and immutable releases.
- [x] Prevent development links from being advertised as Genesis/testnet/mainnet authority.
- [x] Fail closed for unpublished testnet/mainnet documentation tracks.
- [x] Define historical contextual-link behavior.

Deliverables:

- `docs/contextual/version-environment-coupling.md`
- `docs/contextual/version-coupling-policy.json`
- `scripts/validate-doc-contextual-version-coupling.py`

## DOC-14.8 — Contextual-link CI and publication safety — COMPLETE

- [x] Validate registry schema and target existence.
- [x] Validate stable anchors and task routes.
- [x] Reject unknown, stale, retired, unpublished and cross-environment authoritative targets.
- [x] Integrate contextual-link validation into unified 420Docs qualification.
- [x] Audit workflow triggers for all contextual policy/registry/validator surfaces.

Deliverables:

- `scripts/validate-doc-contextual-publication.py`
- contextual registry, version-coupling and publication-safety stages in `scripts/qualify-documentation.py`
- contextual validator paths in `docs/ci/workflow-policy.json`
- contextual validator paths in `.github/workflows/docs-qualify.yml`

## DOC-14.9 — Application integration contract — COMPLETE

- [x] Publish implementation guidance for Wallet/dApp/runtime teams.
- [x] Define how clients resolve contextual-link IDs into version-aware URLs.
- [x] Define telemetry/privacy boundaries for help-link activation.
- [x] Define offline/unavailable documentation behavior.
- [x] Provide representative integration examples without coupling applications to site internals.

Deliverables:

- `docs/contextual/application-integration-contract.md`
- `docs/contextual/application-integration-examples.json`

## DOC-14.10 — Coverage audit and closeout — QUALIFICATION

- [x] Audit Wallet, all frozen Genesis applications, troubleshooting domains and developer/operator surfaces.
- [x] Verify every contextual target resolves under the correct environment/version semantics.
- [x] Record deliberate unsupported or unavailable contextual states.
- [x] Reconcile branch with current `main` (branch is ahead with `behind_by=0`).
- [ ] Run exact-head 420Docs Qualification.
- [ ] Run exact-head 420 Integrated Qualification.
- [ ] Merge DOC-14 only when the monolithic phase is fully green.

Deliverable: `docs/contextual/coverage-audit.md`.

## Exit condition

Wallet, Genesis applications and supported runtime surfaces can expose stable contextual help without embedding duplicated recovery logic; links resolve only to authoritative documentation for the active environment/version, stable troubleshooting IDs remain durable, unavailable or unsafe targets fail closed, and CI prevents stale or unpublished contextual links from reaching 420Docs publication.
