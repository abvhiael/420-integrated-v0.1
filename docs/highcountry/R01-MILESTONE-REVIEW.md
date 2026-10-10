# High Country — R01.7 accumulated specification milestone review

Qualification level: Level 2. Scope: R01.1–R01.6 definitions plus retained HC/Gaming foundations. Exact implementation SHA, commands, results and log hashes are recorded in `qualification/R01.7-level2.json`. This review is not full-game, testnet, Genesis or production acceptance.

## Canonical definition and exit review

R01.7 reviews accumulated documents against contracts, interfaces, tests and the audit matrix; requires no unexplained contradictions or unmapped requirements and durable exact-commit Level 2 evidence. The roadmap now explicitly records that existing milestone without renumbering any step.

| Exit criterion | Review / retained evidence |
|---|---|
| Canonical release definition preserved | Full social economy release, guest core play, account-only shared state, optional wallet/perks; all 65 launch requirements retained |
| Architecture agrees with actual components | R01.2 lists present foundations and missing frontend, durable services, HC transport, indexer and deployment package; canonical registries retain authority |
| Interfaces/encodings agree | Source-derived 19 enum catalogues, 53 ABI value types, 42 capability actions; frozen ordinals and exact migration domains preserved; build and shared Gaming regressions retained |
| Contradictions explained | Reconciliation register below, with enforcement work explicitly assigned rather than disguised as completed implementation |
| Gameplay decisions resolved | Owner adopted the five R01.6 rules; no inherited opaque genetic locus is given a fabricated trait decoder |
| Unmapped requirements absent | One-to-one audit/scope assignment verified for HC-AUD-001..065; per-requirement mapping below |
| Security/integration limits preserved | HC-SEC-06..17 remain unresolved implementation findings, not accepted risks; runtime unresolved and no live readiness |
| Exact-head milestone evidence | Run source/spec verifier and retained foundation runner on clean committed candidate; evidence-only record references that candidate |

## Reconciliation register

1. Earlier type/trust/architecture prose left BUDS units, market rules and R01 steps open after adoption. Corrected to cite the adopted R01.6 baseline; detailed numerical catalogues stay required module deliverables.
2. R01.7 was referred to but omitted from the roadmap table. Added the original milestone definition and exit criteria, preserving R01.1..6 and R02 onward.
3. Full release scope previously implied every later content/reward parameter would be supplied by R01.6. Clarified the accepted baseline versus detailed R04 catalogues: recipes/durability, progression/research/mission values, prices/rewards, rights/lease terms, governance parameters, seasons/Cup/brackets and optional perk IDs must be versioned and tested before each module acceptance. No feature is removed or deferred past release.
4. READY is not HARVESTED and TERMINATED is not proof of products. HC-7 needs a unique authoritative receipt; enum encodings remain unchanged. R02/R03 enforce admission, consumption, finalization and capacity release.
5. Existing expression may seal before READY and accept unvalidated rulesets; adopted harvest requires a READY checkpoint. This is a deliberate versioned new consumer rule, not a claim about present code. R02.7 must enforce it and preserve/reject incompatible history.
6. Frozen ListingState contains PARTIALLY_FILLED, but ordinary V1 market deliberately uses only full fill. Preserve enum compatibility; the unused state is not an implemented partial-fill feature. R04.8 enforces the selected transition subset.
7. Opaque genomes contain no statistical trait interpretation. Equal founder output and lineage-only V1 avoid fabricated biology; differentiated genetics require a separately approved version. Optional genetics/equipment content cannot violate protected-stat parity.
8. Existing canonical MARKETPLACE gate coexists with wallet-free ordinary service trading; neither transfers balances/ownership in the other domain. BUDS are integer internal currency, not native $420 or ERC20.
9. Object-manifest migration and shared save claims have distinct identities, caller rules and replay domains. Neither receipt proves a durable DB transaction; R02/R05 must supply trusted issuance, uniqueness, outbox and recovery.
10. Four contract access states have three client labels. Projection is display-only; wallet connection alone does not promote state or establish entitlement. R05/R06 integrate real account/chain proofs.
11. Emergency flags, module lifecycle metadata and view-only budget checks do not enforce pause, upgrades or cumulative spend. R02/R04/R07 must implement the selected controls. Policies are no substitute for those tests.
12. Null shared runtime addresses are not deployed records. No HC reserved address is invented. R07/R09 supply actual manifests/code/roles/finality; existing config paths remain the authority.

