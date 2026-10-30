# HC-NEXT-7.5-A — Competition integrity and correction authority

**Scope:** authority, decision windows, immutable-result compatibility and implementation boundaries for HC-NEXT-7.5. This is a policy/specification record, **not** HC-NEXT-7.5 implementation or qualification. The original 7.5 exit criterion remains an actual player completing a season and tournament with authoritative reproducible outcomes.

## Existing canonical authorities (retain unchanged)

| Concern | Authoritative component and operation | Boundary |
|---|---|---|
| Season identity, schedule, cancellation | `SeasonRegistry.create/cancel` (on-chain); organizer-owned season rows in ordinary exhibitions | A season may be cancelled only before it begins; neither client nor trophy projection can edit a season |
| Immutable competition policy | `CompetitionTemplateRegistry` category/version/rules hash; ordinary PostgreSQL category version and rules hash | Never reinterpret a historical event under a new policy revision |
| Entrants, submissions, verified score | `CompetitionEngine.enter/submit`; ordinary exhibitions with registered issuer identity, canonical FLOWER verifier and serializable PostgreSQL | An address-based entrant is distinct from an account-only player; an unverified wallet/account link never bridges the two |
| Evidence finality/revocation | `CanonicalCompetitionEvidence` and independently qualified FLOWER/entitlement verifier; ordinary issuer-bound verifier | Adjudicator may revoke verified on-chain product evidence, not fabricate or mutate the underlying harvest |
| Pre-final decision | Fixed `CompetitionEngine.adjudicator` via `reject`; ordinary active PostgreSQL adjudicator via `reject` | No organizer/browser/HTTP caller can appoint itself judge or edit submitted quality |
| Original result | `CompetitionEngine.finalize`, `Global420Cup.finalize`; ordinary exhibition one-time serializable finalization | Finalized winner, score, Cup result commitment and historical evidence remain immutable |
| Current Cup prestige | `Global420Cup.issueCrossGame/isIssued/resultsCurrent` | Nonfinancial and scope-bound; historical issuance cannot be treated as current after invalidation |
| Durable observation | Cup projection and `highcountry_cup.achievements/history`; authenticated HTTP | Database projection is never independent championship authority |

## Decision windows and outcome states

1. **Registration and submission:** only in the published opening/closing interval. An entrant may register once; one verified FLOWER submission per entrant, and one use of a harvest ID **within the same event**. Cross-event reuse is not prohibited by R04.12 and must not be silently changed; tournament eligibility must be governed by its existing published rules.
2. **Challenge:** from submission until the event's existing `challengeDeadline`, exclusive, and no later than seven days after closing. Only the preconfigured independent adjudicator (or ordinary exhibition's active durable adjudicator) can reject a submitted result. A rejection is final for that submission; no existing replacement-submission or appeal privilege is implied.
3. **Initial finalization:** at/after the challenge deadline, once only. Candidates are independently reverified; highest `qualityBps` wins, then earliest harvest finalization, then smallest numeric harvest ID on-chain (ordinary exhibitions use the documented lexical canonical ID order). Zero valid candidates produce no winner. A failed verification is excluded, never rewritten into a different score.
4. **Post-final invalidation:** an independently revoked product, entitlement, canonical block or account eligibility can make a historical winner or prestige **not current**. It does not reopen the event or authorize a second `finalize`. A previously immutable Cup commitment stays recorded as historical fact; downstream projections must refuse current prestige based on stale qualifications.
5. **Correction requests:** before deadline, route to the existing judge's `reject` and original finalization. After finalization, preserve the original result and record a separately evidenced invalidation/dispute status; do not describe this as a corrected on-chain winner. A genuinely new championship outcome would require a distinct, explicitly published, canonically authorized competition/Cup instance with fresh IDs and policy, never an override of the old Cup or automatic transfer of its recognition.
6. **Appeal/review:** no independent appeal actor, second decision window, or override of a finalized result is authorized in current R04.12/R04.13 interfaces. HC-NEXT-7.5-D may implement an auditable *review of current recognition and evidence status* with bounded decisions, but cannot grant itself authority to rewrite an immutable result. Any broader appeal policy requires an explicit amendment by the existing canonical policy authority before implementation, not an inferred administrator privilege.

## Correction/recovery compatibility contract for 7.5-B through 7.5-F

