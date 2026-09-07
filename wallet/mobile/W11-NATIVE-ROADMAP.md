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

### W11.2 — Hardware-backed secure storage + session keys — QUALIFYING
- Android Keystore-backed AES-GCM secure storage implemented for device-bound wallet state.
- iOS Keychain storage implemented with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`.
- Android non-exportable P-256 session keys implemented inside `AndroidKeyStore`, preferring StrongBox on API 28+ and falling back to platform AndroidKeyStore / TEE-backed storage when StrongBox is unavailable.
- Android session keys now require an unlocked device on API 28+ and explicitly classify permanently-invalidated and locked-device signing failures.
- iOS non-exportable P-256 session keys implemented with Secure Enclave preference on physical devices and a non-exportable Keychain-backed simulator/unsupported-device fallback.
- iOS session keys are device-only and unavailable while the device is locked; `errSecInteractionNotAllowed` is surfaced as a locked-device state.
- Session-key lifecycle is part of the native bridge: ensure, public-key retrieval, rotate, invalidate, and local hash signing.
- Both platforms now use versioned v1 key namespaces. Legacy W11 aliases are deleted and replaced with freshly generated v1 hardware-backed keys rather than exporting/copying old private material.
- Qualification guards cover StrongBox/Secure Enclave policy, unlocked-device behavior, invalidation states, v1 migration markers, lifecycle methods, and absence of private-key export paths.
- Closeout condition: current-head Android/iOS compile and shared Wallet/Integrated qualification green.

### W11.3 — Native passkeys + biometric authorization
- AuthenticationServices passkeys on iOS.
- Credential Manager / passkeys on Android.
- Face ID / Touch ID and Android biometric policy gates where appropriate.
- Preserve canonical WebAuthn/PK42 payload semantics and signer/account binding.

### W11.4 — Native transaction submission and RPC transport
- Platform HTTP transport with chain allowlisting and TLS-only endpoints.
- Native `eth_call`, reads, estimates, UserOperation submission/receipt polling.
- Native owner/recovery/session transaction submit boundary.
- Fail closed on chain/account/epoch drift.

### W11.5 — Deep links, universal/app links, QR and dApp handoff
- `420wallet://` development scheme.
- iOS Universal Links and Android App Links for production domains.
- QR request parsing and strict origin/request binding.
- Return/callback flow with replay protection and expiry.

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
