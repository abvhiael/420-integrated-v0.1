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

### W11.5 — Deep links, universal/app links, QR and dApp handoff — IN PROGRESS
- Shared handoff envelope binds HTTPS dApp origin, opaque request ID, expiry, and same-origin HTTPS callback.
- Handoff lifetime is capped at ten minutes and expired requests fail closed.
- Replay guard rejects a reused origin/request-ID pair until expiry.
- `420wallet://connect` remains an explicit development-only route; production uses verified HTTPS links.
- Android App Links use `android:autoVerify="true"` with a build-time configured wallet link host and `/connect` route.
- iOS Universal Links use Associated Domains with a build-time configured wallet link host; no production domain is hardcoded.
- Android and iOS native handoff parsers enforce the same host/path/origin/request/expiry/callback contract and carry no signing authority.
- Android `MainActivity` and SwiftUI app entry points route inbound links through the strict native parser before presenting request state.
- Regression tests cover production host/path binding, dev-scheme gating, callback origin binding, expiry windows, replay rejection, Associated Domains, Android App Links, and absence of signing/private-key authority.
- Next: qualify native builds and shared handoff tests, then add QR payload ingestion/canonical request rehydration and callback completion hardening.

### W11.6 — Push authorization
- APNs and FCM device registration.
- Push contains request reference only, never signing authority or secrets.
- Foreground approval screen rehydrates canonical request and revalidates origin/account/chain/epoch.

### W11.7 — Native Wallet / Apps / Activity / Security UX
- Wallet balances and assets.
- Ecosystem Apps gateway.
- Activity/UserOperation status.
- Security center for passkeys, sessions, permissions, recovery, and device state.

### W11.8 — Device lifecycle and hostile-state hardening
- Lock/background/resume behavior.
- Jailbreak/root/debugger policy signals without treating them as canonical authority.
- Clipboard/screenshot/privacy-screen handling for sensitive views.
- Lost-device session invalidation and recovery pathways.

### W11.9 — Native automated qualification
- Android unit/instrumentation tests and emulator build.
- iOS unit/UI tests and simulator build.
- Shared authority regression fixtures executed against both bridge implementations.
- Static checks forbid embedded private keys, remote signing fallbacks, insecure HTTP, and authority drift.

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
