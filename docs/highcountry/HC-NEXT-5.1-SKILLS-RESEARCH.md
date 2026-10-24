# HC-NEXT-5.1 — Versioned skills and research

**Baseline:** `HC-SKILL-RESEARCH-V1` in `services/highcountry-economy/src/skill-catalog-v1.js`. This is the new explicitly adopted V1 gameplay catalogue for this workstream, not a claim that historical R04.6 numbers already existed. The R04.6 chain registries remain independent immutable, verifier-only canonical records. Skill service purchases do **not** register chain tracks, transfer canonical assets or unlock chain entitlements.

## Versioned progression table

| Track | Kind | Prerequisite | Verified points | Max / proof | Cost (integer BUDS burned) | Minimum independently verified player level | Effect (noncompetitive) | Effect cap |
|---|---|---|---:|---:|---:|---:|---|---:|
| archive-index-I | Skill | None | 2 | 1 | 10 | 1 | +1 archive filter | 1 |
| field-journal-II | Skill | archive-index-I | 4 | 1 | 25 | 2 | +2 journal slots | 2 |
| workbench-notes-I | Research | None | 3 | 1 | 15 | 1 | +1 nonfunctional recipe note | 1 |
| workshop-layout-II | Research | workbench-notes-I | 5 | 1 | 30 | 3 | +1 cosmetic workshop layout | 1 |

**Eligible:** registered authenticated player; separately verified, issuer-signed evidence with exact track ID, version, player, points, distinct source event and expiration; unrevoked independently resolved current player level; all prerequisites unlocked; exact total points; sufficient unreserved BUDS. Unlock consumes BUDS in the same serializable transaction as the irreversible version-specific player unlock.

**Failures:** unknown/missing authority, malformed IDs, unapproved effect, spoofed/expired/mismatched signature, replayed evidence across tracks or versions, excess proof points, over-cap accumulation, incomplete progress, missing prerequisite, insufficient BUDS, revoked/unknown player, inadequate verified level, duplicate operation, integer overflow, and invalid configuration. Any failure rolls back the entire durable transaction.

**Persistence:** `skillResearch` maps `[principal,track,version]` to cumulative points and completed/unlocked timestamp; `skillResearchProofs` is the global unique issued source-event identity set; `operations` provides unique ledger/progression operation replay protection. PostgreSQL schema 1 gains backwards-compatible optional state arrays, and existing `PostgresBudsStore` serializable row locking guarantees isolation. The test fixture uses the same fields.

## Fairness and custody restrictions

Accepted effects are strictly: journal slots, research queue, cosmetic palette, archive filters, workshop layout and informational recipe notes. No effect crosses the asset, reward, genotype, potency, quality, yield, competitive score, capacity, rarity, drops, wallet or transaction boundaries. The progression subsystem **has no authorized asset/chain minting or escrow-settlement interface**. Skills cannot source BUDS rewards; actual earning stays under independent approved economic evidence and issuer policy. A guest save cannot unlock a registered skill. Wallet connection cannot increase level, BUDS, skill points, caps or eligibility.

Player progression UI uses `/skills` and consumes `POST /progression/snapshot`, `POST /progression/evidence`, `POST /progression/unlock`. The browser never assigns player principal or level, holds no signing key and cannot claim a canonical unlock. `/progression/evidence` accepts an expiring issuer-signed claim after independent Ed25519 verification. The `/progression/unlock` request contains operation and track only. Verified current level is resolved through an external server-side trusted `getPlayerLevel` provider, never browser input. Progression is off unless the deployment injects the versioned catalogue, the issuer-key verifier and an approved authoritative player-level resolver.

## Release acceptance

Require exact-SHA focused economy tests and application/browser qualification, including negative proof, replay, V1 cost and budget accounting, rollback, level, prerequisites, persistence and protected fairness controls. No production-qualified issuer or external independently attested player-level source has been demonstrated here; deployer must provision and approve those before turning progression on. Do not interpret local CI fixture signatures or player levels as external deployment acceptance. Real canonical progression remains governed by independently deployed and approved on-chain R04.6 registries and testnet gates.

## Production composition and trust inputs

`start-runtime.js` activates the feature only if `progression.catalogVersion` equals `HC-SKILL-RESEARCH-V1`. Its reviewed JSON configuration must contain `progression.evidencePublicKey` (pinned Ed25519 PEM), `progression.evidenceIssuer`, `progression.levelProviderUrl` (approved HTTPS endpoint with no embedded credentials), `progression.levelPublicKey` (independently pinned Ed25519 PEM) and `progression.levelIssuer`. These are public-verification values; private signing keys are never accepted from the browser or stored in the game repository.

Evidence is a base64url envelope containing Ed25519-signed `{domain:"HC.PROGRESSION.EVIDENCE.V1",issuer,principal,gameId,chainId,trackId,version,points,sourceEvent,expiresAt}`. Expiration is limited to five minutes and the signed source event can be consumed once globally across all tracks and catalogue versions. Separately, the signed HTTPS level source returns `{payload,signature}` where payload binds `HC.PLAYER.LEVEL.V1`, issuer, player, game, chain, integer level 1–100 and expiration within 60 seconds. The service independently resolves level using the authenticated server-derived principal and refuses wrong-game or wrong-chain signatures.

No skills routes are active without *both* approved evidence and level authority. Sessions are revalidated against the registered account epoch under the same serializable transaction that changes progress or burns BUDS. The optional `/skills` browser route never issues tokens or BUDS, and no local guest record is accepted as an issuer event. Previous-version unlock records are preserved as read-only history; new catalogue versions do not silently inherit prior-version active effects.

Until legitimate production issuer keys, the separately approved level service, and live deployment authorization exist, this is an implemented feature that remains disabled outside qualified test configurations.
