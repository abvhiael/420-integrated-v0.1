# BC-1.6 — authenticated Cribbage challenges, rematches and history

**Status: implementation committed on feature branch; exact-head CI qualification pending. This is NOT public Play activation.**

BC-1.6 adds 420ID-authenticated private Cribbage challenges to mutual friends, session-bound one-time rematches requiring fresh consent by all human opponents, a PostgreSQL-only request idempotency ledger, per-account verified score/result history, bounded safe statistics, pending invitation notices, and the new History and Rematch UI.

All metadata is off-chain, wallet-optional, zero-wager and reward-free. Server-owned game sessions are never synthesized by the browser, and hidden hands, seeds and journals are never projected. BC-1.5 release gating is preserved.

Operator application: migrate 009_classic_match_requests.sql using the migration role, then grant SELECT,INSERT only on bg_account_social.classic_match_requests to bonggoggles_social_runtime. Do not grant UPDATE,DELETE,TRUNCATE, table-wide changes or schema rights. ReadyClassicMatchRequests rejects unsafe runtime privileges. Missing migration or permissions fail closed for new invitations.

Qualification: bc-1-6-cribbage-social.yml (signed two-account PostgreSQL 16 Go race and focused Node UI privacy/interaction tests). Exact commit and workflow results must be recorded here after execution and before roadmap promotion.

Next canonical milestone: BC-1.7 full Cribbage qualification and E2E; BC-1.8 release separate.
