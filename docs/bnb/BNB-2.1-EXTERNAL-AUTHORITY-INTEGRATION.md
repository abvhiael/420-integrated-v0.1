# BNB-2.1 external authority integration boundary

**Status: PARTIAL — external authorities unprovisioned; Level 1 not fully accepted.**

The API supports three distinct cryptographic authorities: (1) the configured 420Identity-compatible signed session JWT; (2) `BNB_PROPERTY_ISSUER`, `BNB_PROPERTY_AUDIENCE`, `BNB_PROPERTY_PUBLIC_KEY_PEM` for a separately governed property-controller credential; and (3) `BNB_RECOVERY_ISSUER`, `BNB_RECOVERY_AUDIENCE`, `BNB_RECOVERY_PUBLIC_KEY_PEM` for separately governed recovery. Public/private signing keys are **never** generated or entrusted to BnB. Signatures are RS256 with pinned issuer and audience, 5-second skew, short validity and purpose/subject binding. Real issuer key provenance, rotation, token revocation and issuer lifecycle remain externally required.

**Property claims:** `POST /v1/bnb/account/properties/{property_id}/claims` requires an existing active BnB Identity session, external purpose `property-control`, matching signed subject and property ID, and a unique claim JTI. The claim is inserted with `pending` status, never interpreted as a Verified ownership credential or authority to publish, settle or manage payout. 420Verify software-verification results MUST NOT be accepted as land/property records. No independently approved title/licensing issuer is presently established.

**Recovery:** `POST /v1/bnb/account/recover` requires an independently signed new Identity JWT AND a **separate** proof with purpose `account-recovery`, subject match and unique JTI. In one PostgreSQL transaction, the account row is locked, proof JTI consumed once, account recovery epoch incremented and all old local sessions revoked. No password bypass, security-question reset or reusable proof. A token issued from a stolen/unrecovered Identity session is NOT enough without external recovery proof.

**Operational blockers:** Secure issuance of new Identity credentials after recovery; real external revocation checks; key rotation/mTLS issuer provenance; host ownership/licensing issuer governance and operational acceptance; actual HTTP multi-instance/session recovery testnet exercise; global API/browser authorization acceptance. BNB cannot deploy signing keys, assert trust in a fabricated issuer or self-approve property control. No production/Genesis booking enablement until qualified.

**Runtime changes:** `services/420bnb/authority.py`, migrations `004_authority_replay.sql`, recovery and property claim endpoints, associated CI Docker packaging and negative verifier tests.

**Qualification:** use only targeted `420BnB Runtime Slice` for changed paths at exact SHA. Its PASS, if achieved, is local acceptance only; no claim of live external integration or full BNB-2.1 completion.
