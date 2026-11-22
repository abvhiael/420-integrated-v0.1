# BC-1.6 — authenticated Cribbage challenges, rematches and history

**Status: REPOSITORY QUALIFIED at `ac167b9c015d1483abd1050d8cce7708bc4b2998` (merged in `bc63bb23009a93aacef88622ffdb7bbf4af96a66`); no live production activation or public Play accepted.**

BC-1.6 adds 420ID-authenticated private Cribbage challenges to mutual friends, session-bound one-time rematches requiring fresh consent by all human opponents, a PostgreSQL-only request idempotency ledger, per-account verified score/result history, bounded safe statistics, pending invitation notices, and the new History and Rematch UI.

All metadata is off-chain, wallet-optional, zero-wager and reward-free. Server-owned game sessions are never synthesized by the browser, and hidden hands, seeds and journals are never projected. BC-1.5 release gating is preserved.

Operator application: migrate 009_classic_match_requests.sql using the migration role, then grant SELECT,INSERT only on bg_account_social.classic_match_requests to bonggoggles_social_runtime. Do not grant UPDATE,DELETE,TRUNCATE, table-wide changes or schema rights. ReadyClassicMatchRequests rejects unsafe runtime privileges. Missing migration or permissions fail closed for new invitations.

Qualification: bc-1-6-cribbage-social.yml, exact-head run #45077438374 SUCCESS (signed two-account PostgreSQL 16 Go race and 17/17 focused Node UI tests); web #45077438413 SUCCESS; startup/room/two-account #45077438427 SUCCESS. Five unrelated Cloudflare Workers Builds checks were failures and are not BC-1.6 source qualification.

Next canonical milestone: BC-1.7 full Cribbage qualification and E2E; BC-1.8 release separate.

BC-1.6 activation is independently fail-closed: `SOCIAL420_CRIBBAGE_SOCIAL_MODE=restricted-acceptance` requires `ReadyClassicMatchRequests` to pass against the runtime PostgreSQL identity with SELECT+INSERT and no UPDATE, DELETE or TRUNCATE. The default is off with HTTP 404 for all new APIs; BC-1.5 remains usable without 009.
