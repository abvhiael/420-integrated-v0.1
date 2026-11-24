# DEVCOMP-06 acceptance matrix

**Status: OPEN.** This record covers local and repository CI qualification.
Live deployment and complete production-route reconciliation remain open.

## Evidence identity

- Integrated local runtime tests used commit `519f8930a34bdfb1d5950c87fe29e1b2e29281dc`, tree `4a93f0c21008578a9625b5f6d04f6717707c56f7`.
- The local tree combines main `d7bb43e1fa14ea5a1e20ef91886026477392c083`, Analytics local source commit `3f6715b6`, and Explorer local source commit `8103c036`. Both sets of receipt assertions were retained when resolving the overlap in the qualification script.
- The Explorer dependency verifier passed with 17 mapped reads at local commit `379168ca89d00ebe89cd1634eb301f6513c5978b`. The corresponding published fix is `3c3285f3b2fe05bafafffa3a047392855e0d96a1` on PR #1401.

## Route and component acceptance

| Requirement | Result | Evidence or missing boundary |
| --- | --- | --- |
| Exchange originating trade and founder claims | Partial | Four settlement tests passed on the integrated local tree. They exercise the atomic exchange path with the suite's settlement adapter. The independent Anvil chain starts at the production fee router and carries Wrapped420 through the canonical vault, splitter, claim, Indexer and Analytics; a full trade through both consumers has not been run. |
| Fantasy daily, approved formats and season | Partial | Daily and funded-format CI passed at `41ff124256fb015b8b5129c7bb476628a4ee2242`. The production Fantasy receipt-to-consumer path has not been run. [Daily CI](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45343907081), [Funded CI](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45343907173). |
| Vault authority, rollback, replay and asset isolation | Local pass | 14 Foundry tests passed on the integrated local tree, including 50,000 contribution/claim sequence fuzz runs. The targeted Slither and hardening gate passed at `41ff1242`, before the Explorer and Analytics integrations. [Vault CI](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45343906971). |
| Indexer authentication and recovery | Local pass | The integrated Anvil/SQL run reconciled seven canonical events after replacing one block. Transaction-scoped queries excluded the orphaned claim. Rebuilding the SQL projection reproduced the surviving records. |
| Explorer provenance and presentation | Partial | Explorer Go suites and 24 web tests passed on the integrated tree. The CLI receipt harness exercised the Indexer HTTP route. A single real-receipt run through the Explorer HTTP server and page remains open. The broader Indexer gate on PR #1401 head `337ff46d` failed on dependency inventory drift. The corrected inventory verifier passed locally. [Failed gate](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45447574638). |
| Analytics exact reporting | Local pass | Analytics Go suites and five focused Indexer unit tests passed. The integrated receipt harness exercised the report behind the Analytics API and checked eligible revenue, compensation, claims and outstanding values by asset. [Analytics CI at 5f84d3d2](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45450239514). |
| All eligible production routes identified and integrated | Open | PR #1400 still has unclassified catalogue records. PR #1395 lacks qualified production custody-source coverage for the casino-wide profit basis. |
| Current-main and live closeout | Open | Explorer and Analytics remained open PRs at the time of this run. The combined test tree is a local qualification candidate. |

## Receipt reconciliation on the integrated tree

| Asset | Observed eligible basis | Forwarded | Canonical claims | Outstanding |
| --- | ---: | ---: | ---: | ---: |
| Native $420, direct vault control | 1400 | 140 | 0 | 140 |
| Wrapped420, production Exchange fee router | 800 | 80 | 20 | 60 |

Amounts are integer base units. Exchange recipient balances were 240, 200,
160 and 120, with 80 forwarded to the splitter. The report counts the
matched transfer once. The native direct contribution exercises the control
path, while the ERC-20 route exercises the Exchange fee router.

- Exchange contribution: `0xbe284732c0d23d7525309bb71a589ded469298d9c1eb013789c24ac9bc43a206`
- Wrapped420 founder claim: `0x44a3d2f62670c5ce77447eeba56f4cd4fd5f91c2863e83c69428c29f2f0ce5b4`
- Removed native founder claim: `0x5d4ba138c2be5d436fab044a852c89eda7e6db7fb27407fcae547c29fa8b48e6`
- Canonical replacement: `0x528222be9345d61d2a55457b3606abf254b82089c9a08bf5134f4d6691236e0e`
