# LIFTd MBL-5 — Level 1 exact-SHA qualification evidence

**Step:** MBL-5 — Wallet/Pay, Travel, Notifications and scoped trip communication integration.
**Result:** PASS — repository-scoped Level 1 mobile contracts / Android debug / iOS simulator CI. This is not external Wallet/Pay or live Identity/Notifications acceptance.
**Implementation SHA:** `3b4236d2e65e74895287ecdcf25cedc6f9f9f509`
**Evidence-only commit:** committed separately from implementation SHA; no executable, test, workflow, dependency or configuration inputs changed.
**PR:** https://github.com/abvhiael/420-integrated-v0.1/pull/765
**Branch:** `feat/liftd-mbl5-sdk-boundaries-20261019`
**Reconciliation base:** `adf2e3562aedff558494f1f62e0a3472e1c02ba3` (main remained unchanged through qualification).
**CI run:** https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39320730698

## Exact-SHA verification

| Job | ID | Result |
| --- | --- | --- |
| mobile-contracts — TypeScript, app unit and regression tests | 118293772882 | **success** |
| android-debug — nonproduction Android debug build | 118294141898 | **success** |
| ios-simulator — nonproduction iOS simulator build | 118294142179 | **success** |

**Android artifact:** `liftd-mbl1-android-3b4236d2e65e74895287ecdcf25cedc6f9f9f509`, GitHub artifact ID **12218764762**, reported size **39,158,697 bytes**.

## Implemented and qualified repository scope

* `rideshare/mobile/src/integrated-consumers.mjs`: fresh server-confirmed rider/driver trip scope; explicit Wallet/Pay consent; no silent signing or financial authorization; server-owned financial status, revision/reorg/refund handling; canonical Travel SDK consent and verification, always preview-only; opt-in notification permission with strict non-sensitive status-only envelopes; authorized trip messages, idempotency keys, sender and active-trip boundaries.
* `rideshare/mobile/src/service-api.mjs`: pinned HTTPS versioned Pay prepare/read and trip message read/send; bounded responses and failed/redirected/tokenless requests rejected.
* `rideshare/mobile/src/native-integrations.ts`: explicit native assembly using canonical `rideshare/sdk/travel-handoff-v1.mjs`, approved endpoint, injected verified session/token and platform permission adapter, cryptographic command IDs.
* `rideshare/mobile/src/TripIntegrations.tsx`: accessible Wallet/Pay, Travel, notification and trip-message entrypoints attached to rider and driver screens; unconfigured nonproduction preview stays disabled.
* `rideshare/mobile/test/integrated-consumers.test.mjs` and `integrations-ui.test.mjs`: Pay no-intent/reorg/refund/stale rejection; consent, Wallet nonbroadcast, Travel consent, notification permission denial/payload protection, member-scoped message retry and idempotency; HTTPS and access-token denial; UI configuration.
* Existing MBL-1 through MBL-4 regression tests remained in the scoped mobile workflow. No existing backend Pay, Wallet, Travel or Messenger authority was rewritten.

## Deliberate security and acceptance boundaries

The mobile app does **not** sign, broadcast or custody funds. External Wallet SDK and real chain receipt/reorg/refund verification require approved testnet authorities. The native permission contract is dependency-injected and no OS push subscription/delivery is certified by this CI; external platform permissions, live device acceptance, message delivery and registered push handling remain TN-MBL-2/TN-MBL-3 and LT-03/LT-08. No protected identity records, raw coordinates or incident details are allowed in push status payloads. Travel remains preview-only and cannot book or transfer funds.

**Qualification:** Level 1 passed for implemented repository-scoped MBL-5 consumers and native builds. **Level 2:** not due until M-MBL-A at MBL-6. **Level 3:** not due until mobile closeout. **Next roadmap:** MBL-6 — platform permission manifests, encrypted local state, privacy, lifecycle, signed reproducibility and app-specific integration qualification. No global Solidity, Genesis, Integrated, Geth, Docs or unrelated Cloudflare suite launched.
