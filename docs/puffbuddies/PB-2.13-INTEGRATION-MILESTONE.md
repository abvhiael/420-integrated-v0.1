# PB-2.13 — PB-2 Integration Milestone — Level 2

## Purpose
Qualify the accumulated PB-2.1 through PB-2.12 eligibility/account/profile-authorization work as one app-specific integration boundary before PB-2 phase closeout.

PB-2.13 is the documented **Level 2** milestone. It is intentionally broader than ordinary Level-1 steps but remains PuffBuddies-focused and must not be expanded into PB-2.14 repository-wide Level-3 closeout.

## Canonical integration requirements
1. Authoritative 420Identity verification must flow into the canonical PB-2 eligibility projection/state model.
2. Privacy-preserving proof verification must converge on the same minimum-disclosure eligibility contract without raw proof/identity persistence.
3. Eligibility persistence must survive reload with sequence/time/policy authority intact.
4. Current eligibility must bind into PB-1.5 authorization rather than trusting injected bare eligibility.
5. Current two-party eligibility must gate discovery and matching actions without manufacturing reciprocal consent.
6. Current MATCHED + current eligibility must gate ordinary messaging for both participants.
7. Revocation/expiry/policy drift must propagate through persistence and authorization as fail-closed state.
8. Eligibility revocation must advance derived-generation authority and invalidate stale discovery, matching and messaging authorization.
9. Recovery/restore must not resurrect pre-revocation ELIGIBLE state.
10. Lifecycle, block and relationship/consent restrictions must remain independently restrictive even when eligibility is valid.
11. Privacy/minimum-disclosure hardening must remain intact across integrated flows; no public eligibility, relationship or membership oracle may emerge.
12. PB-2.11 adversarial and PB-2.12 failure/recovery protections must remain green in the retained app suite.
13. The milestone must run the complete retained PuffBuddies test inventory plus a dedicated PB-2.13 cross-component integration suite against one exact SHA.
14. Public-chain/raw-identity negative gates must remain green.
15. No production identity provider, proof scheme, matching engine, Messenger transport, database topology, deployment, contract, fixed address/service ID or live integration may be invented by this milestone.

## Affected components
- `puffbuddies/tests/test_pb_2_13_integration.py`
- `.github/workflows/puffbuddies-pb2.yml`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- this canonical definition and durable qualification evidence

## Qualification
**Level 2 — app integration milestone qualification.**

The Level-2 evidence must be tied to the exact accumulated implementation SHA. The workflow must include:
- exact-head verification;
- full PuffBuddies compile;
- complete retained PuffBuddies test inventory;
- dedicated PB-2.13 integration suite;
- identity privacy/public-chain negative gate.

PB-2.13 does not require canonical full Solidity, Genesis/address-authority, 420 Integrated/global, Geth/fault/soak, repository-wide Docs/global reconciliation, deployment/config verification, or unrelated app qualification. Those remain PB-2.14 Level 3 where applicable.

## Dependencies
PB-2.1 through PB-2.12 COMPLETE; retained PB-0/PB-1 foundations; PB-1.13 integration foundation.

## Current-main divergence rule
Before qualification, inspect current `main`. If newer main work materially overlaps PuffBuddies or a shared authority used by PB-2, reconcile it before Level 2. Unrelated app/contract/global-CI movement alone does not justify a ceremonial milestone rebase.

## Exit criteria
Every canonical integration requirement above passes; the complete retained PuffBuddies inventory and dedicated PB-2.13 suite pass on one exact implementation SHA; the privacy/public-chain negative gate passes; current-main divergence is inspected and either reconciled or documented as non-overlapping; durable Level-2 evidence is recorded; no Level-3-only work is falsely claimed.
