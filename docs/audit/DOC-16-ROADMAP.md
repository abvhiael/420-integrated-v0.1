# DOC-16 — Genesis documentation audit roadmap

DOC-16 is the final Genesis-wide documentation matrix audit. It does not create new protocol or application authority. It verifies that the documentation already produced in DOC-0 through DOC-15 is complete, internally coherent, environment/version correct, safely navigable, and explicit about unsupported or unpublished states.

DOC-16 follows the monolithic documentation-phase policy: DOC-16.1 through DOC-16.10 remain on one branch and pull request, then reconcile with current `main`, requalify the exact head with 420Docs and full 420 Integrated qualification, and merge once.

## DOC-16.1 — Audit authority, dimensions and frozen Genesis inventory — COMPLETE

- [x] Define the audit authority and non-authority boundary.
- [x] Freeze the Genesis documentation audit dimensions: architecture, user, developer, security/privacy, troubleshooting/recovery, generated/reference.
- [x] Define supported environment/version dimensions and fail-closed handling for unpublished tracks.
- [x] Establish the matrix row contract and evidence requirements.
- [x] Materialize the canonical Genesis surface inventory into the machine-readable matrix.

Deliverables:

- `docs/audit/DOC-16-ROADMAP.md`
- `docs/audit/genesis-documentation-matrix.md`
- `docs/audit/genesis-documentation-matrix.json`

The initial matrix is grounded in the frozen `config/genesis-applications.json` inventory: 20 user-facing/testnet manual targets plus the protocol-only 420 Gaming Protocol. Every row records its semantic environment, required audit dimensions, canonical evidence candidates and authority caveat. Faucet is explicitly testnet-only and remains unpublished until DOC-13 publishes a testnet documentation track.

## DOC-16.2 — Architecture coverage audit — COMPLETE

- [x] Verify every Genesis surface has an architecture/system-context route.
- [x] Verify authority, dependency and trust-boundary coverage.
- [x] Record gaps, deliberate exclusions and remediation owners.

Deliverable:

- `docs/audit/architecture-coverage-audit.md`

Result: all 21 frozen audit surfaces have architecture/system-context coverage. No blocking architecture gap was found. One non-blocking matrix metadata defect was recorded: the Gaming Protocol row points to nonexistent `docs/developers/gaming-protocol.md`; the canonical evidence exists at `docs/developers/gaming-protocol-integration.md`. DOC-16.9 owns correction plus automated target-existence validation.

## DOC-16.3 — User journey coverage audit — COMPLETE

- [x] Verify onboarding, primary tasks, state/value-changing actions and safe completion states.
- [x] Verify signing, permissions, fees and network/environment warnings where applicable.
- [x] Verify testnet-only and protocol-only surfaces are not presented as general user applications.

Deliverable:

- `docs/audit/user-journey-coverage-audit.md`

Result: the 20 user-facing/testnet targets preserve complete task-oriented journeys and the required signing/economic/finality boundaries where applicable. 420 Gaming Protocol remains deliberately protocol-only, while Faucet remains testnet-only and unpublished by DOC-13 policy. No blocking DOC-16.3 gap was found.

## DOC-16.4 — Developer integration coverage audit — COMPLETE

- [x] Verify canonical discovery, interfaces, network identity, reads/writes, events/errors and integration examples.
- [x] Verify generated reference handoffs and provenance.
- [x] Verify operational tooling is not promoted into protocol authority.

Deliverable:

- `docs/audit/developer-integration-coverage-audit.md`

Result: the DOC-9 developer path and DOC-10 generated-reference handoff cover the frozen Genesis surface set without promoting Developer Hub, SDK, CLI, Indexer, AppStore or provider infrastructure into protocol authority. No blocking DOC-16.4 gap was found. The previously recorded Gaming Protocol matrix path defect remains queued for DOC-16.9 remediation.

## DOC-16.5 — Security and privacy coverage audit — NEXT

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