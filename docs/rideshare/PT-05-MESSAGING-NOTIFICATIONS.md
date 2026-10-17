# LIFTd PT-05 — Messaging and notifications readiness

**Scope:** Pre-testnet repository preparation only. No change to canonical L03.10 or TN-0–TN-6; LIFTd-TN-MSG remains NOT ACCEPTED.

## Existing controls verified
`rideshare/src/trip-communications.mjs` consumes the canonical Messenger's participant/trip grant (it never mints the transport grant), bounds expiry to active Identity grants, validates trip revision, reassignment, state and participant role, and redacts notification payload to trip ID, state and revision. `rideshare/src/identity-consent-guard.mjs` requires signed fresh Identity/session checks and durable rider opt-in.

## PT-05 additional local hardening
- Recheck subject, account, session, device and recovery epoch after asynchronous Messenger entitlement creation and exact rider/driver/trip state after reads and immediately before sends. Prior logic could accept a driver's send when their trip was reassigned, if the recipient rider remained the same.
- Before notifications are published, recheck trip state/revision and calling session; no notification for a different participant's consent using a caller token.
- Driver notification delivery has no independent account-scoped driver consent verifier; disable this unverified path rather than treating a preference object as an authorization. Restore only with a properly qualified driver consumer and independently authorized delivery controls.
- Keep service factory fail-closed without required Messenger, notification or rider consent dependencies. Preserve the existing tests and add reassignment, race and cross-participant negatives.

## Strict pending deployed acceptance
Actual encrypted Messenger, moderation and abuse procedures, provider-side idempotency/expiry/revoke checks, real operator-controlled services, delivered receipts, private key rotation, multi-instance reassignment and independent security/privacy signoff remain LIFTd-TN-MSG NOT ACCEPTED. Repository fixtures do not demonstrate network delivery. The client remains disabled until admitted.

**Qualification owner:** PT-05 app-specific Level 1 only. No Foundry/Genesis/Integrated/Geth/Docs global inventories.
