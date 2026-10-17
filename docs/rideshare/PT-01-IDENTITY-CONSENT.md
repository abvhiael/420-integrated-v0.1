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
