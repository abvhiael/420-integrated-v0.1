# LIFTd PT-01 — Identity and consent pre-testnet implementation

**Scope:** Supplemental pre-testnet work package PT-01, not a renumbering or completion of canonical L03.10. Original L03.8, L03.9 and L03.10 external gates stay NOT ACCEPTED.

## Existing protections reused

- `rideshare/src/auth.mjs`: independent signed Identity and session-status authorities, audience and issuer separation, short max age, nonce/token digest, account/device/recovery binding, authoritative active/revoked status, action/resource role grants, reauthorization after network I/O.
- `rideshare/src/rider-preferences.mjs`: opt-in marketing/location history and preferences, account scoping, compare-and-swap revision, durable backing adapter.
- `rideshare/src/postgres-travel-consent.mjs`: separately bound one-time Travel consent and transaction-controlled trip revision.
- `rideshare/src/payment-protocol.mjs`: explicit wallet payment consent; not interchangeable with stored marketing/location preferences.

## Added gap closure

`rideshare/src/identity-consent-guard.mjs` supplies a trusted backend precondition for **optional location history, marketing and trip notifications**, requiring live session/Identity authorization, rider role, matching account and an explicitly enabled preference read from durable storage. It reauthorizes after that read and checks device, session and recovery-epoch continuity. It fails closed on expired, revoked or unavailable Identity/session authority, changed actor or missing consent. Each consumer must call this guard before its own side effect and must enforce revision/transaction concurrency in its data owner. A standalone guard is **not proof that every consumer is yet wired**; wiring review remains a repository-side follow-up if consumers of these optional purposes exist outside the audited preference service.

## Security contract

- Never interpret a preference opt-in as payment signing, regulatory or trip acceptance. Payment/Travel consent are purpose-specific.
- No synthesized grants, demo issuer keys or unsigned session evidence permitted.
- A provider outage, stale identity, mismatched account/device/recovery epoch, invalid purpose or missing opt-in must deny action.
- Live distinct Identity/session issuers and their credential rotation/outage, multi-instance tests require real testnet and independent signing owners; remain `LIFTd-TN-ID` under existing TN-0–TN-6.

## Qualification boundary

Use only dedicated `LIFTd PT-01 Identity Consent Level 1` workflow with retained `rideshare` suite. No phase-level or global workflows are required for this ordinary pre-testnet package. Verify exact SHA and only record successful workflow/run/job evidence after GitHub confirmation.

## PT-01 consumer discovery and wiring (2026-10-17)

Repository search of `rideshare/src` for `marketingConsent`, `locationHistoryConsent`, `tripNotifications`, and explicit preference reads finds the preference owner `rider-preferences.mjs` and active event-notification consumer `trip-communications.mjs`. Marketing and location-history flags have no additional LIFTd source consumer identified; neither is authorized to produce an unguarded side effect. Travel consent remains separately purpose-bound in `postgres-travel-consent.mjs`; wallet signing consent is separately bound by `payment-protocol.mjs`.

`createTripCommunicationService` now **requires** an injected `consentGuard.require` dependency (unconfigured service fails closed), checks a rider's authenticated own-account opt-in before notification, and refuses to use an initiating driver's token to impersonate the rider. For riders with notifications opted out, no message is published. A second preference read at publication resolves the selected delivery channel. Existing driver notification preference behavior remains separately scoped to the driver. The guard is not a replacement for the transport-authoritative notification service's own delivery-time consent/revocation and idempotency checks.

**Deployment boundary:** There is no concrete non-test `createTripCommunicationService` call site in the current `rideshare` source search. Therefore no live consumer assembly was modified or certified; actual deployed dependency injection and end-to-end receipt verification remain a deployed integration responsibility. The current repository service factory refuses to start without the guard, preventing accidental ungated assembly.
