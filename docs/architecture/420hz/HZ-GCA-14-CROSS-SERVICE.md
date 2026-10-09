# HZ-GCA-14 — Notifications, Search, Analytics and Explorer integration

The repository-local `HzCrossService420` coordinator projects source-qualified lifecycle events for Notifications, Search, Analytics and Explorer, without claiming ownership of the underlying Generate, Creative, Community, Awards or payment records.

Supported events: generation completed/failed, project ready for review, release published, follow/community activity, nomination received/accepted, voting opened/closing, award won, and prize settlement status. All input events require an external trusted source verifier, object/reference IDs, checkpoint, finalization and source-readiness gates. Duplicate delivery is idempotent, conflicting replay fails closed. Projection commitments are deterministic for identical checkpoint/input sets.

Public Search indexes only eligible published Recording and AwardResult references with AI disclosure and award category metadata. Analytics keeps Generation, Community and Awards categories separate, and derives public aggregate counts only from public finalized events. Explorer projects public release/result/prize settlement references. Notification delivery is scoped to public audience or explicitly authenticated account: the account scope must be authorized at the caller/gateway boundary; the repository-local read interface itself is not an authentication mechanism.

This is a **projection contract and adversarial fixture**, not an actual deployed 420Indexer/420Search/420Analytics/420Explorer/420Notifications connector. Live source ingestion, durable checkpoint snapshots, blockchain reorganization rollback, transport authorization, per-recipient private notification routing, live notification dispatch, public endpoint delivery, and cross-service deployment verification are outstanding. Never describe derived Analytics/Search as canonical ownership, Award vote, or payment truth. Real same-object transport integration must be qualified before enabling production.

Level 1 CI: `.github/workflows/420hz-gca-14.yml` (exact-SHA app-only test gate). Level 2 should be run when the connected services converge; global Level 3 remains deferred until full app-phase closeout.

Next step to verify from canonical roadmap: HZ-GCA-15.
