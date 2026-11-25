# BC-4.2-R9 — Permanent qualification evidence

## Immutable qualified source

- PR: #1424
- Tested HEAD: de486281c3fa8c35c348dc9e8c1e8583bc27c308
- Base: 66cb858f9ed3f4b190d4e3d6b9fb1fa5e5e8b0e4
- Word Salad qualification: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45716122709 — success
- Documentation qualification: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45716122623 — success
- Logs inspected: 2026-11-25; exact source checkout verified, PostgreSQL 16, Go race-enabled tests, vet and service build successful.

## Actual dictionary evidence

| Corpus | Lines | Computed SHA-256 |
| --- | ---: | --- |
| English | 172823 | 77a8b7729436793e0094b68243ffb3ff0825332ceec5f427880138971d6135c4 |
| Cannabis | 23934 | dc75d44b8e612e2900d6d7c55c1f2c6c6c139e8ff610875fad1b1c0984c2a0a1 |

Both computed digests match the pinned production loader identities. The catalogue and tile Node regression reported 12 tests, 12 pass, 0 fail.

## Actual Go test results

All 20 named tests passed:
- TestBC42WordSaladDurableSession
- TestBC42WordSaladTimeoutAndNormalFinish
- TestBC42WordSaladPersistedMoves
- TestBC42WordSaladMultiplayerResignation
- TestBC42WordSaladBagExhaustion
- TestBC42WordSaladMigration012 (fresh and legacy both passed)
- TestWordSaladConfigurationMatrix (135 configurations)
- TestWordSaladPlacementGeometryAndScoring
- TestWordSaladExchangeConservationAndStreak
- TestWordSaladPartialDrawAndScorelessReset
- TestWordSaladTiedResultAndForfeit
- TestBC42WordSaladConcurrentIntegrity
- TestBC42WordSaladJournalRollbackAndCorruption
- TestBC42WordSaladTimeoutRaces (all four subtests)
- TestWordSaladProfilesAndReplay
- TestWordSaladSubmittedPlacement
- TestWordSaladProductionDictionaryIntegrity
- TestWordSaladDictionaryIdentity
- TestWordSaladDictionaryModes
- TestWordSaladRuntimeActivation (all six dependency subtests)

Migration qualification included repeat migration with active untimed sessions, legacy record preservation and post-migration replay/actions. Runtime activation included disabled/omitted mode, restricted registration, unsupported modes, dependency rejection, injected dictionary-loader failure and preservation of existing adapters. Public Play remains gated; no live deployment is claimed.

## Regression provenance and dispositions

R7 HEAD 7c8c9f172124940e962091a27a97b7b7e5f6023e passed all ten reported Actions workflows, including run 45708123023. R1–R7 merge provenance and R8 dispositions are recorded in PRs #1414, #1418, #1419, #1420, #1422 and the companion R8 reconciliation document.

Owner-authorized deferrals: historical Chess recovery timeout (causal attribution unconfirmed), public website HTTP 502 (run 45685948509). On the tested R9 HEAD, external Workers checks failed for DoobTube, Reefer Review, 420Wallet, 420Status and 420Explorer; 420Pay passed. Causes unverified; these are not claimed to be HTTP 502 failures or independently accepted exemptions. No application source for those services was changed by this PR.

Known coverage limitations: persisted PostgreSQL shared-tie recovery and reproduction of the original idempotent response after later revisions were not independently established. No claim of qualification beyond observed coverage.

Branch protection configuration retrieval returned HTTP 403; mergeability is not proof of required checks. This archival commit adds documentation only; the tested source identity above is retained, not replaced by the archival commit. Final merge identity is recorded by GitHub PR #1424 (the merge commit cannot be embedded in its own tree without changing its identity).
