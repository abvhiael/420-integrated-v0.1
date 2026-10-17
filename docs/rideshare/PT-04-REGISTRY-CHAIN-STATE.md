# LIFTd PT-04 — Registry and chain-state pre-testnet integration

**Authority:** canonical LIFTd L03.10 remains planned and NOT ACCEPTED; PT-04 is a supplemental repository-only readiness package.

## Repository discovery
- `rideshare/src/eligibility.mjs`: independent signed driver, vehicle and transport projections, issuer/audience/purpose, nonce challenge, account/vehicle/revision/scope binding, expiration and active/revoked/driver/vehicle admission safeguards.
- `rideshare/src/dispatch.mjs` and `rideshare/src/service.mjs`: fresh eligibility verification on candidate assignment and trips' assign/arrive/start transitions; cancellation and completion remain available on revocation.
- `rideshare/src/payments.mjs`: retained canonical chain-state finality, independent signed event receipts and sequence revisions, replay/equivocation prevention, reorg hold/recovery, refunds and payouts. PT-04 does not create competing chain-state authority.
- Existing admission regressions: `rideshare/test/eligibility.test.mjs`; Pay chain-state regressions already qualified under PT-03 and the PostgreSQL Pay lifecycle.

## Gap fixed in PT-04
The signed transport issuer was already required to be distinct from either Registry issuer. The driver and vehicle Registry signers themselves could share a signing key, collapsing two independently revocable authority domains. `createEligibilityAdapter` now rejects such key reuse at construction. A security regression demonstrates rejection without changing the valid separate signer path.

## Qualification
Target the dedicated `LIFTd PT-04 Registry Chain State Level 1` scoped app workflow. The unaffected chain-state/reorg/refund/payout logic retains prior PT-03 qualification evidence (141 passing, exact SHA `365d612a5255693f4aed1044c7e6b10e202489c1`), without global reruns. No fake Registry proof can count as live.

## Genuine deferred acceptance
Live independently hosted Registry/transport signers, real revocation propagation across dispatch instances, actual official-chain confirmations and reorg behavior, funded Pay settlement and consuming-service proof must be exercised under unchanged L03.10 and TN-0–TN-6. Original external passenger/vehicle/insurance authorization remains NOT ACCEPTED and cannot be granted by test fixtures.
