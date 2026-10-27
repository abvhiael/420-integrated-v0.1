# HC-NEXT-7.3 — Premium or entitled events

## Scope
Premium competitions are explicitly optional event templates with a nonzero entitlement scope. Regular events use a zero scope and stay available without a wallet. Premium admission cannot improve genome, cultivation, harvest quality, yield, equipment statistics, BUDS, progression or scoring. CompetitionEngine scores independently verified FLOWER quality using the exact same code for all entrants.

## Independent verification
`PremiumCompetitionEntitlements73` is an immutable registry of approved scope-to-verifier bindings, controlled by a fixed registrar. An unregistered, paused, reverted or unavailable issuer fails closed. Existing `CompetitionEngine.enter`, `submit`, and `finalize` each enforce its registered optional scope, and finalized results can be checked with `resultIsCurrent`.

An external verifier must authenticate the player and return currently valid access for the exact immutable scope; the contract does not trust browser-provided entitlements or infer access from wallet balance. Operator must qualify verifier implementation and deploy it as the `CompetitionEngine` entitlement dependency. There is no wallet or ERC-20 price implied by premium access.

## Admission and fairness checks
The Level 1 suite covers ordinary player entry with no entitlement contract registration, approved premium entry, missing scope, duplicate binding, revoked entitlement, verifier outage, paused gate, and equal canonical scoring rules. No entitlement changes the harvest proof parameters or finality witness.

## Unclosed operational boundary
HC-NEXT-7.2's issuer-backed HTTP competitions are a separate service-side architecture and its PR is still open. Their premium counterpart must use independently validated account-scoped entitlement authorization before enabling paid account events; this Solidity-only provider does not qualify an account-server issuer, live deployment or entitlement procurement. No premium event may launch with unverified issuer wiring. Production exact-SHA integration and deployment evidence are still required.
