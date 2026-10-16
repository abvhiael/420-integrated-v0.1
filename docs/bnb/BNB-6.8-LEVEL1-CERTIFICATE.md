# BNB-6.8 — Level 1 exact-SHA qualification certificate

**Disposition: PASS — repository-side BNB-6.8 Level 1; no live production release authorization.**

## Canonical requirement and identity

Per `docs/bnb/BNB-PHASE6-ROADMAP.md`, **BNB-6.8 Release promotion and rollback controls** requires immutable image digests, release manifests, compatibility, approvals, promotion, rollback and DB recovery procedures.

- **Qualified implementation SHA:** `7b4387798d0840906633fc9b256cac162a8bf3ae`
- **Audit branch:** `audit/bnb-phase6-bnb-6-1-baseline-20261015`
- **Pull request:** [#667](https://github.com/abvhiael/420-integrated-v0.1/pull/667), draft, open and unmerged.
- **Original Phase 6 reconciliation base:** `19166dfbdafd1f51a9cd9bbd2a22abfe95b8d451`. Reconciliation with current `main` is reserved for BNB-6.12 Level 3.
- **Evidence SHA:** the separate documentation-only commit adding this certificate, not the implementation SHA.

## Implemented repository-side release controls

- `services/420bnb/release_controls.py`: fail-closed versioned manifest verification, exact release SHA and digest-pinned image identities, fixed migration version and disabled execution flags, operator approval restrictions, no automatic database down-migration, and blocked promotion/rollback pending independently verified external approvals and rehearsal.
- `services/420bnb/release.template.v1.json`: unresolved release-manifest template; placeholders are **not deployable release approval or acceptable immutable digests**.
- `services/420bnb/tests/test_bnb68_release.py`: adversarial tests for mutable image tags, malformed SHA, migration mismatch, synthetic approval, unauthorized feature activation, invalid authority evidence and rollback without proof.
- `docs/bnb/BNB-6.8-RELEASE-PROMOTION.md`: operator promotion, partial rollout containment, previous-binary compatibility, isolated restore and no-down-migration rollback/recovery runbook.
- Previously qualified `validate_deployment.py`, `migration_lifecycle.py`, `recovery_operations.py` and `operator_console.py` retain deployed topology, migration ledger and operator authorization boundaries.

## Verified exact-SHA GitHub Actions

All ten required BnB app-specific runs below are **completed / SUCCESS**, with head SHA `7b4387798d0840906633fc9b256cac162a8bf3ae`:

| Workflow | Run | Result |
| --- | --- | --- |
| 420BnB Runtime Slice | [#38946245394](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38946245394) | SUCCESS |
| BNB-1.1 Source Reconciliation | #38946245201 | SUCCESS |
| BNB-1.2 Product Contract | #38946245361 | SUCCESS |
| BNB-1.3 Domain and M1 | #38946245238 | SUCCESS |
| BNB-1.4 Authority Boundaries | #38946245296 | SUCCESS |
| BNB-1.5 Financial Architecture M2 | #38946245586 | SUCCESS |
| BNB-1.6 Backend Architecture | #38946245431 | SUCCESS |
| BNB-1.7 Guest Host Experience | #38946245384 | SUCCESS |
| BNB-1.8 Security Privacy Abuse | #38946245410 | SUCCESS |
| BNB-1.9 Deployment Operations | #38946245307 | SUCCESS |

- Supplemental 420Oracle audit [#38946245403](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38946245403) was **IN PROGRESS** at the evidence check and is not counted as passing required BnB Level 1 evidence.
- 420Docs qualification #38946245351 was **SKIPPED**, not counted as PASS, and not required at Level 1.
- No global Solidity, Genesis, Integrated, Geth or Docs qualification was manually launched or rerun for this certificate.

## Acceptance boundary and disposition

**Repository-side BNB-6.8 Level 1: PASS.** Real published registry digests, signed release authority, separately approved production credentials, previous-binary compatibility proof against live schema, independently verified immutable backup/restore, production promotion, manual incident rollback rehearsal and live operator acceptance remain blocked and separately tracked under `docs/bnb/BNB-TESTNET-WORK-ROADMAP.md`.

The configuration and code do not self-approve live release, enable booking or financial execution, or execute destructive down migrations. The certificate does **not** establish production release readiness or phase merge eligibility.

**Level 2:** next BNB-6.11. **Level 3:** BNB-6.12, after current-main reconciliation and frozen-input preflight. **PR #667:** retain draft/unmerged. **Next canonical step:** BNB-6.9 — Security and abuse readiness.
