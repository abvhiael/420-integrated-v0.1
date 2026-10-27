# HC-NEXT-7.2 — Ordinary exhibitions

## Account-only authority
Ordinary exhibitions are deliberately separated from R04.12's address-based on-chain events. They use independently authenticated **registered issuer accounts**, not client-submitted account IDs, browser guest IDs, wallet addresses or optional wallet entitlements. Guest play remains available outside authoritative exhibition submission. Optional wallet competitions retain their existing distinct R04.12 scope.

The service module `services/420-gaming-player-profile/src/highcountry-ordinary-exhibitions.js` accepts an issuer identity verifier, a canonical finalized FLOWER harvest verifier and a durable **serializable transactional repository**. No mock harvest or local preview is sufficient for live results.

Season organizers must own the season; immutable versioned categories must explicitly be wallet-free and match their rules hash. Registration is once per registered account, within the event window, capped at 128. One independently finalized FLOWER harvest per entrant, no pre-event evidence, no duplicate harvest per event, and no wallet/stat multiplier. Independent adjudicators may reject within the seven-day maximum challenge period. Finalization re-verifies the exact provenance hash, account, quality, harvest and finality time, tolerating revoked/reorged candidates by exclusion. Ranking is highest quality, then earliest finalization, then lexical canonical harvest ID; no valid result produces null winner. Finalization is single-use.

This module does **not** instantiate a production repository, issuer or verifier: they must be bound to actual independently qualified services. It does not establish operational service deployment or persistent PostgreSQL guarantees by itself. Any production adoption must qualify database unique constraints, transaction isolation, finality, replay recovery and HTTP permission middleware before launch.

No prize, token transfer, wallet proof, unverified local harvest or paid scoring advantage is implied. Scope is ordinary exhibition admission/results only.
