# 420 Wallet W12 — WebAuthn / Passkeys

W12 adds phishing-resistant WebAuthn credentials to the 420 Wallet without creating a second account authority or pretending that a browser passkey is already a valid `SmartAccount420` signer.

## W12.1 — Client WebAuthn foundation

The web client now has provider-neutral helpers for:

- HTTPS / relying-party identity validation
- ES256 (`alg = -7`) registration options
- required user verification
- attestation minimization (`attestation = none`)
- discoverable/platform credential support
- authentication options with explicit credential allow-lists when known
- base64url serialization for WebAuthn binary fields
- domain-separated challenges bound to chain ID, SmartAccount address, authorization epoch, operation and nonce
- a fail-closed authority readiness check

Registration and assertion objects are not themselves account authority. Credential metadata may be cached by clients, but canonical wallet authority remains in `SmartAccount420` / `CapabilityRegistry420`.

## W12.2 — SmartAccount P-256 verification

Before `features.passkeys` can be enabled, the chain/account layer must support a qualified P-256/WebAuthn verifier. The implementation should:

1. verify P-256 signatures through a chain-native/precompile-backed verifier where available;
2. verify authenticator data, challenge and origin/RP binding rather than accepting a raw P-256 signature alone;
3. bind each passkey credential to a specific SmartAccount and authorization epoch;
4. support explicit owner-authorized add/revoke semantics;
5. fail closed when the verifier/precompile is unavailable;
6. prevent passkey credentials from bypassing recovery, capability, spend, nonce or EntryPoint policy;
7. invalidate affected credentials/session authority when the account authorization epoch advances where policy requires it.

## W12.3 — Wallet UI + device lifecycle

The user-facing passkey panel should provide:

- register this device/passkey
- device/credential label
- last-used metadata where locally available
- explicit revoke
- recovery warning before removing the last usable credential
- clear distinction between owner credentials and scoped session credentials
- origin/RP identity display
- fallback to existing owner signing until passkey authority is fully qualified

## W12.4 — Production qualification

Production enablement requires the canonical wallet domain because WebAuthn RP identity is domain-bound. Until then, localhost/staging can exercise the client foundation, but production passkey authority remains disabled.

The runtime `features.passkeys` flag therefore remains `false` in W12.1. It must only be flipped after W12.2–W12.4 qualification gates pass.
