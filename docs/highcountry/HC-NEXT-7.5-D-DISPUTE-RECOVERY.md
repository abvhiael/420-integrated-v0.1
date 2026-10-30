# HC-NEXT-7.5-D — Dispute and corrected-result recovery

## Canonical decision authority

The source of truth remains R04.12 `CompetitionEngine` or the registered issuer-backed ordinary exhibitions service. A finalized competition winner, score or Cup commitment is immutable. No mutable administrative winner override, unrestricted appeal or parallel championship ledger is introduced.

Ordinary exhibitions bind every dispute to the original game, event, account, harvest and committed reason hash. The existing active adjudicator may reject an already-submitted result only before `challengeUntil`. The rejection and append-only `PRE_FINAL_REJECTION` audit row commit in the same serializable PostgreSQL transaction. Late, duplicate, unauthorized, invalid or finalized-event rejections fail closed.

After finalization, the active adjudicator may record **one immutable review observation per candidate** of the independently reverified original harvest: `POST_FINAL_VALID` or `POST_FINAL_INVALID`. A review is not a second decision about the historical winner. The server itself derives the status from exact canonical account/harvest/quality/time/provenance; clients cannot supply a disposition or a corrected score. A provider exception aborts the transaction rather than creates a false finding. A unique partial index prevents conflicting terminal post-final outcomes across workers. Authenticated judge-only `/highcountry/exhibitions/review` and `/highcountry/exhibitions/adjudicationHistory` expose the narrowly scoped operations, without wallet dependence.

The existing event scoring recomputes independently from unrejected original submissions and current verified harvest evidence at the single canonical finalization; deterministic high-quality, earlier-time, lexical-ID tie-breaks are unchanged. A post-final invalidation remains in history; original winner, score and immutable digest are never rewritten, and no alternative champion/financial reward is issued. Current recognition must still independently reverify canonical truth, rather than treating a stored review as a new finality oracle.

## Migration and qualification

Use the existing migrator role to apply `010_highcountry_ordinary_exhibitions.up.sql`, then `migrateExhibitionRecovery420` for additive `012_highcountry_exhibition_recovery.up.sql` **before enabling the updated ordinary-exhibitions service**. The migration is idempotent, digest-tracked and refuses partial/untracked prior schema; the runtime role receives SELECT and INSERT only on audit history (no UPDATE/DELETE/DDL). Existing historical 010 digest is unchanged.

Scoped acceptance: `highcountry-ordinary-exhibitions.test.js` for authorization, deadline, immutability, duplicates, reject-to-finalize and no winner substitution; `highcountry-ordinary-postgres.integration.mjs` for actual PostgreSQL migrator authority, history constraints, transaction/restart and terminal replay; retained HTTP auth tests for the service boundary. Target `.github/workflows/highcountry-ordinary-exhibitions-next-7-2.yml` and the directly affected service tests, not global Foundry, Genesis or Level 3. The workflow is used as a test owner, not requalification of the original 7.2 milestone. Existing 7.5-B/C qualified evidence remains historical.

**Boundary:** R04.12 on-chain `reject` and one-time `finalize` remain unchanged. Existing `resultIsCurrent`, Cup current-result checks and finalized RPC projection must fail closed on revoked/reorged evidence. Actual external validator finality, issuer credentials and deployed authority are testnet/operational acceptance in the existing `HIGHCOUNTRY-TESTNET-WORK-ROADMAP.md`, not justified local fixture claims.

**Next canonical step:** HC-NEXT-7.5-E safe reward recognition. This package does not itself certify the overall 7.5 player journey.
