# HC-NEXT-7.2 — Ordinary exhibitions

## Account-only authority
Ordinary exhibitions are deliberately separated from R04.12's address-based on-chain events. They use independently authenticated **registered issuer accounts**, not client-submitted account IDs, browser guest IDs, wallet addresses or optional wallet entitlements. Guest play remains available outside authoritative exhibition submission. Optional wallet competitions retain their existing distinct R04.12 scope.

The service module `services/420-gaming-player-profile/src/highcountry-ordinary-exhibitions.js` accepts an issuer identity verifier, a canonical finalized FLOWER harvest verifier and a durable **serializable transactional repository**. No mock harvest or local preview is sufficient for live results.

Season organizers must own the season; immutable versioned categories must explicitly be wallet-free and match their rules hash. Registration is once per registered account, within the event window, capped at 128. One independently finalized FLOWER harvest per entrant, no pre-event evidence, no duplicate harvest per event, and no wallet/stat multiplier. Independent adjudicators may reject within the seven-day maximum challenge period. Finalization re-verifies the exact provenance hash, account, quality, harvest and finality time, tolerating revoked/reorged candidates by exclusion. Ranking is highest quality, then earliest finalization, then lexical canonical harvest ID; no valid result produces null winner. Finalization is single-use.

## Implemented adapters

- `highcountry-ordinary-postgres.js` supplies PostgreSQL transactions with SERIALIZABLE isolation, database uniqueness constraints, immutable harvest evidence rows, account/event/game scoped queries and database-controlled adjudication.
- `migrations/010_highcountry_ordinary_exhibitions.up.sql` provides additive schema, uniqueness, foreign keys, score constraints and limited runtime DML privileges. `migrateOrdinaryExhibitions420` checks migrator-role membership and a recorded migration hash; `scripts/migrate-ordinary-exhibitions.mjs` requires `GAMING_DATASTORE_MIGRATION_URL`.
- `highcountry-cloud-http.js` exposes POST `/highcountry/exhibitions/{create,enter,submit,reject,finalize,status}` through existing issuer-token/origin/game authorization. Exact allowed body fields are checked; player account IDs are never accepted for entry/submission.
- Browser cloud client and account panel permit authenticated profile registration and verified harvest submission without wallet connection. No local guest preview is canonical proof.

## Integration and deployment preconditions

Provision immutable versioned seasons/categories using an authorized operator and review their published rules hashes. Instantiate `createOrdinaryExhibitions420` with `createPostgresOrdinaryExhibitionRepository420`, an approved issuer-backed `identity.verify(token)` that confirms the registered game profile and revocation, and an independently qualified canonical `harvest.verifyFinalizedFlower({accountId,harvestId})` verifier. Supply this instance as the optional `ordinaryExhibitions` argument to the cloud HTTP service. Live production credentials, official canonical harvest verifier/address binding, operational issuer authorization and deployment have **not** been verified by this PR. Do not enable endpoints without those bindings.

Level 1 covers versioned-policy, entry, timing, replay, forged evidence, adversarial finality, HTTP spoofing and a real PostgreSQL transaction/migration journey; Level 2 requires independent production-equivalent issuer/harvest finality integration at the deployed API and recovery testing. Do not describe unit fixtures as proof of actual blockchain or game-server finality.

No prize, token transfer, wallet proof, unverified local harvest or paid scoring advantage is implied. Scope is ordinary exhibition admission/results only.

## HC-NEXT-7.2 / 7.3 integration boundary and Level 2 closeout

The Level 2 workflow `highcountry-ordinary-exhibitions-next-7-2-level2.yml` qualifies two **independent** paths on the same exact candidate SHA: issuer-account ordinary exhibitions with real PostgreSQL serialization and HTTP authorization, and the on-chain premium gate with the retained R04.12 season, template, entry, scoring and revocation tests. This is a bounded source-level qualification, **not** a deployed cross-system issuer adapter.

**No implicit account-to-wallet authority:** Ordinary exhibitions use authenticated registered issuer accounts and must reject wallet-gated category policies; premium `PremiumCompetitionEntitlements73` checks an explicitly registered nonzero bytes32 scope for an address, with independently deployed verifier contract and registrar. An account username, unverified browser-supplied wallet address, signed-in session or BUDS balance does not establish address ownership or premium eligibility.

The service cannot enable paid/account-scoped premium admission by calling the wallet-level gate without a separately qualified issuer account ↔ address authorization protocol with nonce, chain, game, scope, expiry, replay, revocation and finality guarantees. Provisioning production issuer credentials, canonical harvest verification, premium issuer contract, and testing the actual deployed account/contract bridge remain separate launch gates. No client or server should report these features live solely because bounded tests pass.

## Premium account-to-address authorization bridge (candidate)

`highcountry-premium-authorization.js` provides an optional, read-only eligibility check at `POST /highcountry/premium/eligibility` with body `{"scopeId":"0x<32-byte-nonzero-scope>"}`. It derives the registered issuer account and active wallet from the existing wallet-link service, which uses challenge-bound wallet signatures, single-use nonces, game/chain/domain context and durable unlink records. The caller supplies **no wallet or account ID**. It verifies the exact configured network, gate registry address and nonzero scope against a canonical finalized block, then rechecks account identity and wallet-link state after the chain read. Missing link, revocation, stale link, issuer failure, unconfirmed block, disabled scope or inaccessible RPC deny eligibility. This endpoint never enrolls a premium user, issues custody rights or modifies scoring.

The injected chain adapter MUST independently validate the exact deployed `PremiumCompetitionEntitlements73` bytecode/codehash and execute its `eligible(address,bytes32)` method at the supplied pinned canonical block hash (not the latest mutable block), verify finality independently and fail closed on RPC disagreement. The returned boolean must be a real EVM result, not a client claim. The existing production wallet-link signature verifier and issuer must be configured for the correct deployed chain. Separate operational deployment and end-to-end proof is required; this read-only bridge is **not** a replacement for the on-chain verifier registration/issuer entitlement grant and cannot make an on-chain event enforce a server-only revocation. Deploy/qualify the independently managed gate verifier, its authorized grant/revocation lifecycle, RPC finality adapter, and real issuer credentials before enabling production premium events. Wallet-free ordinary exhibition admission is unchanged.
