# R03.12 — Clients and travel Level 2 milestone

Canonical roadmap: `docs/doobr/DOOBR-R01-R06-ROADMAP.md`, R03.12. Audit branch `roadmap/doobr-bc-vancouver-infrastructure`, PR #601.
Inspected main/base: `fd0861e5d4c68d230893e20514d80d0da01b3172`; branch divergence at inspection: 330 ahead, 1104 behind. Do not reconcile/merge main at this milestone: Level 3 remains R05.10.

## Accumulated acceptance
Level 2 retains site integrity and static build, R03.1–R03.7 client journey boundary, R03.8 native Android/iOS unsigned builds and mobile security, R03.9 offline/replay/identity test contracts, R03.10 signed coarse presence projection and hard-failed Travel checkout, R03.11 browser desktop/mobile emulation and keyboard/denial navigation. Combined suite in `.github/workflows/doobr-r03-12-level2.yml` is exact-SHA pinned and app-scoped, not repository-wide Foundry/Genesis/Docs.

Testnet/external acceptance is **not** included as PASS: real device iOS/Android, independent TalkBack/VoiceOver, live authenticated HTTP and shared staging DB, independent canonical issuer and device trust, deployed signed Travel projection, regulated business authorization. Retain the original milestone identifiers and their checklist in `docs/audit/DOOBR-TESTNET-DEFERRED-QUALIFICATION-ROADMAP.md`. None permit enabling DOOBr checkout, Pay/Wallet or courier tracking.

## Evidence pending verification
Implementation SHA: `5a97d588ee5d4a03b2d6d90cbf1e4ce00dcadccd` (workflow addition). Before recording PASS, inspect exact run and all three `clients-travel`, `android`, `ios` jobs; missing/skipped/cancelled are not green. Check logs for failures and fix at source, not by deleting assertions.
Current milestone state: **PENDING exact-SHA Level 2 qualification**, not complete.
Next canonical: **R04.1 Reuse inventory: no new contract if canonical authority already exists.**
