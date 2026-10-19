# LIFTd MBL-3 — Level 1 qualification evidence

**Scope:** MBL-3 rider flows; repository-scoped mobile qualification only. No production rider/dispatch/payment approval.
**Qualified implementation SHA:** `9c65a96268212075bdadd5e7cb9eaf129f4ef2e7`
**Evidence-only commit:** this file's commit (separate from the implementation SHA).
**PR:** https://github.com/abvhiael/420-integrated-v0.1/pull/763
**Branch:** `feat/liftd-mbl3-rider-flows-20261019`
**Reconciliation base at PR creation:** `8c6cb7d38c6c69dac7bb3699eaea3ccbb047bab5`
**Original implementation starting main:** `3d513d71078ac0be6fdc89236c8663089fe2858c`
**Verified CI run:** https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39308697009

## Exact-SHA workflow evidence

| Job | GitHub job ID | Result |
| --- | --- | --- |
| mobile-contracts (TypeScript and Node contract/security tests) | 118252361150 | **success** |
| android-debug (native Android debug build) | 118254446891 | **success** |
| ios-simulator (native iOS simulator build) | 118254446918 | **success** |

Android debug artifact: `liftd-mbl1-android-9c65a96268212075bdadd5e7cb9eaf129f4ef2e7`, GitHub artifact ID `12216000084`, recorded size 39,158,695 bytes. Artifact is a nonproduction unsigned/debug deliverable; not approval for release.

## Qualified repository implementation

* `rideshare/mobile/src/rider-journey.mjs`: client orchestration with fresh rider-role session checks; canonical pickup, quote, trip and preferences validations; secure command IDs; server quote ownership and trip acknowledgement binding, cancellation and safety controls.
* `rideshare/mobile/src/rider-api.mjs`: explicit approved HTTPS endpoint and JWT bearer transport, bounded JSON responses, no redirected requests and route/trip scoped endpoints.
* `rideshare/mobile/src/native-rider.ts`: native cryptographic command generation and explicit Identity/API binding.
* `rideshare/mobile/src/RiderScreen.tsx` and `rideshare/mobile/App.tsx`: accessible address, quote/consent, trip, safety and preferences entry points with nonproduction mode clearly labeled.
* `rideshare/mobile/test/rider-journey.test.mjs`, `rider-api.test.mjs` and `rider-screen.test.mjs`: scoped positive, rejection, session-denial and transport tests; original MBL-1 and MBL-2 mobile regression tests remain in the test invocation.

## Reconciliation and external gates

At evidence creation, intervening changes on current main relative to the PR creation base were confined to 26 arcade Kush Krusher expression PNG assets. No LIFTd mobile source, mobile workflow, dependency or shared API ownership changed. The evidence commit changes only this non-executable certificate and does not alter the qualified implementation SHA; existing run/job evidence remains authoritative.

**Qualification level:** Level 1 scoped automated CI PASS. Does **not** certify independent live Identity, Location, route pricing, payment, safety dispatch, emulator interaction journeys or public transport operations. Such acceptance requires production-equivalent testnet configuration and external authority (existing LIFTd testnet roadmap). The preview retains disabled live service actions absent explicit trusted native assembly.

**Level 2:** Pending milestone M-MBL-A. **Level 3:** Not due. **Next roadmap step:** MBL-4 per canonical LIFTd mobile roadmap. No unrelated global suite dispatched.
