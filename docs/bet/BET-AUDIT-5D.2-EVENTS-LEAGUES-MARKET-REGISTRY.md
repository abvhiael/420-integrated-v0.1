# BET-AUDIT-5D.2 — Sports events, leagues and market registry

Date: 2026-10-26. Status: user-agreed competition scope with implemented noncustodial registries and reproducible local qualification. Passing status is bound exclusively to the clean-SHA execution certificate produced by the runner below. This document does not activate wagering or close TN-BOOK-00–05.

## Agreed initial competition catalog

| Sport | Competition | Registry key proposed |
| --- | --- | --- |
| Hockey | NHL | hockey.nhl |
| Hockey | PWHL | hockey.pwhl |
| American football | NFL | american-football.nfl |
| American football | NCAA football | american-football.ncaa |
| Baseball | MLB | baseball.mlb |
| Basketball | NBA | basketball.nba |
| Basketball | WNBA | basketball.wnba |
| Basketball | NCAA men's basketball | basketball.ncaa.men |
| Basketball | NCAA women's basketball | basketball.ncaa.women |
| Soccer | UEFA Champions League | soccer.uefa.champions-league |
| Soccer | UEFA Europa League | soccer.uefa.europa-league |
| Soccer | MLS | soccer.mls |
| Soccer | Concacaf Central American Cup | soccer.concacaf.central-american-cup |
| Soccer | Brazilian Série A | soccer.brazil.serie-a |
| Soccer | Copa Libertadores | soccer.conmebol.libertadores |

Keys are human-readable aliases, not deployed identifiers or provider IDs. The initial executable catalog narrows NCAA football to FBS and NCAA men's/women's basketball to Division I. Conference and postseason identities are committed through season/stage records. Additional divisions require a versioned catalog extension, never a family-level wildcard. This is the stated implementation default, not a claim that the user separately selected NCAA divisions.

Golf, cricket and rugby are deferred. UEFA Conference League and other unlisted competitions are outside the initial scope. Future sports may extend schemas through versioned changes; no golf-specific outright or dead-heat support is required now.

## Registry ownership

The three linked canonical contracts are `SportsCompetitionRegistry420`, `SportsEventRegistry420` and `SportsMarketRegistry420` under `contracts/src/bet/sports`. Each record has one canonical writer; source adapters propose inputs and cannot approve competitions, issue market permissions or move funds.

| Registry | Required fields |
| --- | --- |
| Competition | Internal ID, stable alias, sport, governing body, country/region, category, division, parent competition, season structure, approved template IDs, source-policy hash, authority epoch, status and approval digest. |
| Season/stage | Internal ID, parent competition, season label, date bounds, stage identity and bracket/group metadata where applicable. |
| Participant | Stable team ID, competition memberships, category and versioned provider mappings. Team display names are mutable metadata, never canonical identity. |
| Event | Internal ID, competition/season/stage, participant IDs and roles, original start, current start, schedule revision, venue/neutral-site indicator, provider mappings, source evidence and lifecycle status. |
| Market template | Sport/competition applicability, type, selections, line precision, eligible period, overtime/shootout coverage, score normalization, completion/cancellation/postponement policy, result-source policy, dispute/timeout policy and immutable version/hash. |
| Market | Internal ID/version, event ID, operator, approved template/version, selection IDs, line, rules/configuration digest, cutoff, quote epoch, asset/vault/risk bindings, authority epoch, lifecycle and approval receipts. |

Competition/season/stage metadata supports both leagues and cup tournaments. Cup fixtures bind stage and, when relevant, leg/tie identity. Aggregate tie scores must not be confused with the individual match score.

## Identity, ingestion and revisions

Internal identifiers must be domain-separated and independent of display name, provider ID and start time. Scope them to chain/deployment as appropriate; accepted tickets commit exact identifiers and versions.

Provider mappings bind provider namespace, sport, competition, season, external ID, canonical ID and mapping version. Conflicting or ambiguous mappings enter review and cannot open a market. Repeated ingestion is idempotent; different external IDs may map to the same canonical fixture only through an evidenced reconciliation. Duplicate detection uses competition, participants, scheduling and source context but must distinguish doubleheaders and repeat fixtures.

Preserve the original schedule and append every revision with prior revision hash, source timestamp, receipt timestamp, evidence digest and authority. A postponement does not change event identity or automatically extend the acceptance cutoff. Earlier starts close acceptance conservatively. Replacement fixtures use new IDs. Participant, competition or semantic changes affecting funded tickets require suspension and the frozen recovery policy; no silent remapping.

