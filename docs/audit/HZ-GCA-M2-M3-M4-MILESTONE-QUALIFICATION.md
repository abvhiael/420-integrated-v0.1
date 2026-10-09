# 420Hz GCA — M2/M3/M4 milestone verification

Status: **IMPLEMENTED; exact-SHA workflow outcome not yet independently verified**. Do not mark a milestone qualified from this document alone.

PR #565. Source of truth: current branch HEAD and `.github/workflows/420hz-gca-milestones.yml`.

## M2 — Community milestone

`hz/generate/test/milestone-integration.test.js` composes real in-repository Community and Charts modules against one shared source recording. It checks follow/favorite/public playlist state, privacy of favorites, source-private exclusion, qualified-play source verification, score non-inflation from raw plays or replay, snapshot checkpoint authentication and discovery visibility. It is deliberately non-production: the trusted source/qualification fixtures are not Wallet, Creative or Indexer services.

## M3 — Awards milestone

The same suite composes AwardsDomain420, AwardVoting420 and HzCrossService420 for a published recording through nomination, acceptance, candidate freeze, voting, replay rejection, final result and permanent badge, followed by public release/award discovery and Explorer projections. It asserts stable recording identity across projections, private-notification fail-closed behavior and conflicting event replay rejection. Local fixture-backed award voting does not qualify a real unique-human voting authority or live results.

## M4 — Product security/integration

Retained app-wide `npm run qualify` is required alongside the above integration tests, with checkout asserted against the triggering exact SHA. The integration suite also checks forged qualifying plays, private source exclusion, wrong checkpoints, vote replay, private event exclusion and cross-service event conflicts. HZ-GCA-15 threat closure is still **PARTIAL**: production Wallet signatures/revocation, Creative consent, provider attestation, persistent atomic replay and quota, cross-replica Sybil/collusion, signed checkpoints, robust media fetch/decoding, secrets tracing and deployed moderation enforcement require real trusted adapters and execution evidence. Never authorize public writes from injected caller-controlled booleans.

## HZ-GCA-14 carry-forward

Live same-object Notifications, Indexer/Search, Analytics, Explorer, source checkpoint backfill/reorg, durable dedupe, authenticated private subscriptions and deployed endpoint qualification remain HZ-GCA-18 work, as specified in `docs/audit/420HZ-TESTNET-DEFERRED-INTEGRATION-ROADMAP.md`. This milestone suite verifies in-repository contracts, **not** those external services.

## Qualification instructions

Run the existing `420Hz GCA M2 M3 M4 milestone integration` workflow against the exact current branch implementation SHA. Preserve the run ID, checkout SHA, all job/step conclusions and counts. Mark M2/M3 milestone Level 2 only after that suite and retained app tests pass and the intended cross-module coverage is reviewed. M4 remains partial until its repository-side remaining security controls are genuinely wired and retested; record separately testnet-gated items. Do not invoke Solidity Foundry, Genesis or global Level 3 for these milestones. HZ-GCA-17 remains blocked until accurate repository-side M4 disposition and one final exact-main reconciliation.
