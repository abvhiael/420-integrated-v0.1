# HC-GP.4 — Session / Capability Integration

High Country uses the existing 420 Wallet smart-account authority model. It does not create a parallel private key, session signer, grant registry, or game-specific custody layer.

## Authority split

`SmartAccount420` remains authoritative for:

- owner / passkey authority;
- session-key enablement and revocation;
- authorization epochs;
- exact target + selector session grants;
- grant validity windows and usage limits;
- execution through `EntryPoint420`.

`CapabilityRegistry420` remains authoritative for whether a session grant is currently active, valid, revoked, expired, or over its configured limits.

High Country adds `HighCountrySessionAccess420` only as a game policy and verification layer.

## Routine game actions

High Country administrators may mark an exact contract target + selector pair as routine through the normal High Country capability authorization path.

Routine means the action may be used by a wallet session key when the user's `SmartAccount420` has also granted that session key the corresponding canonical `SESSION_EXECUTE` capability.

The High Country policy is default deny. Unknown targets and selectors require wallet escalation.

## Native $420

Routine High Country sessions have a native `$420` spend limit of exactly zero.

Any call carrying native value requires wallet escalation. High Country does not create a background native-spend allowance.

Token/native spending rules enforced by `SmartAccount420` continue to apply independently.

## Fail-closed session verification

A High Country routine session is considered authorized only when all of the following are true:

1. the target + selector is explicitly classified as a High Country routine action;
2. the supplied account exposes the canonical `SmartAccount420` component ID for its own address;
3. the session key is enabled in the account's current authorization epoch;
4. the session scope equals the canonical `SmartAccountScopes420.sessionCallScope(...)` value;
5. the account's capability registry reports an active `SESSION_EXECUTE` grant for the exact session key, component, scope, target and selector;
6. that grant is currently authorized for a zero-value call.

Epoch changes, recovery-driven invalidation, session revocation, grant revocation, expiry, wrong target, wrong selector and missing grants all fail closed.

## Escalation boundary

The intended wallet UX is:

- routine zero-value gameplay action → eligible for session execution;
- marketplace or native `$420` spend → wallet/passkey;
- transferable asset actions → wallet/passkey;
- genetics registration/licensing with ownership or economic consequences → wallet/passkey;
- major prize claims → wallet/passkey;
- unknown or newly introduced selectors → wallet/passkey until explicitly reviewed and classified routine.

This preserves the product rule: the wallet is a key, not a tollbooth, without turning game sessions into general-purpose wallet authority.
