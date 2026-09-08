# 420 Wallet — W11 Native iOS + Android

W11 converts the qualified mobile architecture into real platform applications and device integrations. The native applications remain presentation, device-security, and transport clients. `SmartAccount420`, Wallet Core, capability policy, recovery policy, session policy, and revocation remain canonical authority.

## Completed before W11

- W1 — SmartAccount420 foundation and wallet architecture.
- W2 — browser wallet core, provider boundary, account discovery.
- W3 — web UI and guarded owner execution.
- W4 — recovery management and timelock UX.
- W5 — EntryPoint420 / UserOperation transport and session capability plumbing.
- W6 — guarded batch execution.
- W7 — WebAuthn/passkeys, PK42, RIP-7212 transport and qualification.
- W8 — browser extension implementation and release qualification.
- W9 — mobile architecture, runtime adapter, native-screen model, device qualification, passkey/session abstractions, lifecycle hardening, dApp connection/deep-link model.
- W10 — cross-client authority/security hardening, extension-local passkey authority, unified signing policy, unified dApp permissions, phishing defenses, and shared security regression matrix. Merged by PR #111.

## W11 — real native projects and device integration

### W11.1 — Native project bootstrap + bridge boundary — COMPLETE
- Real Android Gradle application/source tree created.
- Real iOS SwiftUI application/source tree created with deterministic XcodeGen project definition.
- Matching native bridge contracts defined for RPC, secure storage, passkeys, session signing, transaction submission, external URLs, and lifecycle.
- RPC remains read/transport only; no remote signer or private-key storage fallback.
- Android/iOS application identifiers and minimum platform versions established.
- CI compiles Android debug and iOS simulator applications on every relevant pull request.
- Closeout qualification passed on Wallet Mobile Verification #196 and Integrated Qualification #1305.

### W11.2 — Hardware-backed secure storage + session keys — COMPLETE
- Android Keystore-backed AES-GCM secure storage and AndroidKeyStore/StrongBox-preferred non-exportable P-256 session keys.
- iOS Keychain storage and Secure Enclave-preferred non-exportable P-256 session keys.
- Locked-device, invalidation, v1 migration, rotation and non-exportability guards qualified.
- Closeout qualification passed on Wallet Mobile Verification #218 and Integrated Qualification #1316.

### W11.3 — Native passkeys + biometric authorization — COMPLETE
- Android Credential Manager and iOS AuthenticationServices native passkey ceremonies.
- Canonical WebAuthn/PK42 response material retained across both platforms.
- Malformed RP identifiers rejected; cancellation/error states normalized explicitly.
- Android `BiometricPrompt` and iOS `LocalAuthentication` remain local user-presence gates only.
- Regression guards prohibit biometric signing/private-key authority.
- Closeout qualification passed on Wallet Mobile Verification #246 and Integrated Qualification #1330.

### W11.4 — Native transaction submission and RPC transport — COMPLETE
- Android/iOS HTTPS-only JSON-RPC transports with configured chain endpoint allowlisting.
- RPC vocabulary restricted to reads/estimates plus EIP-4337 UserOperation transport; signing authority is excluded.
- Guarded owner/recovery/session UserOperation submitters revalidate chain ID, SmartAccount address, and authorization epoch immediately before transport.
- Native receipt polling is bounded and RPC never receives private signing material.
- Dedicated configuration-only network registries canonicalize chain IDs and reject invalid/insecure endpoints.
- Timeout, network, HTTP, malformed JSON-RPC, and JSON-RPC application errors are classified explicitly.
- Responses require JSON-RPC 2.0, matching request ID, and an explicit result when no error is returned.
- Closeout qualification passed on Wallet Mobile Verification #274 and Integrated Qualification #1344.

### W11.5 — Deep links, universal/app links, QR and dApp handoff — COMPLETE
- Shared handoff envelope binds HTTPS dApp origin, opaque request ID, expiry, and same-origin HTTPS callback.
- Handoff lifetime is capped at ten minutes and expired requests fail closed.
- Replay guard rejects a reused origin/request-ID pair until expiry.
- `420wallet://connect` remains an explicit development-only route; production uses verified HTTPS links.
- Android App Links and iOS Universal Links use build-time configured production hosts; no production domain is hardcoded.
- QR ingestion reuses the same strict handoff parser, accepts text only, caps payload size, and carries no approval/signing authority.
- Provider requests are canonically rehydrated from the bound HTTPS origin and request ID, then normalized through shared provider policy before approval.
- Callback completion remains expiry-bound, origin/request-bound, and single-shot.
- Closeout qualification passed on Wallet Mobile Verification #314 and Integrated Qualification #1364.