## Remaining decisions and prerequisites

No open decision prevents the selected R01 baseline from being implemented. Later module content/financial values, exact HC-7 ABI/action/event encodings, production randomness adapter parameters, actual deployment principals/roots/founder data and runtime configuration remain explicitly required before their respective module/deployment acceptance. Their existence is not inferred from this milestone. Resolve any contradictory canonical source before implementation, preserving the smallest supported change and reviewed versioning.

Security findings HC-SEC-06..10 and HC-SEC-14..17 belong to R02; HC-SEC-11..13 belong to R05. Existing test suites verify only their actual assertions and do not test absent HC-7/economy/frontend/durable infrastructure. Static lint findings must remain visible in qualification; no independent security certification is claimed.

## Per-requirement specification / delivery mapping

Canonical source and implementation/tests/status remain each matching row in `REPOSITORY-AUDIT-20261009.md`; `RELEASE-SCOPE.md` supplies each release assignment. The table below records specification coverage and retained implementation owner, not 65 implemented/tested features.

| Requirement | Specification review | Retained delivery owner |
|---|---|---|
| HC-AUD-001 Canonical complete release scope | RELEASE-SCOPE / ARCHITECTURE-AND-AUTHORITY | R01.1–R01.7 |
| HC-AUD-002 Domain-separated types/actions/modules | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-1; R02 / R07 |
| HC-AUD-003 Capability authorization | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-1; R02 / R07 |
| HC-AUD-004 Complete six Genesis roots | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-1; R02 / R07 |
| HC-AUD-005 Genesis finalization one-way | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-1; R02 / R07 |
| HC-AUD-006 Ruleset content identity | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-1; R02 / R07 |
| HC-AUD-007 Module lifecycle | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-1; R02 / R07 |
| HC-AUD-008 Emergency allowlist | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-1; R02 / R07 |
| HC-AUD-009 Emergency effective stop/recovery | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-1; R02 / R07 |
| HC-AUD-010 Three founding regions | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-2; R02 / R07 |
| HC-AUD-011 World readiness | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-2; R02 / R07 |
| HC-AUD-012 Persistent one-per-account grower | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-2; R02 / R07 |
| HC-AUD-013 Land identity/capacity | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-3; R02 |
| HC-AUD-014 Genesis parcel Merkle membership | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-3; R02 |
| HC-AUD-015 Occupancy state consistency | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-3; R02 |
| HC-AUD-016 Public capacity/allocation | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-3; R02 |
| HC-AUD-017 Public allocation cultivation | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-3; R02 |
| HC-AUD-018 Immutable 28-locus genomes | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-4; R02 / R07 |
| HC-AUD-019 Sixteen founding lines | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-4; R02 / R07 |
| HC-AUD-020 Seed provenance/quantity | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-4; R02 / R07 |
| HC-AUD-021 Clone-to-mother consistency | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-4; R02 / R07 |
| HC-AUD-022 Finite mother budget | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-4; R02 / R07 |
| HC-AUD-023 Permanent phenotype provenance | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-4; R02 / R07 |
| HC-AUD-024 Domain/requester/context single entropy use | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-5; R02 |
| HC-AUD-025 Fair/available randomness | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-5; R02 |
| HC-AUD-026 Immutable breeding provenance | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-5; R02 |
| HC-AUD-027 Pending breeding recovery | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-5; R02 |
| HC-AUD-028 Plant identity/forward stage/capacity | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-6; R02 |
| HC-AUD-029 Deterministic offline timed growth | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-6; R02 |
| HC-AUD-030 Six controls/bounds/rounding | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-6; R02 |
| HC-AUD-031 Sealed expression/no reroll | TYPES-AND-UNITS / DEPLOYMENT-AND-TRUST / GAMEPLAY-SPECIFICATION | HC-6; R02 |
| HC-AUD-032 Harvest/product grading | GAMEPLAY-SPECIFICATION / ARCHITECTURE-AND-AUTHORITY | HC-7; R03 |
| HC-AUD-033 Equipment/manufacturing/lifecycle | GAMEPLAY-SPECIFICATION / ARCHITECTURE-AND-AUTHORITY | R04.2–R04.4 |
| HC-AUD-034 BUDS and economic settlement | GAMEPLAY-SPECIFICATION / ARCHITECTURE-AND-AUTHORITY | R04.1 / R04.5 |
| HC-AUD-035 Skills/research/discovery/missions | GAMEPLAY-SPECIFICATION / ARCHITECTURE-AND-AUTHORITY | R04.6–R04.7 |
| HC-AUD-036 Marketplace/ownership/payment | GAMEPLAY-SPECIFICATION / ARCHITECTURE-AND-AUTHORITY | R04.8 |
| HC-AUD-037 Lease/license/rights | GAMEPLAY-SPECIFICATION / ARCHITECTURE-AND-AUTHORITY | R04.9 |
| HC-AUD-038 Organizations/cooperatives/governance | GAMEPLAY-SPECIFICATION / ARCHITECTURE-AND-AUTHORITY | R04.10–R04.11 |
| HC-AUD-039 Seasons/competition/Global 420 Cup | GAMEPLAY-SPECIFICATION / ARCHITECTURE-AND-AUTHORITY | R04.12–R04.13 |
| HC-AUD-040 Wallet-free core; no stat advantage | ARCHITECTURE-AND-AUTHORITY / MIGRATION-BOUNDARIES / TYPES-AND-UNITS | HC-PA / HC-GP; R02 / R05 / R06 |
| HC-AUD-041 Local/service/canonical split | ARCHITECTURE-AND-AUTHORITY / MIGRATION-BOUNDARIES / TYPES-AND-UNITS | HC-PA / HC-GP; R02 / R05 / R06 |
| HC-AUD-042 Guest/profile single binding | ARCHITECTURE-AND-AUTHORITY / MIGRATION-BOUNDARIES / TYPES-AND-UNITS | HC-PA / HC-GP; R02 / R05 / R06 |
| HC-AUD-043 Eligible object single consumption | ARCHITECTURE-AND-AUTHORITY / MIGRATION-BOUNDARIES / TYPES-AND-UNITS | HC-PA / HC-GP; R02 / R05 / R06 |
| HC-AUD-044 Routine zero-value exact sessions | ARCHITECTURE-AND-AUTHORITY / MIGRATION-BOUNDARIES / TYPES-AND-UNITS | HC-PA / HC-GP; R02 / R05 / R06 |
| HC-AUD-045 Sensitive wallet escalation | ARCHITECTURE-AND-AUTHORITY / MIGRATION-BOUNDARIES / TYPES-AND-UNITS | HC-PA / HC-GP; R02 / R05 / R06 |
| HC-AUD-046 Shared entitlement identity/content | ARCHITECTURE-AND-AUTHORITY / MIGRATION-BOUNDARIES / TYPES-AND-UNITS | HC-GP; R02 / R05 / R06 |
| HC-AUD-047 Shared game-profile binding | ARCHITECTURE-AND-AUTHORITY / MIGRATION-BOUNDARIES / TYPES-AND-UNITS | HC-GP; R02 / R05 / R06 |
| HC-AUD-048 Consumed migration claim binding | ARCHITECTURE-AND-AUTHORITY / MIGRATION-BOUNDARIES / TYPES-AND-UNITS | HC-GP; R02 / R05 / R06 |
| HC-AUD-049 Cross-instance save migration | ARCHITECTURE-AND-AUTHORITY / MIGRATION-BOUNDARIES / TYPES-AND-UNITS | HC-GP; R02 / R05 / R06 |
| HC-AUD-050 Bonus region optional access | ARCHITECTURE-AND-AUTHORITY / MIGRATION-BOUNDARIES / TYPES-AND-UNITS | HC-GP; R02 / R05 / R06 |
| HC-AUD-051 Optional event access | ARCHITECTURE-AND-AUTHORITY / MIGRATION-BOUNDARIES / TYPES-AND-UNITS | HC-GP; R02 / R05 / R06 |
| HC-AUD-052 Scoped cross-game subjects/revocation | ARCHITECTURE-AND-AUTHORITY / MIGRATION-BOUNDARIES / TYPES-AND-UNITS | HC-GP; R02 / R05 / R06 |
| HC-AUD-053 Registered/cloud save/account proof | ARCHITECTURE-AND-AUTHORITY / MIGRATION-BOUNDARIES / TYPES-AND-UNITS | Shared Gaming; R05 |
| HC-AUD-054 Query freshness/reorg/indexing | ARCHITECTURE-AND-AUTHORITY / MIGRATION-BOUNDARIES / TYPES-AND-UNITS | Shared Gaming; R05 |
| HC-AUD-055 Real browser workflows | ARCHITECTURE-AND-AUTHORITY / MIGRATION-BOUNDARIES / TYPES-AND-UNITS | R06 |
| HC-AUD-056 RPC/wallet/chain configuration | ARCHITECTURE-AND-AUTHORITY / MIGRATION-BOUNDARIES / TYPES-AND-UNITS | HC-GP; R05 / R06 / R07 |
| HC-AUD-057 Reproducible production builds | DEPLOYMENT-AND-TRUST / RELEASE-SCOPE / BUILD-AND-OPERATIONS | R08 |
| HC-AUD-058 Security/dependency qualification | DEPLOYMENT-AND-TRUST / RELEASE-SCOPE / BUILD-AND-OPERATIONS | R02 / R08 |
| HC-AUD-059 HC deploy/seed/grants/manifests | DEPLOYMENT-AND-TRUST / RELEASE-SCOPE / BUILD-AND-OPERATIONS | R07 |
| HC-AUD-060 Shared testnet runtime | DEPLOYMENT-AND-TRUST / RELEASE-SCOPE / BUILD-AND-OPERATIONS | Shared Gaming; R09 |
| HC-AUD-061 User/operator/developer docs | DEPLOYMENT-AND-TRUST / RELEASE-SCOPE / BUILD-AND-OPERATIONS | R01 / R08 / R10 |
| HC-AUD-062 Exact final-head evidence | DEPLOYMENT-AND-TRUST / RELEASE-SCOPE / BUILD-AND-OPERATIONS | R08 / R09 / R10 |
| HC-AUD-063 Production operations | DEPLOYMENT-AND-TRUST / RELEASE-SCOPE / BUILD-AND-OPERATIONS | R10 |
| HC-AUD-064 Upgrade/migration execution | DEPLOYMENT-AND-TRUST / RELEASE-SCOPE / BUILD-AND-OPERATIONS | HC-1 module lifecycle; R01.5 / R04.14 / R07 |
| HC-AUD-065 Custody/allowance/bridge/oracle prices | DEPLOYMENT-AND-TRUST / RELEASE-SCOPE / BUILD-AND-OPERATIONS | R01.5 / R04.5 / R04.8 / R08 |

