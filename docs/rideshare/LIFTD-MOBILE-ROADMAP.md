# LIFTd Mobile — Android + iOS implementation-to-testnet roadmap

**Status:** PLANNED (no installable mobile application or device qualification claimed).
**Authority:** Extension of [LIFTd canonical roadmap](LIFTD-ROADMAP.md); preserves all locked L01–L03 identifiers, requirements and qualified exact-SHA evidence. Existing [LIFTd testnet work roadmap](LIFTD-TESTNET-WORK-ROADMAP.md) remains the source of external acceptance gates. First pilot market remains Vancouver, BC; no authorization to carry passengers is implied.

## Technical starting point

Create a **single shared TypeScript React Native application** for Android and iOS, with separate rider and driver role-based experiences (no operator console in the mobile MVP). Use platform-specific native integrations only for permissions, secure storage, push, maps/navigation and build signing. Place work in `rideshare/mobile/`, keeping the existing `rideshare/web/` static website, `rideshare/src/` server authority and `rideshare/sdk/travel-handoff-v1.mjs` integration ownership intact. Use a project-specific mobile API adapter around already versioned LIFTd endpoints; do not copy authority logic, issue test credentials, or introduce a second wallet/payment ledger.

## Mobile implementation steps (new MBL namespace; no L01–L03 roadmap drift)

| Step | Deliverable | Qualification / acceptance |
| --- | --- | --- |
| **MBL-1** | Bootstrap React Native TypeScript Android/iOS project, navigation, rider/driver route boundaries, themes, accessible components and build scripts. Add deterministic local development fixtures; all production endpoints disabled by default. | Level 1: compile/typecheck/unit tests on both platforms and an installable **unsigned/nonproduction** debug build artifact. |
| **MBL-2** | Identity/session integration: verified sign-in/out, secure platform credential storage, token refresh/revocation, recovery, role segregation and loss-of-session behavior; no private keys in logs. | Level 1: simulator/emulator tests of expiry/revocation/reconnect and role-denial; independent real Identity acceptance remains LT-02. |
| **MBL-3** | Rider flows: account/preferences, permission-based or manually entered pickup/destination, accessible route/quote/consent/ride-state screens, cancel, safety/help and offline/retry states. | Level 1: mock-to-contract journeys and denials; live Location and payment acceptance remain LT-03/LT-05. |
| **MBL-4** | Driver flows: onboarding status, approved documents handoff, availability/offers, expiry/acceptance, navigation handoff, arrivals, trip start/complete, safety and offline-resume behavior. Never infer eligibility locally. | Level 1: fresh server authorization and state transition/duplicate/revocation tests; external eligibility remains LT-04. |
| **MBL-5** | Integrate official SDK/API boundaries: Wallet consent + Pay intent/status (noncustodial, no silent payment), Travel handoff, Notifications and scoped trip communication. Push payloads contain no raw coordinates or protected incident/identity records. | Level 1: authenticated consumer contracts, receipt/reorg/refund and notification permission/denial tests; external acceptance remains LT-03/LT-08. |
| **MBL-6** | Harden and package Android/iOS: platform permission manifests, encrypted local state, privacy/data erasure, background lifecycle, deep/universal links, accessibility, crash-safe recovery, supply-chain checks and reproducible CI builds. | Level 1 + **M-MBL-A Level 2** integrated Android emulator/iOS simulator qualification at one exact SHA. One **MBL closeout Level 3** after reconciliation; do not duplicate global suites. |

## Testnet acceptance handoff (not repository qualification)

* **TN-MBL-1 — Build and distribution:** Provision controlled Android internal-testing and iOS TestFlight distribution, real signing identities, app identifiers, install/upgrade/rollback and release provenance. Mac/Xcode and Apple signing access are required for actual iOS builds; emulator-only evidence cannot substitute for physical-device acceptance.
* **TN-MBL-2 — Real devices and accessibility:** Independently test current Android and iPhone hardware, permissions denial, backgrounding, loss of signal, deep links, notifications, screen readers (TalkBack/VoiceOver), location protection and session revocation.
* **TN-MBL-3 — Official testnet end-to-end:** Bind deployed approved LIFTd testnet endpoints, Identity/Registry, authorized Location, Wallet/Pay, messaging, safety and operational services. Witness signed consent, exact trip transitions, quote expiry, failure/replay, refunds/reorg and safe stop/recovery using testnet identities and funds only.
* **TN-MBL-4 — Restricted release decision:** Independent security/privacy/accessibility and operator approval, Vancouver transport/regulatory constraints and testnet evidence signed against pinned mobile artifacts and backend SHA. Only then call the mobile apps **testnet-ready/accepted**; production dispatch, real payments and public passenger traffic remain separately gated.

## Execution rules

One scoped PR per MBL step; Level 1 only for ordinary steps, one Level 2 at M-MBL-A, and one Level 3 at MBL closeout. Preserve the successful existing LIFTd web/backend qualification and SHA evidence unless an actual consumed interface changes. Build neither fake live booking nor a placeholder app-store download. Do not require Cloudflare static-site deployment checks to qualify native mobile work. Track device, signing, external authority and operational blocks explicitly rather than substituting mock evidence.
