# HC-SEED-01 — Canonical catalog reconciliation

## Scope and authority

Identity metadata only. The structured catalog is `deployments/highcountry/seed-catalog.v1.json`; the existing Original Sixteen archive remains authoritative for the sixteen founding identities. Baseline main: `ae7888e1df93be95498531ef787f2adc591f92bf`. No contract, authorization, issuance, genome, payment or protected-fairness behavior changes in this step.

65 identities: 16 exclusive, 23 common, 26 rare. Common region counts are Emerald Coast 8, Golden Prairie 8, Red Mesa 7. Earlier conversation totals of 8/7/8 were a counting error, not a regional policy. Girl Scout Cookies remains Golden Prairie. Northern Lights Region is not admitted; Northern Lights the cultivar is common in Golden Prairie.

Explicit owner assignments: Acapulco Gold -> Red Mesa; Alaskan Thunder Fuck -> Emerald Coast; Pineapple Express -> Emerald Coast; White Widow -> Red Mesa; Super Silver Haze -> Emerald Coast; Blueberry -> Golden Prairie. The catalog enumerates all remaining assignments.

## Identity and aliases

HC-F01..HC-F16 retain their existing names, IDs, indices and regional homes. New common IDs use HC-C- plus a stable name slug; rare IDs use HC-R-. These are catalog identifiers, not on-chain genome IDs or founding line IDs. Freeze IDs after publication; future display-name edits must preserve IDs through an explicit catalog migration.

Aliases are explicit globally unique lookup labels after Unicode NFKC normalization, case folding and whitespace collapse. None are invented in this step. Unknown labels return no result. Source-panel mappings are not global aliases.

On concept panels only, Emerald Ghost becomes Spirit Bear; Harvest Moon becomes Blue Moon; Crimson Ghost becomes Crow Mother. The original names still resolve exclusively to HC-F01, HC-F09 and HC-F16. Incorrect printed HC-F numbers on concept sheets are recorded as rejected source labels, never reused as new cultivar identities. Northern Lights on the second seal concept maps to the single common cultivar.

## Source artwork reconciliation

Four source records preserve exact upload filenames, SHA-256 digests and Library file IDs. Every nonfounder has one or more source panel references (one-based row, column and panel), original printed name and region, and contextual rename markers where applicable. Botanical sheets have 20 and 16 panels; seal concept sheets have 16 each: all 68 panels are accounted for exactly once. Seal-concept-a includes a non-cultivar region illustration column; its column coordinates count only the cultivar panels. Reference artwork is not approved production art. Binary sources remain in their existing durable records; no large art copies are introduced here.

The botanical sheets contain no verified pedigrees. Common historical origin is separate from fictional regional distribution. Genome status is explicitly not-registered for all new entries. Catalog presence cannot authorize seed issuance or a purchase.

## Qualification

Level 1: `node scripts/highcountry/seed-catalog.mjs` and `node --test scripts/highcountry/seed-catalog.test.mjs`. Coverage includes exact founder reconciliation, owner regional pools, all source panels, unique IDs and normalized lookups, contextual renames, reserved namespace rejection, missing/duplicate panel rejection and false registration claims. Dedicated path-scoped workflow: `.github/workflows/highcountry-seed-catalog.yml`. No Solidity or unrelated global rerun is needed for this metadata-only change. A CI result must be recorded against the resulting implementation SHA before calling remote qualification complete.

## Roadmap (historical plan; implementation closeout is HC-SEED-10)

1. HC-SEED-01: identity catalog and source-art reconciliation (this change).
2. HC-SEED-02: verify Leafly coverage, then source common histories and attributed ancestry; preserve unknowns.
3. HC-SEED-03: inspect actual genetics semantics and map versioned common reference specimens to canonical engine rules.
4. HC-SEED-04: derive the approved rare parent pairs through canonical breeding; register genomes and breeding provenance through authorized lifecycle gates. Do not treat metadata as proof of registration.
5. HC-SEED-05: player Seed Catalogue, region/rarity filters, lineage, discovery and authenticated harvest cards.
6. HC-SEED-06: discuss and produce approved cultivar, card, seed and packaging art.
7. HC-SEED-07: finalize pack quantity, prices and supply; implement authorized pack/seed issuance and two distinct common-only regional starter packs.
8. HC-SEED-08: verifiable one-roll-per-pack 60% common / 30% rare / 10% Original Sixteen outcomes; uniform eligible cultivar selection within tier; regional and Shared World pools; replay and recovery protection.
9. HC-SEED-09: BUDS and native $420 purchase settlement, identical odds for equivalent packs, authoritative ownership and purchase history.
10. HC-SEED-10: bounded integration/adversarial closeout and eventual merge to main. Level 1 per step, Level 2 at milestones, one final Level 3; retain unaffected evidence.

Rarity is scarcity, not automatic statistical superiority. Descendants of Original Sixteen parents do not inherit founder identity. No museum expansion is required. HC-SEED-01–07 merged through PR #838, HC-SEED-08 through #854 and HC-SEED-09 through #858. Final implementation/art/source reconciliation and retained qualification evidence are recorded by HC-SEED-10. Historical identity-only/genome planning statuses are preserved; they never attest live registration. See `HC-SEED-10-QUALIFICATION-CLOSEOUT.md` and the versioned release/evidence ledgers.