- Preserve the existing contract ABI/storage, `Finalized`, `CupFinalized` and `CrossGameIssued` semantics and historical HC-NEXT-7.4 qualifying SHAs/run IDs. No mutator to winners, winnerScore, results, Cup champion or finalResultCommitment.
- All presentation of a **current** result must require independently verified canonical evidence and relevant eligibility, current bracket validity, pinned chain/address/code hash/scope, and canonical finality. Any uncertainty (reorg, RPC disagreement, verifier outage, unconfirmed evidence, stale link or scope) fails closed without erasing audit history.
- Store disputes, evidence references, adjudicator identity and disposition as append-only, game/event/subject-scoped durable observations. Record immutable original result reference and a stable idempotency key; use serializable transaction/unique constraints and single terminal disposition per review. An observation must never change chain results, grant on-chain recognition or supplant issuer identity.
- **Correction semantics:** valid pre-final rejection changes which original submitted candidates may qualify at the one authorized finalization. After finalization only current-validity status, revocation recognition and historical annotations may change; the original winner remains fixed. Do not advertise a replacement champion until a *new independently finalized canonical* event/Cup qualifies that player.
- Cup recognition is nontransferable/nonfinancial; `prizeRulesHash` is only a commitment. No BUDS/$420 settlement, alternate custody, minting or score bonus. Any future paid prize needs separate approved canonical settlement authority and a distinct scope.
- A snapshot or cached historical achievement is not permission to award; reads reverify source. A revoked champion suppresses current recognition, including already observed issuance. Duplicate issuance and replay must fail without duplicate history/award, including crash/retry.
- Keep ordinary issuer-account exhibitions wallet-free; do not use wallet CompetitionEngine outcomes to impersonate them or make the issuer a chain finality oracle. Account↔wallet association is valid only through the separately qualified link and chain finality authority.

## Acceptance matrix / ownership of later 7.5 packages

| Required scenario | Owner / existing path | Evidence to be added after 7.5-A |
|---|---|---|
| duplicate registration, submission, harvest, finalize | CompetitionEngine + ordinary PostgreSQL | 7.5-B negative and concurrent/crash-retry tests |
| forged identity, tampered source, timing, cancelled season, revoked evidence, malicious verifier | canonical evidence/entitlement and ordinary issuer | 7.5-C fail-closed tests with real affected components |
| challenge before deadline, unauthorized judge, late appeal, corrected recognition after revocation | fixed adjudicator / ordinary adjudicator; immutable finalized result | 7.5-D durable review, terminal status and historical audit evidence |
| repeated issuance, stale scope, replay, restart | Global420Cup and Cup achievements | 7.5-E scoped nonfinancial/DB tests |
| entire season, semifinal advance, final, standings, HTTP, PostgreSQL and recovery | canonical contracts + authenticated service | 7.5-F Anvil/PostgreSQL end-to-end and adversarial tests |

## Existing implementation / qualification boundaries

Inspect and reuse `contracts/src/highcountry/competition/{SeasonRegistry,CompetitionTemplateRegistry,CompetitionEngine,CanonicalCompetitionEvidence}.sol`, `contracts/src/highcountry/cup/Global420Cup.sol`, `services/420-gaming-player-profile/src/highcountry-{ordinary-exhibitions,ordinary-postgres,cup-achievements,cup-runtime,cup-rpc,global-cup,cloud-http}.js` and the existing scoped R04.12 / HC-NEXT-7.4 test harnesses. Only rerun a test whose owned behavior actually changes. No mandatory preflight certificate, new branch rules, unqualified Level 3 or global CI.

HC-NEXT-7.4 historical executable SHA `d179dda303af1e1cd0f79f7843716fc18326ef46`: Level 2 run `40945265767`, Level 1 run `40945266297`, Gaming Player Profile run `40945266303`; PR #899 merged at `70e8d6968033d8889bd77ef09c634627afda7c0f`. These are retained historical evidence, not 7.5 qualification.

**External/testnet-only boundary:** approved deployed chain/contract code-hash manifests, independent validator consensus and actual network reorgs, external issuer/entitlement credentials and wallet-link grants, operational secret/TLS/multi-instance acceptance. Track under `docs/highcountry/HIGHCOUNTRY-TESTNET-WORK-ROADMAP.md`. Locally testable EVM receipts, source checks, PostgreSQL durability and authenticated service behavior remain within 7.5-B..F.

**7.5-A exit:** authority and timing semantics are documented without changing existing immutable records or granting unauthorized correction powers. **Next:** HC-NEXT-7.5-B duplicate/replay protection. This document does **not** certify completion of HC-NEXT-7.5 overall.
