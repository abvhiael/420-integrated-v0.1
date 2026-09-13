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

## DOC-14.3 — Wallet contextual help

- [ ] Map Wallet setup, send/receive, connection, signing, permissions, recovery and troubleshooting surfaces.
- [ ] Provide stable task/help targets for user-visible Wallet states.
- [ ] Preserve Smart Account/passkey/recovery authority boundaries.

## DOC-14.4 — Genesis dApp contextual help

- [ ] Map every frozen Genesis user-facing application to contextual task/help targets.
- [ ] Cover state-changing, value-changing, signing, permissions, economics, security and privacy surfaces.
- [ ] Preserve protocol-only Gaming Protocol and testnet-only Faucet boundaries.

## DOC-14.5 — Troubleshooting and error deep links

- [ ] Integrate stable `TRB-<DOMAIN>-<NNN>` anchors from DOC-11.
- [ ] Define runtime error-to-troubleshooting routing rules.
- [ ] Prevent applications from duplicating or silently forking canonical recovery guidance.
- [ ] Define safe fallbacks when a specific troubleshooting target is unavailable.

## DOC-14.6 — Developer and operator contextual links

- [ ] Define deep links from RPC/API/SDK/CLI and operator surfaces into canonical developer/operator docs.
- [ ] Cover generated reference, network identity, deployment, finality, diagnostics and incident-response targets.
- [ ] Preserve canonical-versus-derived authority boundaries.

## DOC-14.7 — Version and environment coupling

- [ ] Couple contextual targets to DOC-13 tracks, current aliases and immutable releases.
- [ ] Prevent development links from being advertised as Genesis/testnet/mainnet authority.
- [ ] Fail closed for unpublished testnet/mainnet documentation tracks.
- [ ] Define historical contextual-link behavior.

## DOC-14.8 — Contextual-link CI and publication safety

- [ ] Validate registry schema and target existence.
- [ ] Validate stable anchors and task routes.
- [ ] Reject unknown, stale, retired, unpublished and cross-environment authoritative targets.
- [ ] Integrate contextual-link validation into unified 420Docs qualification.
- [ ] Audit workflow triggers for all contextual policy/registry/validator surfaces.

## DOC-14.9 — Application integration contract

- [ ] Publish implementation guidance for Wallet/dApp/runtime teams.
- [ ] Define how clients resolve contextual-link IDs into version-aware URLs.
- [ ] Define telemetry/privacy boundaries for help-link activation.
- [ ] Define offline/unavailable documentation behavior.
- [ ] Provide representative integration examples without coupling applications to site internals.

## DOC-14.10 — Coverage audit and closeout

- [ ] Audit Wallet, all frozen Genesis applications, troubleshooting domains and developer/operator surfaces.
- [ ] Verify every contextual target resolves under the correct environment/version semantics.
- [ ] Record deliberate unsupported or unavailable contextual states.
- [ ] Reconcile branch with current `main`.
- [ ] Run exact-head 420Docs Qualification.
- [ ] Run exact-head 420 Integrated Qualification.
- [ ] Merge DOC-14 only when the monolithic phase is fully green.

## Exit condition

Wallet, Genesis applications and supported runtime surfaces can expose stable contextual help without embedding duplicated recovery logic; links resolve only to authoritative documentation for the active environment/version, stable troubleshooting IDs remain durable, unavailable or unsafe targets fail closed, and CI prevents stale or unpublished contextual links from reaching 420Docs publication.
