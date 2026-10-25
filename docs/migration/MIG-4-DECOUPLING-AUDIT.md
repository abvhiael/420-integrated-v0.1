# MIG-4 — Genesis game-specific coupling removal (verification checkpoint)

Status: **IN PROGRESS — NOT QUALIFIED FOR LEVEL 2 OR MERGE**.

## Provenance and current baseline
- Genesis `main` after PR #804 merge: `ac221de17766c4c30a83bea61c5f5dd607aaf9c9`.
- PR #804 preserves the approved 420Arcade deferral and its passing Genesis Arcade Deferral Reconciliation Level 1 run `40128127872` at `856a7b2a7dff75b109123b991d4c5524e8abf70b`.
- MIG-3 record: `docs/migration/MIG-3-level2-ecosystem-qualification.md`; four scoped external Level 2 passes; no live testnet claims.
- Qualified independent source: Arcade `d8bdb101dcef59048c48fe387078f7a6295462b4`; Budtender `9ab751e3cdf1fa2e8725dda0981749208ab038f5`; Smoke & Chrome `861feb3561ed22dd6c8c8a8209c30321bab3e599`; Green Road `fb0c2e72730c4a562cb465fdc526036d79164766`.

## Non-destructive source audit
Using non-truncated recursive GitHub source trees and SHA-1 Git blob identities, exact same-path/same-blob matches against Genesis were:
- Arcade: 533 / 741 tracked blobs (426 under `assets/arcade`, 44 under `docs/arcade`, 22 under `apps/arcade-web`; remainder elsewhere).
- Budtender: 705 / 716 tracked blobs (641 under `assets/budtender`).
- Smoke & Chrome: 0 / 17 tracked blobs at identical paths.
- Green Road: 0 / 18 tracked blobs at identical paths.

**These are matching subsets, not proof that the remaining files are safely disposable.** Godot runtime layout and historical Unity layout require separate path remapping and runtime verification. Smoke & Chrome and Green Road may implement interfaces with different paths; no same-path deletion authorization is inferred.

## CI dependency audit
- Genesis still owns `.github/workflows/arcade-*.yml`, `budtender-gaming.yml`, `green-road-gaming.yml`, `smoke-chrome-gaming.yml`; these must move to external repository ownership or be replaced by neutral SDK compatibility checks before deletion.
- `gaming-four-game-e2e.yml` includes High Country and shared Gaming SDK; must not be deleted outright. Split or replace external-game consumers while preserving High Country and protocol coverage.
- `packages/420-gaming-sdk/**` is shared and remains Genesis-owned.
- Preserve Registry, capabilities, entitlements, reward settlement, Gaming Protocol contracts, and High Country.
- The `420Arcade` launch catalog deferral is already reconciled via PR #804. Do not reapply historical changes or restore the application entry.

## MIG-4 remaining mandatory exit gates
1. Produce exhaustive destination path-remapping and Git blob provenance for *every* proposed game-source/art deletion, distinguishing Godot primary runtime from historical Unity source. Confirm destination HEAD remains at qualified SHA or requailfy differences.
2. Search Genesis build imports, test scripts, docs validators, Pages build roots, and workflow path triggers for every proposed removal; classify each dependency as external-only, High Country/shared retained, or still blocking.
3. Only then submit a tree diff of verified redundant game-owned files, replacing active references with canonical repository URL + SDK version + release metadata. Never delete authoritative contracts or shared packages.
4. Run affected Level 1 steps and one scoped Level 2 integration gate at the resulting exact head SHA. Prove game-only changes cannot trigger or block Genesis qualification, including an independent external-repo change.
5. Reconcile PR #800's still-open MIG-0 evidence without overwriting it. Complete PR review and merge to `main` only after gates pass.
6. Treat testnet registration, wallet acceptance, and on-chain settlement as deferred to `docs/migration/MIGRATION-TESTNET-ROADMAP.md`.

No game files or workflows were deleted at this checkpoint. No claim of MIG-4 completion or passing new tests is made.
