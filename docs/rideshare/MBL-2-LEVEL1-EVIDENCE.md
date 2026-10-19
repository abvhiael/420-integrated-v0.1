# LIFTd MBL-2 — Level 1 exact-SHA qualification evidence

**Status:** PASS for repository-scoped MBL-2 mobile CI at the implementation SHA below. This does not constitute deployed Identity issuer or independently witnessed physical-device acceptance.

**Implementation SHA:** `2e6a7c10496d2bddeaf6526e9367c503a5c9bfd0`
**Branch:** `feat/liftd-mbl2-secure-sessions-20261019`
**PR:** https://github.com/abvhiael/420-integrated-v0.1/pull/760
**Qualification:** Level 1; Level 2 M-MBL-A and Level 3 mobile closeout not invoked.
**Original starting main:** `879948a1a6af1c528d7431d65a09efade42796f1`
**Verified CI run:** https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39289735585

## Implementation and evidence

* `rideshare/mobile/src/session-controller.mjs`: deny-by-default fresh server session decision, account/device/nonce binding, separate rider/driver authority, logout/recovery generation invalidation and expired-session refusal.
* `rideshare/mobile/src/native-session.ts`: device-only secure session vault, explicit approved HTTPS session authority and cryptographically generated challenge nonce.
* `rideshare/mobile/src/identity-flow.mjs` and `src/native-identity.ts`: OAuth authorization-code + PKCE-S256, state/callback validation, bounded code exchange, refresh-token rotation contract and remote revocation attempt.
* `rideshare/mobile/src/mobile-lifecycle.mjs` and `src/native-lifecycle.ts`: native identity/session assembly, secure token persistence, refresh-before-authority, local revocation/recovery, race and role denial.
* Scoped tests: `test/session-controller.test.mjs`, `test/identity-flow.test.mjs`, `test/mobile-lifecycle.test.mjs`, `test/native-session-config.test.mjs`, `test/native-lifecycle-config.test.mjs`.

### Successful exact-SHA GitHub Actions jobs

| Job | ID | Conclusion |
| --- | --- | --- |
| `mobile-contracts` — TypeScript, unit, security/config tests | `118186940713` | **success** |
| `android-debug` — native Android Gradle debug compilation | `118188550598` | **success** |
| `ios-simulator` — native iOS Simulator compilation | `118188550592` | **success** |

* Android artifact: `liftd-mbl1-android-2e6a7c10496d2bddeaf6526e9367c503a5c9bfd0`, artifact ID `12205531941`, recorded size **39,158,697 bytes**, uploaded by run `39289735585`.
* No global Solidity, Genesis, Integrated, Docs, or unrelated Cloudflare qualification dispatched for MBL-2.

## Scope/limits

Successful repository-native compilation and contract tests do not certify a real deployed Identity issuer, approved endpoint configuration, independent emulator/physical-device interactive sign-in, live token/issuer revocation, production credential handling, regulatory acceptance, or live passenger transport. These remain external deployment/testnet acceptance under LT-02 and TN-MBL-1–4. Production endpoints, dispatch, bookings and payment are not enabled by this work.

**Next roadmap step:** MBL-3 — rider flows. Do not advance until merge reconciliation and eligibility are confirmed.
