# HC-NEXT-7.5-E — Safe reward recognition

## Canonical authority and scope

The only current Global420Cup award is the original nonfinancial, nontransferable trophy and scope-bound prestige attestation emitted by `Global420Cup.issueCrossGame`. The `prizeRulesHash` commits to published policy but neither funds nor authorizes a payout. No $420, BUDS, treasury debit, mint, side ledger or custody transfer is in scope. The original immutable champion/commitment remain historical after finality or entitlement revocation.

`createGlobalCupProjection420` requires the independently finalized chain/block, code hash, existing canonical bracket, winning entrant and live issuance. `createPostgresCupAchievements420` persists observations only; the runner is not a second awarding authority. Reads verify the source before examining persisted records. **A record is current only when chain ID, Cup contract address, issuance scope, finalized block hash, result commitment, champion and prestige state all match the newly verified source.** The persistence game ID and requested Cup ID bind the query. A stored row from another chain, contract or scope must never inherit authorization even if winner/block/commitment appear identical.

## Failure and recovery

Source revocation, stale verification, reorg, finality uncertainty or RPC failure denies current recognition; stored history is not deleted. A new successfully verified source observation can be synchronized by the authorized worker under serializable transaction and advisory lock. Historical duplicate observations are suppressed by unique constraints, with bounded retries after proven PostgreSQL serialization conflicts. No correction alters the Cup's original on-chain winner, and no claim is promoted solely because an old history row exists.

## Qualification and constraints

The 7.5-E change adds context comparisons in `highcountry-cup-achievements.js`, unit regressions in `highcountry-cup-integration.test.js` and real PostgreSQL tamper tests in `highcountry-cup-postgres.integration.mjs`. Existing integration coverage already checks source revocation, repeated issuance, restart, transaction rollback, conflicting concurrent workers and cross-Cup identity isolation. The scoped High Country HC-NEXT-7.4 Cup Projection workflow qualifies the modified service persistence and real PostgreSQL tests; the original Foundry Cup authority and EVM qualification remain historical evidence when contract code is unchanged.

No broad matrix, mandatory preflight certificate, new branch approval rules, or monetary reward mechanism is introduced. This closes only 7.5-E when the affected checks pass. HC-NEXT-7.5-F remains the next original complete player-journey qualification requirement.
