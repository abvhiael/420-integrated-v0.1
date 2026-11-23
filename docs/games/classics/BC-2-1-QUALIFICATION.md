# BC-2.1 — Russian Cribbage rules and variants: qualification record

**Scope:** Versioned player-approved rules and deterministic testable reference functions only. **Not a release qualification for an online match or bot engine.**

**Authoritative rules ID:** `bc-russian-cribbage-241@1.0.0`  
**Rules manifest:** `BC-2-1-RUSSIAN-CRIBBAGE-VARIANTS.json`  
**Written rules:** `BC-2-1-RUSSIAN-CRIBBAGE-RULES.md`  
**Reference implementation:** `bong-goggles/web/core/russian-cribbage-rules.js`  
**Dedicated tests:** `bong-goggles/web/test/russian-cribbage-rules.test.js`  
**CI:** `.github/workflows/bc-2-1-russian-cribbage-rules.yml` (runs Node 22, rule unit tests, BC-1.1 standard-rule isolation, syntax and static-security checks).

## Locked player decisions

- Target 241. Six retained cards and six crib cards; seven-card show with one shared starter.
- Two players: deal 9, discard 3 per seat. Three: deal 8, discard 2. Four: deal 7, discard 1 plus 2 cards dealt directly to crib.
- Four players: opposite-seat partnerships sharing team scores by default; separate free-for-all variant with four individual scores.
- Approved flushes: six matching in an ordinary hand score six (seven with starter), crib score seven only if six crib cards and starter all match.
- Conventional pegging to 31, show combinations, nobs and dealer heels; instant win on first award reaching 241; automated scoring (no manual muggins).
- Skunk result labels at 180 or less, double-skunk at 120 or less, no additional peg points.

## Automated acceptance coverage

- Dedicated IDs, game isolation, default four-player partnerships and manifest integrity.
- 52-card unique deal for all four variants and every dealer seat, 6-card retention, exact 6-card crib and starter position after discards.
- Fail-closed invalid dealer, deck, seat count, variant, discard card, wrong discard count, duplicate cards and starter.
- All 7-card fifteen subsets, pairs, longest-run multiplicity, 30-point seven-card example.
- Approved 6/7 hand flush, 7-only crib flush and exclusion of 5-card pseudo-flush.
- Pegging 15, 31, pair/triple/quadruple, consecutive run and invalid count.
- Instant terminal 241 score, two-team shared scores, four separate scores and loss classifications.
- Written-policy checks and preservation of BC-1.1 121-point rules.

## Safety boundary and remaining BC-2 delivery gates

The existing production Cribbage engine is `cribbage` with four-card hands and 121 points. This BC-2.1 work **does not replace it**, register a public 241-point engine, enable additional Russian room sizes on the live server, or expose playable 241-point controls. For BC-2.2 and later: implement server-authoritative Go adapter and immutable four-player variant selection stored on the room/session; adapt live UI/board for 241 points; integrate bot policy, room selection, reconnect, results and anti-cheat; test migration and replay, and qualify production deployment before enabling Play. BC-1.8 release remains independently governed.

**Verification status:** PR branch contains the source and dedicated CI; only an observed successful exact-head run may be recorded as PASS. A code review or a successful unit test does not qualify the full playable game.