Source rights, actual feed coverage and reliability must be verified separately for every competition and market type. Existing fantasy access does not prove entitlement to sportsbook odds. No competition is labelled data-qualified solely because it is on this list.

## Market identity and supported templates

Retain 5D.1's pre-match single-ticket scope: moneyline, whole/half-unit spreads and whole/half-unit match totals where an approved competition-specific template supports them. Listing a competition does not enable every type.

Soccer's initial match markets cover regulation plus stoppage time only. They exclude extra time and penalties. Three-way home/draw/away, supported handicaps and totals must state that coverage explicitly. 'To qualify', tournament winners and aggregate-tie propositions remain deferred.

NHL and PWHL have separately versioned overtime/shootout and completion rules. NBA, WNBA and NCAA men's/women's basketball have separate templates. NCAA football cannot inherit NFL rules. MLB templates must commit extra-inning, shortened/suspended-game and pitcher/action treatment before approval. No unofficial assumptions fill missing rules.

Different line, period, participant mapping, overtime policy or material settlement rule means a new market identity/version. Odds changes use fresh quotes under the same immutable market terms. Reject duplicate active markets with identical event/operator/template/version/line/selection semantics unless a deliberate distinct product identity is approved. Separate operators may offer the same proposition with independent risk backing.

## Authority and lifecycle

Competition: REGISTERED → APPROVED, with prospective SUSPENDED/RETIRED states. Event: SCHEDULED → STARTED → COMPLETED, with explicit POSTPONED, CANCELLED and ABANDONED transitions governed by sport-specific policy. Market: DRAFT → APPROVED → OPEN ↔ SUSPENDED → CLOSED. Encode allowed transitions explicitly, including recovery from postponement; enum ordering grants no authority.

Event completion does not finalize market results. Market closure is irreversible. League suspension or retirement stops new risk across its descendants while preserving accepted obligations and permitted payout/refund paths. Event cancellation proposes no-action facts; it does not grant the registrar arbitrary refund or payout authority.

Separate registrar, independent template/competition approver, lifecycle controller, quote signer, oracle reporter, dispute resolver and settlement executor. Use canonical market-scoped authorization and explicitly defined competition/event scopes. Grants require bounded subjects, actions, expiry and authority epochs. Ingestion and client processes never receive wildcard market authority.

Opening requires approved competition, season/stage and template; validated participants/source mapping; active operator and permissions; approved asset/vault/risk bindings; healthy source; a future cutoff/start; and no applicable emergency halt. Recheck these at ticket acceptance. Revocation and suspension invalidate new acceptance, not historical ticket terms.

## Qualification matrix and completion evidence

Maintain status per competition × template × rules version × source binding: IN_SCOPE, SPECIFIED, IMPLEMENTED, LOCALLY_QUALIFIED and LIVE_ACCEPTED, each with evidence references. The machine-readable catalog is `SPORTS-5D.2-CATALOG.json`. All 15 entries have dedicated native lifecycle tests with moneyline/spread/total scenarios. Passing the exact-SHA runner establishes local registry qualification only. A passing NHL suite cannot qualify PWHL; registry tests do not certify sport settlement mathematics or licensed live feeds.

Required executable registry evidence:

1. Authorized registration, independent approval, opening, suspension and closure; unauthorized and cross-scope mutation rejection.
2. Provider identity reconciliation, duplicate ingestion, conflicting mappings, doubleheaders/repeat fixtures and cross-competition isolation.
3. UTC schedule handling, earlier starts, postponement, venue changes, replacement fixtures and append-only revision integrity.
4. Immutable funded market terms; odds changes without semantic mutation; rejection of unsupported types, precision and period combinations.
5. Competition suspension propagation, authority revocation/epoch changes and preserved funded obligations.
6. Stale/missing/conflicting source data, incomplete metadata, unavailable entitlement and adapter restart/replay behavior.
7. Event/result separation, cancelled/abandoned fixtures, closed-market non-reopening and reorg-safe canonical projection.

For each run retain exact source SHA, build/config hashes, competition/template versions, source fixture provenance, positive/negative cases and independent replay result. Synthetic fixtures prove local behavior only. Official source rights, deployment, real authority, funded execution and independent release acceptance remain under TN-BOOK-01–05.

## Remaining decisions before market opening

- Additional NCAA divisions beyond the initial FBS/Division I configuration, if later requested.
- Competition-specific rule manifests, parameter values and approved market-type combinations.
- Entitled source/feed identifiers and permitted evidence retention.
- Actual operator, approver, reporter, resolver and custody identities.

These do not reopen the agreed 15-entry catalog. They are configuration and qualification work required to turn its entries into open markets.

## Implemented boundaries and local execution

