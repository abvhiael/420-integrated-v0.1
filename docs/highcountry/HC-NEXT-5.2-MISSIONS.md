# HC-NEXT-5.2 — Missions

**Scope:** Registered High Country ordinary gameplay missions; not an upgrade to the existing R04 chain MissionEngine and not a canonical achievement or transferable asset issuer.

## Authority and versioning
- Catalog `HC-MISSIONS-V1`: three ordered initial mission definitions, version-pinned objective, deadline, target, per-proof cap, prerequisites and bounded nontransferable reward.
- Registered authenticated account and live session epoch are validated again inside the serialized PostgreSQL transaction.
- Separate Ed25519 `HC.MISSION.EVIDENCE.V1` signatures bind issuer, principal, game/chain domain, mission, catalog version, objective, amount, unique sourceEvent and bounded expiry.
- One globally consumed gameplay source event per namespace; no browser-authoritative progress, evidence replay or cross-mission reuse.
- One-shot activation; `available → active → complete → claimed`, `active → cancelled`, or `active/complete → expired`. All transitions and rewards are atomic and uniquely operation-keyed.
- Only journal badges, archive notes, cosmetic tokens and ordinary mission XP are eligible catalogue reward classes. No BUDS issuance, chain mint, inventory transfer, marketplace credit, harvest/yield/potency mutation or competition advantage.
- The durable state shares the existing restricted Postgres namespace, avoiding a new unprotected store.

## Operator activation
`config.missions` must explicitly include `catalogVersion: "HC-MISSIONS-V1"`, `evidencePublicKey`, and `evidenceIssuer`. The signing private key MUST reside in the trusted independent gameplay evidence producer, not the public web app or this runtime. Existing network gameId and chainId are required and verified. If the mission authority is not configured, all mission endpoints fail closed.

## API
All are POST with a registered Bearer session. `/missions/snapshot` accepts `{}`. `/missions/activate`, `/missions/claim`, `/missions/cancel` and `/missions/expire` take `{operation,id}`; `/missions/progress` takes `{operation,id,evidence,amount}`. The new `/missions` client is strictly a view and intent submitter.

## Qualification
- Level 1: `cd services/highcountry-economy && node --test test/missions.test.js`
- Level 2 affected economy regression: `cd services/highcountry-economy && npm test`
- Scoped GitHub Actions: `.github/workflows/highcountry-missions.yml`.
- Level 3 phase closeout is **not** authorized by HC-NEXT-5.2 alone.
- **Not qualified until actual Actions results and required live PostgreSQL evidence are reviewed.** No historical unrelated CI reruns are required solely because of this work.

## Exclusions and follow-up
- Production independently issued gameplay receipts and operator keys are deployment prerequisites; tests use fixtures only.
- Real PostgreSQL restart and concurrent claim closeout, browser integration, and emergency-state policy review must be evidenced before an unqualified merge.
- On-chain R04 canonical missions retain their existing independent authorization and rewards policy.
