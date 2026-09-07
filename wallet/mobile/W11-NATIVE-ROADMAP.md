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

### W11.4 — Native transaction submission and RPC transport — QUALIFYING
- Android native JSON-RPC transport added with configured chain endpoint allowlisting and HTTPS-only enforcement.
- iOS native JSON-RPC transport added with configured chain endpoint allowlisting and HTTPS-only enforcement.
- RPC method vocabulary is explicit and restricted to reads/estimates plus EIP-4337 UserOperation transport; `personal_sign`, `eth_sendTransaction`, and typed-data signing are not transport capabilities.
- Native transport supports `eth_call`, `eth_estimateGas`, balance/code/nonce/block/log reads, `eth_estimateUserOperationGas`, `eth_sendUserOperation`, and `eth_getUserOperationReceipt`.
- Android/iOS guarded UserOperation submitters accept owner/recovery/session flows only.
- Submission revalidates canonical chain ID, SmartAccount address, and authorization epoch immediately before transport and fails closed on drift.
- UserOperation receipt polling is native and bounded; RPC never receives private signing material.
- Initial transport implementation qualified on Wallet Mobile Verification #260 and Integrated Qualification #1337.
- Android and iOS now have dedicated configuration-only network registries; chain IDs are canonicalized and RPC URLs must be configuration-provided HTTPS endpoints with valid hosts and no embedded credentials.
- Transport errors are explicitly classified as timeout, network, HTTP status, malformed JSON-RPC response, or JSON-RPC application failure.
- JSON-RPC response validation now requires version `2.0`, matching request ID, and an explicit result when no error is returned.
- Regression guards cover configuration injection, canonical chain normalization, HTTPS rejection, error classification, response-ID binding, missing-result rejection, transport method allowlisting, and chain/account/epoch drift.
- Closeout condition: current config/error-hardening head passes Android/iOS native compile, Wallet Mobile Verification, and Integrated Qualification.

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
