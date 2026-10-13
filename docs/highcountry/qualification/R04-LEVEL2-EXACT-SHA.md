# High Country R04 Level 2 — exact-SHA execution evidence

**Executed repository CI scope: PASS. Accumulated R04 integration milestone: NOT COMPLETE.**

## Exact candidate and ancestry

- Executable/CI candidate: `700d52f771fe15d5f58f88e7d92bc444e6bcee54`.
- Qualification branch: `qualification/highcountry-r04-level2-integration`; draft PR [#627](https://github.com/abvhiael/420-integrated-v0.1/pull/627), targeting `audit/highcountry-r04-14-upgrade-security`.
- R04.14 implementation: `3503761ef5746064abfd7c3c1ed3cf9a6f6fe2e5`; evidence/base: `7cbd375079a6187aa03bea8b79c8d131762456de`; development PR #626 open/draft.
- Main observed: `bc0faa5dafecda3de0620a9581f9953b89cd95fb`. Level 3 must refresh/reconcile main; no merge qualification claimed.
- All R04 PR heads #609/#610/#611/#612/#613/#615/#617/#618/#619/#622/#623/#624/#625/#626 were compared to this candidate and confirmed ancestors, zero behind. All remain draft/open/unmerged.
- Subsequent commits `ac30c4a2ec3a94e77f095e0a8c9f8533282f51bf`, `e3ebd13226562c9cfd956835e36a1930cb7d3653`, `773c4b655c622a7edffe1e859d6373b307d0eb0e` and this evidence commit change review/evidence/operational gate documentation only. They inherit the above executed implementation identity; no changed executable SHA is silently substituted.

## Terminal workflow/job evidence

[High Country R04 Level 2 App Integration run #38345072933](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38345072933), attempt 1, workflow ID 382785044, PR event, head SHA exactly `700d52f771fe15d5f58f88e7d92bc444e6bcee54`, terminal **SUCCESS**.

| Required job | ID | Terminal conclusion | Executed scope |
|---|---|---|---|
| retained-app | [115124467953](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38345072933/job/115124467953) | SUCCESS | Exact checkout assertion; High Country build/bytecode sizes; 293 tests across 62 suites, zero failures or skips; canonical High Country verifier |
| economy-service | [115124468026](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38345072933/job/115124468026) | SUCCESS | Exact checkout assertion; all 26 retained BUDS/market/runtime denial, replay, rollback, receipt and persistence tests, zero failures |
| postgres-integration | [115124467722](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38345072933/job/115124467722) | SUCCESS | Exact checkout assertion; actual PostgreSQL 16 SERIALIZABLE reservation, replay, market settlement and persistence integration |

Every required step succeeded. Job logs were inspected; no skipped verifier or successful scope-classifier substituted for executed tests. Logs explicitly report `293 tests passed, 0 failed, 0 skipped`, economy `tests 26 / pass 26 / fail 0`, and PostgreSQL `SERIALIZABLE reservation, replay, market settlement and persistence: PASS`.

## Corrected defect and additional meaningful coverage

Initial run #38342023181 at `541b1c0f44da294dd94bf08e484c0a1825acdf12`: build passed; 289 tests passed and one cultivation invariant setup failed; verifier skipped. Root cause was old land fixture missing R04.9 canonical occupancy ABI. Commit `3f4bd350253b8d69e2d577156000218636d095e5` replaced that land mock with actual LandRegistry registration/operator transfer. Follow-up run #38344886910 passed; final candidate also passed the retained cultivation invariants.

Commit `b72945f96a5a23e7178f8a8fc69b0263fb4ead51` added R04AuthorityIntegration using actual CapabilityRegistry420 → HighCountryAuthorization → SecurityCouncilController → EmergencyState → RandomnessCoordinator. It verifies exact controller principal/domain, restriction of new requests, recoverable pending requests, one-time consumption, early/vetoed/revoked release denial, failed-release schedule rollback, authorized delayed release and resumed admission. Actual UpgradeCoordinator acceptance records provenance while original consumer/controller bindings remain unchanged; rebinding is rejected.

Commit `700d52f771fe15d5f58f88e7d92bc444e6bcee54` added service and real PostgreSQL jobs to the previously contract-only milestone. No standalone repository-wide Foundry/Genesis/global/Docs dispatch was performed; existing PR filters automatically scheduled other workflows, whose results are not counted here.

## Bounded security disposition and limitations

The executed tests prove their specific accounting, authorization, failure, replay, conservation and recovery assertions. They are not independent production security review, deployed operator acceptance or a proof that every EmergencyState domain has an enforced consumer. Competition evidence/entitlement tests retain programmable fixtures; metadata-only governance, Treasury permissions, progression and mission records do not imply funds, asset grants or verified gameplay rewards.

**Open required integration findings:** INT-R04-01 canonical competition/harvest/finality and entitlement adapters; INT-R04-02 missing R04 domain-specific mutator emergency enforcement with safe recovery; INT-R04-03 authenticated gameplay/reward/account/chain settlement composition; INT-R04-04 actual lifecycle/authority/Treasury/Identity/cross-game consumers. See the source-specific matrix in [R04 integration review](../R04-LEVEL2-INTEGRATION-REVIEW.md). None is waived as a live-testnet-only blocker.

Actual deployed addresses/code hashes/grants/officer credentials, funded operators, chain finality/reorg drills, external signed-user/identity/treasury acceptance, deployed database TLS/secrets/failover and R07.5 replacement/migration/rollback rehearsal remain genuine operational gates in [testnet work roadmap](../HIGHCOUNTRY-TESTNET-WORK-ROADMAP.md).

## Final milestone disposition

**NOT COMPLETE / OPEN INTEGRATION FINDINGS.** The exact candidate passes the expanded retained repository CI, but accumulated milestone acceptance cannot be declared until required integration findings are resolved or formally dispositioned according to existing canonical owners without claiming missing work implemented. No R04 development PR merged, R05 started, R04.15 invented, or Level 3 declared.

Level 3 remains separate: reconcile current main and qualify one exact merge-candidate through Solidity-owned complete Foundry inventory, approximately four balanced shards, independent Genesis addresses without duplicate Foundry, required global/Docs/app/client/service/security/deployment checks. Next canonical development step remains R05.1; it is not automatically begun by this record.