## Qualification boundaries and CI

Execute `python scripts/highcountry/verify-r01.py`, then the existing exact-head foundation runner under the committed default Foundry profile. Includes every HC test root, immediate shared Gaming tests, access/SDK, shared hardening/cross-game/profile/query suites, build sizes, formatter, lint and runtime-template verification. Preserve actual results/log hashes; live runtime exit 2 is BLOCKED, not a test pass. Default-profile invariant settings are not advertised as CI/hardening settings.

The audit branch matches `-audit-` exclusions in `contracts-foundry.yml` and `docs-qualify.yml`; skipped broad jobs are not qualification evidence. Gaming path-trigger workflows do not cover these R01 document/verifier changes, and no dedicated R01 CI workflow exists. Required milestone checks run locally on the exact clean candidate and are committed as durable evidence. No unrelated/global CI is launched. Remote PR state is captured in the evidence; a classification-only job is not the retained suite.

Main was checked at this milestone; relevant HC, immediate Gaming/service/SDK and address-map paths are compared against the audit baseline. Full branch/main reconciliation and conflicts at merge are deferred to R08 Level 3; this is not a merge candidate and no merge is authorized by R01.7. Canonical Solidity owns the complete repository Foundry inventory there, while Genesis independently owns address/manifests without duplicating it.

Next canonical step: **R02.1 — Qualify five audit fixes and production CapabilityRegistry component/grant wiring**. R01 specification completion does not waive subsequent R02 security repairs, HC-7 implementation, full social economy buildout or live acceptance.