### W11.6 — Push authorization — COMPLETE
- Shared push envelope accepts only HTTPS `origin`, opaque `requestId`, and bounded `expiresAt`; extra fields fail closed.
- Push payloads carry references only and explicitly exclude signatures, private keys, UserOperations, authorization state, and pre-authorized execution.
- APNs and FCM registration paths are present in the real native projects.
- Android registers FCM at startup, handles token rotation through `FirebaseMessagingService`, persists only reference fields, and consumes a pending reference once when the app becomes active.
- iOS registers with APNs, captures device-token rotation through `UIApplicationDelegate`, handles foreground/background delivery plus notification-response/terminated launch, and consumes a pending reference once when the active scene resumes.
- Foreground, background, and terminated delivery states converge on one shared coordinator before approval.
- The shared replay guard rejects duplicate origin/request-ID pairs before a second canonical fetch and rejects stale references before any fetch.
- Canonical push rehydration revalidates origin, request ID, active SmartAccount, chain ID, authorization epoch, and expiry before approval.
- Native lifecycle regression guards require one-shot pending-reference consumption and forbid push code from acquiring signing/private-key/UserOperation authority.
- Closeout qualification passed on Wallet Mobile Verification #364 and Integrated Qualification #1389.

### W11.7 — Native Wallet / Apps / Activity / Security UX — COMPLETE
- Wallet, Apps, Activity, and Security are first-class native surfaces on Android and iOS.
- Wallet presentation includes portfolio totals, normalized assets, send/receive/connect affordances, and recent activity.
- Apps gateway accepts structurally validated HTTPS destinations only and carries no signing authority.
- Activity presents UserOperation status, chain, hash, and timestamps without introducing execution authority.
- Security Center surfaces passkeys, sessions, dApp permissions, recovery, and device state with management actions routed through qualified Wallet Core flows.
- Native UI regression guards prohibit remote signing/private-key authority.
- Closeout qualification passed on Wallet Mobile Verification #388 and Integrated Qualification #1401.

### W11.8 — Device lifecycle and hostile-state hardening — COMPLETE
- Shared hostile-state policy classifies root/jailbreak/debugger/device-compromise/screen-capture signals as local risk inputs only.
- Background, inactive, locked, sensitive, and capture-active states drive local privacy shielding and local lock policy without changing canonical SmartAccount420 authority.
- Android enables `FLAG_SECURE`, inspects root/debugger signals, and locally locks presentation on backgrounding.
- iOS shields inactive/background/captured presentation, inspects jailbreak/debug configuration signals, and clears pending presentation state on lock.
- Android and iOS require existing qualified biometric/device-owner authentication gates to restore local presentation access after backgrounding; handoffs, navigation, and pending push presentation remain blocked while locally locked.
- Local unlock restores presentation access only and does not change canonical SmartAccount420/capability authority.
- Lost-device coordinators invalidate native session keys first, clear local push/permission state and clipboard contents, then invoke the canonical recovery callback.
- Android clipboard handling marks copied public values sensitive where supported and clears clipboard state during lost-device handling.
- iOS clipboard handling is local-only and expires copied public values after 60 seconds; lost-device handling clears it immediately.
- Closeout qualification passed on Wallet Mobile Verification #430 and Integrated Qualification #1422.

### W11.9 — Native automated qualification — IN PROGRESS
- Android platform-native JUnit authority-policy tests cover canonical SmartAccount/CapabilityRegistry authority, RPC transport-only policy, qualified UserOperation RPC vocabulary, and credential-free HTTPS endpoint validation.
- Android emulator instrumentation tests run device-side authority/RPC fail-closed checks, including rejection of `personal_sign`, `eth_sendTransaction`, insecure HTTP, and credential-bearing endpoints.
- iOS XCTest covers the same authority-policy contract with an explicitly hosted `Wallet420Tests` target and stable `PRODUCT_MODULE_NAME: Wallet420` import surface.
- iOS UI smoke tests now launch the simulator app and verify the primary Wallet / Apps / Activity / Security surfaces are reachable.
- Shared Node qualification fixtures assert Android/iOS authority-policy parity and fail on native authority drift.
- Static native-source guards forbid embedded private-key material, private-key export paths, remote-signing fallbacks, insecure HTTP RPC endpoints, and legacy signing-method transport.
- Wallet Mobile CI executes Android unit tests + emulator instrumentation, iOS unit + UI simulator tests, native builds, shared mobile checks, release checks, and shared wallet-core regression in the same PR qualification path.
- Android emulator/static-guard slice qualified on Wallet Mobile Verification #464 and Integrated Qualification #1439.
- Current step: W11.9 closeout qualification for iOS UI/simulator coverage and consolidated native qualification.

### W11.10 — Release engineering and device qualification
- Signed internal Android build and iOS archive path.
- Physical-device passkey/biometric/secure-storage qualification.
- Deep-link and push matrix across locked/unlocked/background/terminated states.
- Store metadata/privacy entitlements review.
- W11 closeout qualification before merge to `main`.

## W11 invariants

- WALLET-W11-001 — native clients never become a second account/capability authority.
- WALLET-W11-002 — secret signing material is non-exportable whenever the platform supports it and never stored in plaintext.
- WALLET-W11-003 — public RPC remains transport/read authority only.
- WALLET-W11-004 — passkey/session authorization is locally mediated and bound to canonical SmartAccount420 state.
- WALLET-W11-005 — origin, account, chain, authorization epoch, expiry and requested scope are revalidated at approval time.
- WALLET-W11-006 — push/deep links carry references and intent, not signing secrets or pre-authorized execution.
- WALLET-W11-007 — web, extension and mobile preserve one signing/permission policy vocabulary.
