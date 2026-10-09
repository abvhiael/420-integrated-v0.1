# HZ-GCA-8 — Community identity and social graph

Status: **COMPLETE — repository-local Level 1 qualified**. Exact-SHA qualification: `ff7f71d84822e4aa29c832ee2b05545b0e9fec58`, workflow run `37863087029` (PASS); retained regression on accumulated branch HEAD `c67dc2ff84bb3d64adb6ef8994d14263afe51117`, workflow run `37879705015` (PASS).

Canonical roadmap: `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`.

This repository-local coordinator implements app-owned community records. It is NOT a live public API, durable production database, authenticated Wallet implementation, or deployed moderator service. Its input session is a **pre-verified session assertion** supplied by the embedding trusted Wallet/session boundary, never a user-provided account string. Production must validate origin, signature/session proof, expiry, permissions and revocation at the service boundary before constructing it.

- Follows: active public artist relationships; revocable and replay-safe.
- Favorites: recording preferences, private and excluded from public activity.
- Playlists: owner-controlled private/unlisted/public, ordered item IDs, revision checks, tombstones.
- Sharing: idempotent non-authoritative references, not rights or public access.
- Community activity: recomputed eligible public facts; no economic/chart/award inference.
- Block and mute: presentation/application-local flags only; existing relationship state remains unchanged.
- Reports: actor-scoped records, no implicit moderation adjudication.
- Notification preferences: opt-in, private, no delivery authority.
- Comments/replies: **disabled** until moderation/reporting/appeal lifecycle is fully implemented and qualified.

Read-time canonical source readiness and visibility constrain all playlist/discovery results. References do not grant playback/Creative rights. All runtime state is in-memory for deterministic tests; production-grade persistence, RPC binding, social feeds and deployment are separate service integration work and are **not claimed** here.

Level 1: `node --test hz/generate/test/community.test.js` and `node --check hz/generate/src/community.js`. Broader Level 2 is not mandated at HZ-GCA-8; Level 3 remains at HZ-GCA-17.

Exit checklist: implementation and targeted adversarial tests qualified at Level 1; exact-head workflow and retained accumulated-branch regression PASS. The live production integration and testnet limitations above remain deferred. Next: **HZ-GCA-9 — Charts, discovery and anti-gaming**.
