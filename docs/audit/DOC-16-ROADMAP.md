# DOC-16 — Genesis documentation audit roadmap

DOC-16 is the final Genesis-wide documentation matrix audit. It does not create new protocol or application authority. It verifies that the documentation already produced in DOC-0 through DOC-15 is complete, internally coherent, environment/version correct, safely navigable, and explicit about unsupported or unpublished states.

DOC-16 follows the monolithic documentation-phase policy: DOC-16.1 through DOC-16.10 remain on one branch and pull request, then reconcile with current `main`, requalify the exact head with 420Docs and full 420 Integrated qualification, and merge once.

## DOC-16.1 — Audit authority, dimensions and frozen Genesis inventory — ACTIVE

- [x] Define the audit authority and non-authority boundary.
- [x] Freeze the Genesis documentation audit dimensions: architecture, user, developer, security/privacy, troubleshooting/recovery, generated/reference.
- [x] Define supported environment/version dimensions and fail-closed handling for unpublished tracks.
- [x] Establish the matrix row contract and evidence requirements.
- [ ] Materialize the canonical Genesis surface inventory into the machine-readable matrix.

Deliverables:

- `docs/audit/DOC-16-ROADMAP.md`
- `docs/audit/genesis-documentation-matrix.md`
- later in DOC-16.1: `docs/audit/genesis-documentation-matrix.json`

## DOC-16.2 — Architecture coverage audit

- [ ] Verify every Genesis surface has an architecture/system-context route.
- [ ] Verify authority, dependency and trust-boundary coverage.
- [ ] Record gaps, deliberate exclusions and remediation owners.

## DOC-16.3 — User journey coverage audit

- [ ] Verify onboarding, primary tasks, state/value-changing actions and safe completion states.
- [ ] Verify signing, permissions, fees and network/environment warnings where applicable.
- [ ] Verify testnet-only and protocol-only surfaces are not presented as general user applications.

## DOC-16.4 — Developer integration coverage audit

- [ ] Verify canonical discovery, interfaces, network identity, reads/writes, events/errors and integration examples.
- [ ] Verify generated reference handoffs and provenance.
- [ ] Verify operational tooling is not promoted into protocol authority.

## DOC-16.5 — Security and privacy coverage audit

- [ ] Verify secret-handling boundaries, signing authority, private payloads and support-safety rules.
- [ ] Verify value-risk, bridge/provider, identity and recovery-specific warnings.
- [ ] Verify documentation never weakens runtime safety for liveness or convenience.

## DOC-16.6 — Troubleshooting and recovery coverage audit

- [ ] Verify stable `TRB-*` coverage and contextual `CTX-*` routing for supported surfaces.
- [ ] Verify retry safety, authority-first diagnostics and escalation paths.
- [ ] Verify timeout/unknown-state handling does not fabricate success or failure.

## DOC-16.7 — Reference, version and environment audit

- [ ] Verify generated-reference provenance and freshness.
- [ ] Verify DOC-13 environment/version routing and immutable Genesis behavior.
- [ ] Verify unpublished testnet/mainnet targets fail closed and no cross-environment fallback exists.

## DOC-16.8 — Navigation and cross-link audit

- [ ] Verify audience entry points and predictable routes between architecture, manuals, developer docs, troubleshooting and reference.
- [ ] Verify contextual links and Ask 420 citations resolve only to canonical published material.
- [ ] Verify no orphaned required Genesis documentation remains.

## DOC-16.9 — Gap remediation and automated matrix qualification

- [ ] Remediate all blocking coverage gaps discovered by DOC-16.2 through DOC-16.8.
- [ ] Add deterministic machine validation for matrix completeness and evidence targets.
- [ ] Integrate the matrix validator into unified 420Docs qualification and workflow trigger policy.

## DOC-16.10 — Final Genesis documentation closeout

- [ ] Run the completed matrix audit across every frozen Genesis surface.
- [ ] Record deliberate unsupported/unpublished states and residual non-blocking follow-ups.
- [ ] Verify zero blocking documentation gaps remain.
- [ ] Reconcile the monolithic DOC-16 branch with current `main`.
- [ ] Require exact-head 420Docs qualification and exact-head full 420 Integrated qualification.
- [ ] Merge DOC-16 only after all closeout gates are green.

## Phase exit condition

Every frozen Genesis surface has explicit, reviewable evidence across architecture, user, developer, security/privacy, troubleshooting/recovery and reference documentation, with correct environment/version semantics, canonical authority boundaries, navigation and generated-reference provenance. Missing or deliberately unsupported coverage is explicit rather than silently substituted. No blocking Genesis documentation gap remains when DOC-16 merges.
