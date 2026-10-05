# PB-0.6 qualification evidence

## Step

**PB-0.6 — Adult eligibility policy**

## Qualification level

**Level 1 — per-roadmap-step fast qualification**

## Canonical definition

PB-0.6 establishes the adult eligibility floor, minimum-disclosure eligibility interface, canonical policy conclusions, revocation/staleness/reverification requirements, and dependency contract for later canonical identity/attestation integration.

## Implementation summary

PB-0.6 adds:

- canonical age floor of 18+;
- ELIGIBLE / INELIGIBLE / UNKNOWN policy conclusions;
- UNKNOWN fail-closed behavior;
- PB-ELIG-001 through PB-ELIG-020;
- privacy-preserving eligibility conclusion instead of raw DOB/identity evidence;
- jurisdiction tightening rules;
- expiration, revocation, staleness, reverification, and policy-version reevaluation requirements;
- suspension/ban/lifecycle precedence;
- prohibition on payment/token/admin/self-assertion bypass;
- dependency requirements for canonical identity/attestation authority;
- canonical adversarial/failure classes for later implementation qualification.

No 420Identity integration, credential implementation, identity contract, fixed address, service ID, provider configuration, deployment, or live eligibility verification is introduced by PB-0.6.

## Files changed

- `docs/puffbuddies/PB-0.6-ADULT-ELIGIBILITY-POLICY.md`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- `scripts/verify-puffbuddies-pb0.py`
- `docs/puffbuddies/PB-0.6-QUALIFICATION.md`

## Requirements satisfied

Pending exact-head qualification.

## Implementation SHA

**PENDING EXACT-HEAD QUALIFICATION**

## Current main/base SHA

Current `main` observed at step start: `b5703dd932f28129a7898fafc579e084e5619b2f`

PR #526 remains based on its historical base `b338b9c9c140957b0ea8619b0b20bfed415f2c6d`; current-main reconciliation is deferred because intervening changes are unrelated compute/global qualification work and PB-0.6 is an ordinary app-scoped Level 1 step. The accumulated branch currently requires later reconciliation before merge.

## CI evidence

Workflow: **PuffBuddies PB-0 Qualification**

Pending exact-head run.

## Security/adversarial/invariant scope

The cumulative verifier must reject:

- missing, duplicate, or reordered PB-ELIG identifiers;
- age floor below 18;
- UNKNOWN treated as eligible;
- raw DOB/government identity as public PuffBuddies state;
- stale/revoked/expired evidence treated as permanently valid;
- jurisdiction rules lowering the adult floor;
- payment/token/admin/self-assertion eligibility bypass;
- public wallet/profile membership inference from eligibility evidence;
- claims of implemented identity/provider integration or live verification.

## Milestone status

PB-0.6 is not a Level 2 integration milestone. It defines the policy/interface contract for future identity integration but introduces no executable shared dependency.

## Intentionally deferred checks

Level 2 retained PuffBuddies integration is not required for PB-0.6.

Level 3 repository-wide Solidity, Genesis/address-authority, 420 Integrated/global, Docs/global reconciliation, clients/services, Indexer/Search/RPC, deployment/config, final security qualification, and current-main merge-candidate reconciliation remain deferred to the appropriate accumulated phase boundary.

## Limitations

PB-0.6 does not choose or implement credential formats, proof systems, issuer keys, identity-provider UX, jurisdiction database, contract addresses, storage, or exact API shape.

## Blockers

Exact-head Level 1 qualification must pass before PB-0.6 is formally COMPLETE.

The accumulated PR branch must later be reconciled with current `main` before merge/Level 3 closeout; that is not a PB-0.6 Level 1 completion blocker because the intervening main changes do not modify PuffBuddies PB-0.6 dependencies.

## Completion state

**PB-0.6 — PENDING QUALIFICATION**

## Next canonical roadmap step

**PB-0.7 — Threat/trust model**
