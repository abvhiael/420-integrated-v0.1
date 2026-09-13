# DOC-16 — Genesis documentation audit roadmap

DOC-16 is the final Genesis-wide documentation matrix audit. It verifies completeness, internal consistency, environment/version correctness, safe navigation and explicit unsupported/unpublished states. DOC-16.1 through DOC-16.10 remain on one monolithic branch/PR and merge only after final reconciliation plus exact-head 420Docs and full 420 Integrated qualification.

## DOC-16.1 — Audit authority, dimensions and frozen Genesis inventory — COMPLETE
- [x] Freeze architecture, user, developer, security/privacy, troubleshooting/recovery and reference dimensions.
- [x] Freeze supported environment/version semantics and the Genesis surface inventory.
- [x] Establish machine-readable matrix evidence requirements.

Deliverables: `genesis-documentation-matrix.md`, `genesis-documentation-matrix.json`.

## DOC-16.2 — Architecture coverage audit — COMPLETE
- [x] Architecture/system-context routes verified for all frozen surfaces.
- [x] Authority, dependency and trust boundaries verified.
- [x] Gaps/exclusions recorded.

Deliverable: `architecture-coverage-audit.md`.

## DOC-16.3 — User journey coverage audit — COMPLETE
- [x] Onboarding, primary tasks, state/value-changing actions and completion states verified.
- [x] Signing, permissions, fees and environment warnings verified where applicable.
- [x] Gaming Protocol remains protocol-only; Faucet remains testnet-only.

Deliverable: `user-journey-coverage-audit.md`.

## DOC-16.4 — Developer integration coverage audit — COMPLETE
- [x] Discovery, interfaces, network identity, reads/writes, events/errors and examples verified.
- [x] Generated-reference handoffs/provenance verified.
- [x] Developer Hub/SDK/CLI/Indexer/provider tooling remains non-authoritative.

Deliverable: `developer-integration-coverage-audit.md`.

## DOC-16.5 — Security and privacy coverage audit — COMPLETE
- [x] Secret handling, signing authority, private payloads and support safety verified.
- [x] Value-risk, Bridge/provider, Identity and recovery warnings verified.
- [x] No documentation weakens runtime safety for liveness/convenience.

Deliverable: `security-privacy-coverage-audit.md`.

## DOC-16.6 — Troubleshooting and recovery coverage audit — COMPLETE
- [x] Stable `TRB-*` coverage verified.
- [x] Retry safety, authority-first diagnostics, escalation and ambiguous-outcome handling verified.
- [x] Missing dApp CTX materialization identified for DOC-16.9 remediation.

Deliverable: `troubleshooting-recovery-coverage-audit.md`.

## DOC-16.7 — Reference, version and environment audit — COMPLETE
- [x] Generated-reference provenance/freshness verified.
- [x] DOC-13 routing and immutable Genesis behavior verified.
- [x] Unpublished testnet/mainnet fail closed with no cross-environment fallback.

Deliverable: `reference-version-environment-audit.md`.

## DOC-16.8 — Navigation and cross-link audit — COMPLETE
- [x] Audience entry points and cross-links verified.
- [x] Ask 420/contextual routing remains publication- and authority-safe.
- [x] No required top-level Genesis documentation family is orphaned.

Deliverable: `navigation-cross-link-audit.md`.

## DOC-16.9 — Gap remediation and automated matrix qualification — COMPLETE
- [x] Remediate all blocking gaps from DOC-16.2 through DOC-16.8.
- [x] Add deterministic validation for matrix completeness/evidence targets.
- [x] Add deterministic validation for published dApp contextual IDs.
- [x] Wire both validators into unified 420Docs qualification, workflow triggers and workflow policy.

Deliverables: `gap-remediation-qualification.md`, `scripts/validate-doc-genesis-matrix.py`, `scripts/validate-doc-contextual-dapp-map.py`.

Result: the Gaming Protocol matrix evidence path now resolves through a stable compatibility handoff to the canonical integration guide. Published Genesis dApp `CTX-<DOMAIN>-001..006` records are deterministically validated from the dApp context map; Faucet/testnet remains unresolved until testnet publication. Matrix row count, unique IDs, required evidence and evidence-path existence are CI gates. No blocking DOC-16.2 through DOC-16.8 gap remains.

## DOC-16.10 — Final Genesis documentation closeout — NEXT
- [ ] Run the completed matrix audit across every frozen Genesis surface.
- [ ] Record deliberate unsupported/unpublished states and residual non-blocking follow-ups.
- [ ] Verify zero blocking documentation gaps remain.
- [ ] Reconcile with current `main`.
- [ ] Require exact-head 420Docs and full 420 Integrated qualification.
- [ ] Merge DOC-16 only after all closeout gates are green.

## Phase exit condition
Every frozen Genesis surface has explicit reviewable evidence across all required documentation dimensions, with correct environment/version semantics, canonical authority boundaries, navigation and generated-reference provenance. Missing or deliberately unsupported coverage is explicit. No blocking Genesis documentation gap remains at merge.
