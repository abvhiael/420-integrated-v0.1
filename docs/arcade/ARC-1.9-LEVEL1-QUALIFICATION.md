# ARC-1.9 — Durable exact-SHA Level 1 qualification certificate

**Canonical step:** ARC-1.9 — Build shared session, score and achievement event interfaces  
**Disposition:** PASS — locally scoped client event contracts; no server-authoritative verification or game-playable claim.  
**Qualification:** Level 1

- **Qualified implementation SHA:** `eb6d4789e36555005439baccff8290c4ec09d1b0`
- **Reconciliation base SHA:** `495b6506243a494f6076c69fb9c752874e1e137a`
- **PR:** [#757](https://github.com/abvhiael/420-integrated-v0.1/pull/757)
- **Branch:** `audit/arcade-1-9-session-score-events`
- **Owning workflow:** `.github/workflows/arcade-1-9-level1.yml`
- **Completed run:** [39208432085](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39208432085)
- **Completed successful job:** `117916241459`

## Qualified implementation and evidence

- Version-pinned canonical game ID, content version and ruleset version; opaque session ID and seed provenance; startedAt and ordered event sequence.
- Shared input, score, achievement and terminal completion event schemas.
- Nonnegative safe-integer score arithmetic, duplicate achievement rejection, replay/out-of-order rejection, foreign session/game/ruleset scope refusal and bounded event payload/stream sizes.
- Local-only SHA-256 result digest plus explicit LOCAL_UNVERIFIED status; no client-authored verified scores, payout or economic claims.
- Local-display aggregate consistency checks with explicit `verified:false` result, never an authoritative remote verification decision.
- Scoped session security tests, retained local saves/Phaser/React/input/audio tests, frontend lint and typecheck, all frontend tests and production Vite build successfully executed.

## Reconciliation and limits

At qualification and immediately before this evidence commit the branch was zero commits behind current main and GitHub reported merge eligibility. This certificate is a **documentation-only evidence commit**, not the tested implementation SHA. Recheck actual eligibility after this commit.

**Level 2:** Not triggered for this ordinary step.  
**Level 3:** Not triggered; no global suites manually dispatched.  
**External/testnet:** Actual production verification, durable replay/nonces, authoritative ranking, game content and Gaming Protocol operator/Registry permissions remain separate approvals and later qualification owners. A client checksum is not authoritative proof.  
**Next:** consult actual canonical ARC roadmap before further implementation; do not invent a step.
