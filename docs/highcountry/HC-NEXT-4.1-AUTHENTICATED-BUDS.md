# HC-NEXT-4.1 — Authenticated BUDS operations audit

Status: **partial hardening candidate; not fully qualified**.

The registered economy uses signed, short-lived, audience/game-bound sessions with account epochs, immutable policy-limited reward sources, proof/objective replay protection, SERIALIZABLE PostgreSQL transactions, and a finalized receipt-aware canonical market settlement. Guests retain local-only preview state. BUDS are integer internal game units and not native $420.

## Security remediation

`AuthenticatedEconomyService.settleMarket()` previously allowed a service credential to settle arbitrary buyer-to-seller BUDS payments without proving a finalized inventory transfer. It now fails closed; `CanonicalMarketSettlement.prepare/finalize` remains the authorized market path and requires independent canonical receipt verification. A regression verifies that the privileged caller cannot debit buyer reservations or credit a seller by invoking the legacy facade.

## Additional requirements before claiming full HC-NEXT-4.1

- Verify **every** deployed service route maps a signed authenticated registered principal to a concrete account; direct facade methods must never accept client-provided owner values as proof of ownership.
- Ensure owner-controlled reservation release cannot drain funds locked to an active canonical market transfer; source-scoped BUDS holds and recovery are needed for universal escrow isolation.
- Qualify mission/progression objective proofs, total source issuance caps, sink authorization, account/source revocation, credential rotation, replay and concurrency across two live service instances.
- Prove PostgreSQL persistence/rollback and restart on the final deployment configuration, enforce operator least privilege, and reconcile every unsettled listing against finality.
- Run exact-SHA Level 1 BUDS and Level 2 economic integration checks, then production-equivalent deployment acceptance.

This document does not convert existing historical R04.5 qualification into new HC-NEXT-4.1 acceptance.
