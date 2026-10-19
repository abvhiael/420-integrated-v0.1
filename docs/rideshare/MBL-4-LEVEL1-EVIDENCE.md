# LIFTd MBL-4 — Level 1 exact-SHA qualification certificate

**Step:** MBL-4 — Driver onboarding, availability, ride offers, navigation and trip controls.
**Disposition:** Repository-scoped Level 1 mobile CI **PASS** for the implementation SHA below. This is not live operational eligibility or physical-device acceptance.
**Qualified implementation SHA:** `7e65e73f110e1ed82d85946c914a23b29f9b7093`
**Evidence-only commit:** separate from implementation SHA; this certificate changes no executable inputs.
**Branch:** `feat/liftd-mbl4-driver-flows-20261019`
**PR:** https://github.com/abvhiael/420-integrated-v0.1/pull/764
**Starting/reconciliation base:** `b4a4dbfb27951c5ac8bd8b5f805629fa978d6a6a`
**Run:** https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39312681267

## Verified GitHub Actions results for exact implementation SHA

| Required mobile job | Job ID | Conclusion |
| --- | --- | --- |
| `mobile-contracts` — types, contract/unit/security/regression tests | `118266064480` | **success** |
| `android-debug` — native Android debug build | `118267388339` | **success** |
| `ios-simulator` — native iOS simulator build | `118267388579` | **success** |

Android artifact `liftd-mbl1-android-7e65e73f110e1ed82d85946c914a23b29f9b7093`, ID `12216278222`, recorded size **39,158,698 bytes**.

## Covered repository implementation

* `rideshare/mobile/src/driver-journey.mjs`: deny-by-default fresh driver session before each operation; private onboarding metadata receipt and review, server-confirmed availability, expiring offers and idempotent responses, trip transitions, navigation capability and incidents; revoked/background state invalidation.
* `rideshare/mobile/src/driver-api.mjs`: bounded authenticated HTTPS transport restricted to versioned existing backend endpoints; no fabricated eligibility or offers.
* `rideshare/mobile/src/native-driver.ts`: explicit native driver assembly bound to approved backend and cryptographic command IDs.
* `rideshare/mobile/src/DriverScreen.tsx` and `App.tsx`: role-separated accessible driver interface; nonproduction mode; background invalidation and validated OS navigation handoff.
* `rideshare/mobile/test/driver-journey.test.mjs` and `driver-api.test.mjs`: expired offer, role denial, duplicate/replay transition, rejected onboarding metadata, navigation expiry and token/origin restrictions.
* Previously qualified MBL-1–MBL-3 mobile regression tests remain covered by the scoped mobile contracts job.

## Limits and next gate

No production driver approval, live availability, dispatch, real navigation service acceptance, production credentials, or public passenger traffic is authorized. Independent backend eligibility and live testnet acceptance remain **LT-04**, with mobile acceptance **TN-MBL-1–4** as recorded in the existing canonical testnet roadmap. MBL-4 simulator/native builds and repository contract checks are not a substitute for physically witnessed device/system integration.

**Level 2:** not due until M-MBL-A. **Level 3:** not due until mobile closeout. **Next step:** MBL-5 official SDK/API boundaries. Global Solidity/Genesis/Integrated/Docs and unrelated Cloudflare workflows were not rerun.
