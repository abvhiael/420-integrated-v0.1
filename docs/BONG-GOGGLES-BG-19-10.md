# BG-19.10 — notifications, rewards, moderation and safety web surfaces

Status: UI/model and focused tests implemented on BG-19 PR #350; exact-head qualification pending. **Not a live end-to-end integration.**

## Delivered

- `bong-goggles/web/core/operations.js` validates recipient-scoped notification lifecycle, beneficiary-scoped rewards, affected-account moderation cases, deep-link allowlisting, and forbidden private payload fields. UI values are explicitly non-authoritative.
- `bong-goggles/web/core/operations-ui.js` renders notification history/unread and finalized-only deep links, distinct reward submitted/accrued/claimable/paid stages, and private safety/appeal case status. Unsupported claim and appeal buttons remain disabled rather than implying an available backend write.
- `bong-goggles/web/core/app-shell.js` exposes `/notifications`, `/rewards`, and `/safety` using optional qualified projections; missing projections fail closed. `/safety` requires a connected supported-network Wallet session and is included in the route inventory.
- `bong-goggles/web/test/operations.test.js` tests account separation, privacy, lifecycle/deep-link restrictions, unsupported writes, and absent transport. Existing navigation tests were updated to include the safety route.

## Canonical boundaries

BG-16/420Notifications retains notification lifecycle and recipient state; BG-18 plus the shared ContributionRegistry420, RewardCampaignRegistry420, RewardDistributor420 and RewardPool420 retain reward accrual and payout authority; qualified moderation/safety services and contracts retain report, action, appeal and decision authority. The browser cannot transform a pending Wallet request, a game leaderboard, a local recommendation or a projected moderation status into canonical reward payment or a final safety decision. Game rewards remain deferred.

`prepareOperationsIntent` is *not executable*: the qualified service must resolve the actual contract ABI, deployment binding, permission, chain, exact method and Wallet confirmation. Do not invent report/appeal/claim Solidity method signatures in the browser. No operator/admin route is exposed without a separately verified scoped authorization boundary.

## Remaining gates

1. Add verified browser-facing recipient/beneficiary/affected-user projection endpoints with session authentication, policy redaction, cursor/replay rules and revalidation after logout/block/policy changes.
2. Bind the frontend runtime to qualified 420Notifications preferences and deep-link resolution; prove retraction/supersession updates remove stale actionable links.
3. Verify deployed reward campaign/distributor/pool ABI and chain; connect claim preview, 420Wallet signing, canonical receipt/refresh, rollback and Explorer links. Do not claim payment based on local submission.
4. Bind reporting and appeal forms to the actual qualified moderation service and access controls; provide verified evidence handling and confidential case transport. Do not expose operator/admin functions to ordinary users.
5. Add integration tests using real qualified service/deployment fixtures and complete browser journeys before production closeout (BG-19.14/15).
