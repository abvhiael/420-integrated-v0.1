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

Wallet contextual IDs now cover setup/import/protection, send/receive/activity, troubleshooting, dApp connections, signing/transaction review, permissions/sessions, recovery/device safety and the neutral Wallet overview. All targets are constrained to the currently published development and Genesis documentation environments; runtime Smart Account, passkey, signing and recovery authority remains independent of documentation resolution.

## DOC-14.4 — Genesis dApp contextual help — COMPLETE

- [x] Map every frozen Genesis user-facing application to contextual task/help targets.
- [x] Cover state-changing, value-changing, signing, permissions, economics, security and privacy surfaces.
- [x] Preserve protocol-only Gaming Protocol and testnet-only Faucet boundaries.

Deliverables:

- `docs/contextual/genesis-dapp-contextual-help.md`
- `docs/contextual/genesis-dapp-context-map.json`

The application map covers the 18 non-Wallet Genesis user-facing applications plus Faucet. Each application receives six deterministic contextual slots: overview, primary task, permissions/signing, fees/economics, security/privacy and troubleshooting. Genesis applications are constrained to development/Genesis documentation authority. Faucet is declared testnet-only and remains non-resolvable until DOC-13 publishes a testnet documentation track. 420 Gaming Protocol remains intentionally protocol-only and does not receive a standalone user-application contextual namespace.

## DOC-14.5 — Troubleshooting and error deep links — COMPLETE

- [x] Integrate stable `TRB-<DOMAIN>-<NNN>` anchors from DOC-11.
- [x] Define runtime error-to-troubleshooting routing rules.
- [x] Prevent applications from duplicating or silently forking canonical recovery guidance.
- [x] Define safe fallbacks when a specific troubleshooting target is unavailable.

Deliverables:

- `docs/contextual/troubleshooting-error-deep-links.md`
- `docs/contextual/troubleshooting-route-map.json`

Runtime error help now prefers exact stable DOC-11 `TRB-*` IDs, derives the canonical page from DOC-11 domain ownership, and uses the matching lower-case stable anchor. Application troubleshooting targets are the second-level fallback; `CTX-TRB-001` is the generic search/diagnostics/support fallback. Unknown or ambiguous errors are never guessed into a narrower `TRB-*` condition, and no fallback may cross documentation environments or releases.

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
