# HZ-GCA-8 — Community identity and social graph

Status: IMPLEMENTED, **Level 1 CI pending verification**.

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

Exit checklist: implementation and tests authored; exact-head CI must PASS before completion. Next: **HZ-GCA-9 — Charts, discovery and anti-gaming**.
