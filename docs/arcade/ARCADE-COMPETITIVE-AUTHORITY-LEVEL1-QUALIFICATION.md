# Arcade competitive ranking infrastructure — scoped qualification certificate

**Requested capabilities:** Authoritative score verification; server-side replay protection; public competitive rankings; live Gaming Protocol registration.
**Honest disposition:** Server infrastructure Level 1 PASS; actual authoritative game results, live public rankings and live registration BLOCKED on independent replay-verifier qualification and official testnet authority. Do not represent this certificate as approval to activate the unfulfilled features.

- **Qualified implementation SHA:** `b2747c195035cbac51610fd871733be9befc6cb0`
- **Reconciliation base:** `e7d37510261baf143464d6137449e54adcbec9c6`
- **PR:** [#758](https://github.com/abvhiael/420-integrated-v0.1/pull/758)
- **Branch:** `audit/arcade-score-authority-readiness`
- **Successful Level 1 workflow:** [39209893380](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39209893380)
- **Successful job:** `117920710706`, completed/success.
- **Tests:** server challenge validation, independent verifier required, randomized challenge identity, durable one-time record, transaction rollback, forged seed/game/player/score refusal, rejected replay with no leaderboard publication, score ranking query, retained ARC-1.9 event tests.

## Completion versus external gates

Implementation: `services/arcade-ranking/src/authority.mjs`, PostgreSQL DDL `sql/001_competitive_results.sql`, and scoped negative/security tests. Service methods require an independent approved game-specific replay verifier with qualified ruleset digest and a finalized Registry registration resolver. Unconfigured verification or registration fails closed.

Unmet operational proof: actual game rulesets and deterministic replay engines; independent fraud/security qualification; authenticated publicly reachable backend and PostgreSQL deployment; player ownership authentication and abuse/rate limiting; live finalized Gaming Protocol game registration; production economics/legal/release authorization where applicable. No on-chain operator transaction was executed. The canonical `deployments/gaming/testnet.runtime.json` remains `UNRESOLVED_UNTIL_DEPLOYMENT` with null chain ID, protocol addresses and operator references. GP-17.9 framework implementation is not live testnet proof.

**Level 2:** Not triggered. **Level 3:** Not triggered. This is not an ARC phase closeout. No global suites manually dispatched.

**Merge rule:** Preserve the qualified implementation SHA; this is evidence-only. Check GitHub main/reconciliation and required checks before merging the infrastructure; do not describe the user-requested live capabilities as complete.
