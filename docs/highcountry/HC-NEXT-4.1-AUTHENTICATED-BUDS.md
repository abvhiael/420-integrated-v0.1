# HC-NEXT-4.1 — Authenticated BUDS operations audit

Status: **expanded security hardening candidate; exact-SHA CI and final release acceptance pending**.

The registered economy uses signed, short-lived, audience/game-bound sessions with account epochs, immutable policy-limited reward sources, proof/objective replay protection, SERIALIZABLE PostgreSQL transactions, and a finalized receipt-aware canonical market settlement. Revocation now invalidates the prior registered-account epoch itself; receipt of newly issued credentials requires explicit re-registration, and legacy trusted-issuer reward grants require a currently registered recipient. Guests retain local-only preview state. BUDS are integer internal game units and not native $420.

## Security remediation

`AuthenticatedEconomyService.settleMarket()` previously allowed a service credential to settle arbitrary buyer-to-seller BUDS payments without proving a finalized inventory transfer. It now fails closed; `CanonicalMarketSettlement.prepare/finalize` remains the authorized market path and requires independent canonical receipt verification. A regression verifies that the privileged caller cannot debit buyer reservations or credit a seller by invoking the legacy facade.

## Additional requirements before claiming full HC-NEXT-4.1

- Verify **every** deployed service route maps a signed authenticated registered principal to a concrete account; direct facade methods must never accept client-provided owner values as proof of ownership.
- **Implemented:** derive market-locked BUDS from immutable prepared intents; ordinary BUDS release and generic settlement reject debits below total active prepared market holds. Canonical finalize/abort alone resolve the hold. An actual PostgreSQL multi-instance test covers attempted drain, concurrent finalization, replay, durable conservation and restart using the existing least-privilege RLS fixture.
- Qualify mission/progression objective proofs, total source issuance caps, sink authorization, account/source revocation, credential rotation, replay and concurrency across two live service instances.
- **Implemented in test coverage:** reject inconsistent issued/burned/balance totals on PostgreSQL transaction decode and before commit; an adversarial rollback test enforces no writes on failed conservation. Existing runtime integration tests exercise PostgreSQL persistence, RLS/least privilege, restart and finalized on-chain receipt reconciliation. Production deployment qualification remains independent.
- Run exact-SHA Level 1 BUDS and Level 2 economic integration checks, then production-equivalent deployment acceptance.

This document does not convert existing historical R04.5 qualification into new HC-NEXT-4.1 acceptance.
