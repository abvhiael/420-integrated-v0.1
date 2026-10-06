# PB-2.2 qualification evidence

## Step
**PB-2.2 — Adult eligibility state model — COMPLETE**

## Qualification level
**Level 1 — ordinary roadmap-step fast qualification**

## Qualified implementation SHA
`97f89010170bf77e0c33ee5654e16906cd2713d6`

## Repository relationship
- branch: `puffbuddies-pb2-eligibility-20261006`
- PR: #538
- current main / PR base: `23ebff000a471bfbc4439894f797f3b17a530867`
- PB-2.2 accumulated directly on the already-qualified PB-2 branch
- PR was mergeable when qualification was inspected

## Implementation summary
PB-2.2 implements the private adult-eligibility state model required by PB-0.6 and PB-2.1. Eligibility begins UNKNOWN and fails closed; authoritative conclusions become ELIGIBLE, INELIGIBLE, EXPIRED, or REVOKED; accepted state is bound to source version, current policy version, monotonic sequence, and checked time. Expiry, provider failure, policy-version change, stale replay, and reverification semantics are explicit and tested. Eligibility remains necessary but not sufficient for participation and retains all-derived invalidation behavior.

## Files changed
- `puffbuddies/domain/eligibility_state.py`
- `puffbuddies/tests/test_pb_2_2_adult_eligibility_state.py`
- `docs/puffbuddies/PB-2.2-ADULT-ELIGIBILITY-STATE-MODEL.md`
- `.github/workflows/puffbuddies-pb2.yml`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`

## Requirements satisfied
- UNKNOWN is the initial state and cannot authorize ordinary participation.
- ELIGIBLE requires current authoritative evidence and a current expiry.
- INELIGIBLE, EXPIRED, REVOKED, and UNKNOWN cannot authorize ordinary participation.
- Provider/authority failure resolves to UNKNOWN rather than fail-open ELIGIBLE.
- Policy-version change invalidates prior authority until fresh compatible reevaluation.
- Stale/replayed decisions and time rollback are rejected.
- Reverification after EXPIRED/REVOKED/UNKNOWN requires a fresh higher-sequence authoritative conclusion.
- Eligibility changes invalidate all derived PuffBuddies authority surfaces.
- ELIGIBLE cannot override lifecycle/safety restrictions.
- No raw identity evidence, public eligibility registry, production identity adapter, fixed address/service ID, or live deployment is introduced.

## Exact-SHA Level 1 CI evidence
**PuffBuddies PB-2 Qualification**
- run: `37501793538` — **SUCCESS**
- job: `112400378467` (`pb2-fast`) — **SUCCESS**
- exact qualification head — PASS
- PuffBuddies compile — PASS
- PB-2.1 retained identity/eligibility boundary tests — PASS
- PB-2.2 targeted adult eligibility state model — PASS
- retained PuffBuddies regression inventory — PASS
- identity privacy/public-chain negative gate — PASS

## Additional auto-triggered checks
On the same implementation SHA:
- PuffBuddies PB-1 Qualification — SUCCESS
- PuffBuddies PB-0 Qualification — SUCCESS
- 420Docs Qualification — SUCCESS
- 420Oracle audit qualification was still in progress when inspected and is not a PB-2.2 Level-1 requirement; it is not counted as PB-2.2 qualification evidence.

## Security / adversarial / failure-path results
PASS for UNKNOWN fail-closed behavior, stale/replayed sequence rejection, time rollback rejection, expiry boundary, revoked/ineligible nonparticipation, provider outage fail-closed behavior, policy-version invalidation, fresh reverification requirement, derived-state invalidation, and lifecycle supremacy over eligibility.

## Milestone status
PB-2.2 is **not** Level 2 milestone A. The accumulated PB-1/PB-2 account/profile/private-state integration milestone remains deferred until the relevant PB-2 account/profile/visibility work converges.

## Intentionally deferred Level 3 checks
Canonical full Solidity, Genesis/address authority, 420 Integrated/global, Geth/fault/soak, broad repository Docs/global reconciliation beyond auto-triggered checks, unrelated app suites, production deployment/configuration, and live/testnet identity-provider qualification remain deferred to the applicable Level-3 phase/release closeout boundary.

## Limitations / blockers
No blocker for PB-2.2. Production identity provider/RPC behavior, jurisdiction data, account registration/activation, profile editing, field-level visibility, session controls, deployment, and live/testnet behavior remain later PB-2 or downstream roadmap work.

## Evidence inheritance
This qualification document and the roadmap COMPLETE marker are evidence-only bookkeeping after the executable implementation SHA above passed. They do not modify runtime code, tests, workflow logic, dependencies, configuration, interfaces, deployment state, or substantive requirements. They therefore inherit the tested implementation SHA without recursive qualification.

## Completion state
**COMPLETE** against exact Level-1 implementation SHA `97f89010170bf77e0c33ee5654e16906cd2713d6`.

## Next canonical roadmap step
**PB-2.3 — Age-verification interface**