Competition configurations are immutable and bind catalog ordinal, provider/feed namespace, source policy, source freshness and manifest digest. A different registrar and approver are required; active approval capabilities are checked on each readiness query. These are address-level separation checks, not proof of independent beneficial control.

The event registry owns immutable season/stage and participant membership, typed provider aliases, event identities, original definitions, source observations and append-only schedule revisions. Participant sport and men's/women's category cannot be silently reused across incompatible competitions. Aliases are idempotent for identical canonical target/evidence and reject conflicting reassignment. A source-ready fixture requires competition, season, both participants and event mappings. Source timestamps must be monotonic, nonfuture, fresh and no older than the latest schedule/status invalidation. Unknown fixture times, unresolved identity conflicts and absent mappings fail closed.

Market templates commit exact rule and policy digests, coverage, kind and bounded challenge/refund windows. Templates and market terms require separate approval; the market registrar and registered operator account cannot approve their own market. Soccer accepts only regulation coverage and three-way moneyline semantics. Hockey regulation three-way is separate from overtime-inclusive two-way. Unsupported enum values and quarter-line representation are rejected. Scaled integer lines express whole and half units only.

The active-proposition index prevents duplicate event/operator/type/coverage/line propositions disguised by new source/risk/rule hashes. After closure, a newly approved version may replace the proposition prospectively; the old record remains immutable and terminal. Each market has deterministic selection IDs: home/away/draw for three-way, home/away for two-way/spread, over/under for totals.

Opening/resuming snapshots competition epoch, event invalidation epoch and schedule revision. Revisions, explicit source outages and competition suspension invalidate readiness until explicit market suspension/resumption. Ordinary fresh healthy observations renew freshness without changing accepted terms. Cutoffs never extend. Emergency and operator/approval/source-capability revocations fail closed for new risk. Historical reads and closing remain available during halts. Markets do not settle when an event completes.

`OPEN` and `eligible()` describe registry configuration readiness only. This increment has no payable method, stake custody, quote acceptance, ticket creation, result finalization or payout entry point. Market approval pins the declared game/risk/vault/asset identifiers; future acceptance must validate actual canonical bindings, licensed data, player eligibility, signed quote and capital. A contract asset address and policy digest alone do not prove approved canonical $420 or production readiness. Every future quote must bind market ID/terms, quote epoch, event revision and applicable authority state, and recheck readiness atomically at acceptance.

Run from repository root:

```text
python scripts/bet/qualify-sports-5d2.py --output artifacts/sports-5d2
```

Requires Foundry 1.8.6, solc 0.8.30 and slither-analyzer 0.11.6. `--forge`, `--solc` and `--analyzer-solc` accept explicit local tool paths. The runner requires committed clean scoped sources, checks the base ancestor and allowed diff, executes native integration with real CapabilityRegistry/BetAuthorization/OperatorRegistry/EmergencyState dependencies, runs five fuzz properties at 2,500 cases each, verifies the 15-competition inventory, replays nine emitted EVM checkpoints independently, rejects altered/missing/duplicated replay evidence, enforces deployable bytecode sizes/no custody surface, and rejects any High/Medium static finding. The source closure, artifact/log hashes and exact SHA are retained in `qualification.json`.

Native rollback tests exercise orphaned-state recovery; they are local EVM snapshots, not official-network reorg receipts. All source inputs and authorities in tests are synthetic fixtures. Static timestamp findings reflect intended pre-match/freshness/deadline guards; block time is not proof of true event start. Source timing and actual source control remain live acceptance requirements. No self-issued legal, economic, independence or production approval is asserted.

CI workflow: `.github/workflows/420bet-sports-5d2-level2.yml`. Local Level 1 covers registry validations/authority; scoped integration Level 2 covers the linked real contracts, adversarial lifecycle, native replay and inherited boundaries. This is not phase-wide Level 3 or funded sportsbook qualification.

## References

- Companion: BET-AUDIT-5D.1-SPORTSBOOK-ARCHITECTURE.md, with the present user-approved catalog superseding its unresolved sport selection.
- [420Bet release and implementation gates](https://github.com/abvhiael/420-integrated-v0.1/blob/0cada7a3dff1792c624f8bbc124216cf32efb4bb/docs/420BET-TESTNET-WORK-ROADMAP.md).
- [Brazilian Série A — CBF](https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/serie-a/2026).
- [Copa Libertadores — CONMEBOL](https://gol.conmebol.com/libertadores/es/teams).
- [Central American Cup — Concacaf](https://www.concacaf.com/competitions/central-american-cup/news/2026-central-american-cup-participating-clubs-and-draw-pots-confirmed).
